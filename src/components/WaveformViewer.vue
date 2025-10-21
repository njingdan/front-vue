<template>
  <div class="waveform-section">
    <h3 class="title">实时波形（Time vs Amplitude）</h3>

    <!-- 上：波形图 -->
    <div ref="chartRef" class="chart-box"></div>

    <!-- 下：控制面板 -->
    <div class="panel">
      <div class="row">
        <button @click="togglePlay" class="btn">{{ isPlaying ? '暂停' : '继续' }}</button>
        <button @click="clearWaveform" class="btn btn-clear">清空</button>
        <label class="follow">
          <input type="checkbox" v-model="followLive" />
          跟随实时
        </label>
      </div>
      <div class="stats">
        <div>接收数据点：{{ totalPoints }} 个</div>
        <div>帧率：{{ fps.toFixed(1) }} FPS</div>
        <div>数据速率：{{ dataRate.toFixed(1) }} K点/秒</div>
        <div>显示窗口：{{ DISPLAY_TIME_WINDOW }} s</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import http, { getServerUrl } from '@/axios/request';

const chartRef = ref(null);
const chart = ref(null);

const isPlaying = ref(true);
const followLive = ref(true);
const totalPoints = ref(0);
const fps = ref(0);
const dataRate = ref(0);

const dataBuffer = ref([]); // [[t, amp], ...]
let es = null;
let frameCount = 0;
let lastFpsTime = Date.now();
let lastDataCount = 0;

// 采样率（优先用后端给的 sampleRate；否则用 1MHz 作为默认，与你的 Python 脚本一致）
const DEFAULT_SAMPLE_RATE = 1_000_000;
let sampleRateHz = DEFAULT_SAMPLE_RATE;

// 时间轴与窗口参数
const DISPLAY_TIME_WINDOW = 2; // 显示最近 2 秒，避免横轴过长导致标签挤压
const MAX_POINTS = DISPLAY_TIME_WINDOW * (sampleRateHz / 1000) * 100; // 估算窗口点数（会随 sampleRate 更新）

// 时间游标（以秒计）
let currentTimeOffset = 0;

// 初始化图表（强化网格线显示）
const initChart = () => {
  if (!chartRef.value) return;
  chart.value = echarts.init(chartRef.value, undefined, { renderer: 'canvas' });

  chart.value.setOption({
    backgroundColor: '#ffffff',
    animation: false,
    grid: {
      left: 72,
      right: 28,
      top: 26,
      bottom: 72,
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        const p = params?.[0];
        if (!p) return '';
        return `时间: ${p.value[0].toFixed(6)} s<br/>幅值: ${p.value[1].toFixed(4)}`;
      }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, throttle: 30, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, height: 18, bottom: 14, realtime: true, filterMode: 'none' }
    ],
    xAxis: {
      type: 'value',
      name: '时间（秒）',
      nameLocation: 'end',
      nameGap: 20,
      boundaryGap: false,
      axisLine: { show: true, lineStyle: { color: '#666', width: 1 } },
      axisTick: { show: true, lineStyle: { color: '#666' } },
      axisLabel: { 
        color: '#333', 
        margin: 12,
        formatter: (v) => Number.isInteger(v) ? v.toFixed(0) : ''
      },
      // 强化 x 轴网格线
      splitLine: { 
        show: true, 
        lineStyle: { 
          color: '#e0e0e0', 
          width: 1,
          type: 'solid'
        },
        interval: 'auto'
      }
    },
    yAxis: {
      type: 'value',
      name: '信号幅值',
      nameLocation: 'end',
      nameGap: 16,
      axisLine: { show: true, lineStyle: { color: '#666', width: 1 } },
      axisTick: { show: true, lineStyle: { color: '#666' } },
      axisLabel: { color: '#333', margin: 10 },
      // 强化 y 轴网格线
      splitLine: { 
        show: true, 
        lineStyle: { 
          color: '#e0e0e0', 
          width: 1,
          type: 'solid'
        },
        interval: 'auto'
      },
      scale: true
    },
    series: [
      {
        name: 'Waveform',
        type: 'line',
        data: [],
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 2,
        smooth: false,
        lineStyle: { width: 1, color: '#1f77b4' },
        itemStyle: { color: '#1f77b4' },
        sampling: 'lttb',
        clip: true
      }
    ]
  });
};

// 解包后端返回
const extractSamples = (body) => {
  // REST: StandardResponse<WaveformDataDto> -> resp.data.data
  // SSE: 直接就是 WaveformDataDto
  // 字段：优先 magnitude；兜底 samples/amplitude/real（real 仅演示用途）
  let samples = body?.magnitude || body?.samples || body?.amplitude || body?.real || [];
  if (!Array.isArray(samples)) samples = [];
  if (typeof body?.sampleRate === 'number' && body.sampleRate > 0) {
    sampleRateHz = body.sampleRate;
  }
  return samples;
};

// 将一帧样本映射为 [time, amp]
const appendSamples = (samples) => {
  if (!samples || samples.length === 0) return;
  const pointInterval = 1 / (sampleRateHz || DEFAULT_SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) {
    dataBuffer.value.push([currentTimeOffset + i * pointInterval, samples[i]]);
  }
  currentTimeOffset += samples.length * pointInterval;

  // 根据采样率动态估算窗口点数，限制缓冲区大小，避免滑块和轴被挤出边界
  const maxPointsNow = Math.max(2_000, Math.floor(DISPLAY_TIME_WINDOW * sampleRateHz / 10)); // 稍微保守
  while (dataBuffer.value.length > maxPointsNow) {
    dataBuffer.value.shift();
  }
  totalPoints.value += samples.length;
};

// REST 首帧
const fetchInitial = async () => {
  try {
    const resp = await http.get('api/signal/waveform');
    const body = resp?.data?.data ?? resp?.data;
    const samples = extractSamples(body);
    appendSamples(samples);
    scheduleWaveformUpdate(true);
  } catch (e) {
    console.error('初次获取波形失败:', e);
  }
};

// SSE 订阅
const startSse = () => {
  const base = getServerUrl().replace(/\/+$/, '');
  es = new EventSource(base + '/api/signal/stream');

  es.addEventListener('signal', (evt) => {
    if (!isPlaying.value) return;
    try {
      const payload = JSON.parse(evt.data);
      const samples = extractSamples(payload);
      appendSamples(samples);
      scheduleWaveformUpdate(false);
    } catch (e) {
      // ignore
    }
  });

  es.addEventListener('error', () => {
    // 简单重连
    if (es) es.close();
    setTimeout(startSse, 1500);
  });
};

// 渲染节流
let updateScheduled = false;
let lastRenderTime = 0;
const MIN_RENDER_INTERVAL = 80; // 略高刷新，保证滑块顺畅

const scheduleWaveformUpdate = (initial = false) => {
  if (initial) {
    updateWaveformDisplay();
    return;
  }
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    const now = Date.now();
    if (now - lastRenderTime >= MIN_RENDER_INTERVAL) {
      updateWaveformDisplay();
      lastRenderTime = now;
    }
  });
};

// 刷新图表（不强设 xAxis min/max；用 dataZoom 控制窗口；动态 y 轴）
const updateWaveformDisplay = () => {
  if (!chart.value || dataBuffer.value.length === 0) return;

  const seriesData = dataBuffer.value.slice();

  // y 轴范围（留 10% padding）
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < seriesData.length; i++) {
    const v = seriesData[i][1];
    if (v < yMin) yMin = v;
    if (v > yMax) yMax = v;
  }
  if (!isFinite(yMin) || !isFinite(yMax)) { yMin = -1; yMax = 1; }
  if (yMin === yMax) {
    const pad = Math.max(Math.abs(yMax) * 0.1, 0.1);
    yMin -= pad; yMax += pad;
  } else {
    const pad = (yMax - yMin) * 0.1;
    yMin -= pad; yMax += pad;
  }

  chart.value.setOption({
    yAxis: { min: yMin, max: yMax },
    series: [{ data: seriesData }]
  }, { notMerge: false, lazyUpdate: true });

  // 跟随实时：滑动 dataZoom 窗口到末尾 [tEnd - WINDOW, tEnd]
  if (followLive.value && seriesData.length > 0) {
    const tEnd = seriesData[seriesData.length - 1][0];
    const tStart = Math.max(0, tEnd - DISPLAY_TIME_WINDOW);
    chart.value.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      startValue: tStart,
      endValue: tEnd
    });
    chart.value.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 1,
      startValue: tStart,
      endValue: tEnd
    });
  }

  // FPS & 速率
  const now = Date.now();
  if (now - lastFpsTime >= 1000) {
    fps.value = frameCount;
    frameCount = 0;
    lastFpsTime = now;
    dataRate.value = (totalPoints.value - lastDataCount) / 1000;
    lastDataCount = totalPoints.value;
  } else {
    frameCount++;
  }
};

// 控件
const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) scheduleWaveformUpdate();
};
const clearWaveform = () => {
  dataBuffer.value = [];
  totalPoints.value = 0;
  dataRate.value = 0;
  currentTimeOffset = 0;
  chart.value?.setOption({ yAxis: { min: -1, max: 1 }, series: [{ data: [] }] });
};

// 生命周期
onMounted(async () => {
  initChart();
  await fetchInitial();
  startSse();
  window.addEventListener('resize', () => chart.value?.resize());
});
onUnmounted(() => {
  if (es) es.close();
  chart.value?.dispose();
});
watch(isPlaying, (v) => { if (v) scheduleWaveformUpdate(); });
</script>

<style scoped>
.waveform-section {
  padding: 20px 20px 14px;
  background: #f7f9fc;
  border-radius: 10px;
  border: 1px solid #eef2f6;
  max-width: 1200px;
  margin: 16px auto;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}
.title {
  margin: 0 0 14px 0;
  font-size: 16px;
  color: #111827;
}
.chart-box {
  width: 100%;
  height: 500px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.panel {
  margin-top: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
}
.row {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}
.follow { margin-left: 8px; color: #374151; font-size: 13px; }
.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #1f77b4;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.btn:hover { background: #1a5fa1; }
.btn-clear { background: #ef4444; }
.btn-clear:hover { background: #dc2626; }
.stats {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 10px 16px;
  font-size: 12px;
  color: #374151;
}
@media (max-width: 920px) {
  .chart-box { height: 420px; }
  .stats { grid-template-columns: 1fr 1fr; }
}
</style>