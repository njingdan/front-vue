<template>
  <div class="waveform-container">
    <div ref="chartRef" class="chart-wrapper"></div>
    <div class="control-bar">
      <button @click="togglePlay" class="btn">
        {{ isPlaying ? '暂停' : '继续' }}
      </button>
      <button @click="clearWaveform" class="btn btn-clear">清空波形</button>
      <div class="stats">
        <span>接收数据点：{{ totalPoints }} 个</span>
        <span>当前帧率：{{ fps.toFixed(1) }} FPS</span>
        <span>数据速率：{{ dataRate.toFixed(1) }} K点/秒</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as echarts from 'echarts';

// 状态管理
const chartRef = ref(null);
const chart = ref(null);
const isPlaying = ref(true);
const totalPoints = ref(0);
const fps = ref(0);
const dataRate = ref(0);
const dataBuffer = ref([]);
let ws = null;
let frameCount = 0;
let lastFpsTime = Date.now();
let lastDataCount = 0;

// 时间轴关键变量
let startTime = null;
let currentTimeOffset = 0;

// 高频数据配置（1000:1降采样）
const MAX_BUFFER_SIZE = 10*10*1000/10;         // 缓冲区：10秒数据（10点/批 × 100批/秒 × 10秒 = 5000点）
const DISPLAY_TIME_WINDOW = 10;       // 显示10秒窗口
const BATCH_INTERVAL_MS = 10;         // 后端每10ms发送一批
const EXPECTED_POINTS_PER_BATCH = 10; // 期望每批10个点（1000:1降采样后）

// 计算时间参数
const POINTS_PER_SECOND = 1000 / BATCH_INTERVAL_MS * EXPECTED_POINTS_PER_BATCH; // 1000点/秒
const POINT_INTERVAL = 1 / POINTS_PER_SECOND; // 每个点的时间间隔：0.001秒

// 初始化ECharts图表
const initChart = () => {
  if (!chartRef.value) return;

  chart.value = echarts.init(chartRef.value);

  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line'
      },
      formatter: (params) => {
        const point = params[0];
        return `时间: ${point.value[0].toFixed(3)}秒<br/>幅值: ${point.value[1].toFixed(4)}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '时间（秒）',
      nameLocation: 'end',
      nameTextStyle: {
        fontSize: 12,
        padding: [5, 0, 0, 0]
      },
      axisLine: { show: true, lineStyle: { color: '#ccc' } },
      axisTick: { show: false },
      splitLine: { show: false },
      min: 0,
      max: DISPLAY_TIME_WINDOW,
      axisLabel: {
        formatter: function(value) {
          return value % 1 === 0 ? value.toFixed(0) : '';
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '信号幅值',
      nameLocation: 'end',
      min: 0,
      max: 0.6,
      axisLine: { show: true, lineStyle: { color: '#ccc' } },
      splitLine: { show: false }
    },
    series: [{
      name: '波形数据',
      type: 'line',
      data: [],
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 1, color: '#1890ff' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
          { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
        ])
      }
    }]
  };

  chart.value.setOption(option);
};

// 初始化WebSocket连接
const initWebSocket = () => {
  const wsUrl = `ws://${window.location.hostname}:8080/gnuradio/ws`;
  console.log('连接WebSocket:', wsUrl);
  console.log('高频数据配置（1000:1降采样）:', {
    batchInterval: BATCH_INTERVAL_MS + 'ms',
    expectedPointsPerBatch: EXPECTED_POINTS_PER_BATCH,
    pointsPerSecond: POINTS_PER_SECOND,
    displayWindow: DISPLAY_TIME_WINDOW + '秒',
    totalBufferPoints: MAX_BUFFER_SIZE
  });

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接成功，开始接收高频波形数据（1000:1降采样）');
      startTime = Date.now();
      currentTimeOffset = 0;
      lastDataCount = 0;
    };

    ws.onmessage = (event) => {
      if (!isPlaying.value || !startTime) return;
      
      try {
        const response = JSON.parse(event.data);
        if (!response.magnitudes || !Array.isArray(response.magnitudes)) {
          console.warn('无效的数据格式:', response);
          return;
        }
        
        const newData = response.magnitudes;
        const actualPoints = newData.length;
        
        // 验证数据点数（期望每批10个点）
        if (actualPoints !== EXPECTED_POINTS_PER_BATCH) {
          console.warn(`数据点数异常: 期望${EXPECTED_POINTS_PER_BATCH}, 实际${actualPoints}`);
        }

        totalPoints.value += actualPoints;
        frameCount++;

        processNewData(newData);
        
      } catch (error) {
        console.error('解析波形数据失败：', error);
      }
    };

    ws.onclose = () => {
      console.warn('WebSocket连接关闭，3秒后重试...');
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket连接错误：', error);
    };
  } catch (error) {
    console.error('创建WebSocket连接失败：', error);
  }
};

// 处理新数据（1000:1降采样优化）
const processNewData = (newData) => {
  if (!startTime || newData.length === 0) return;

  // 计算实际时间间隔（每批10个点，每点0.001秒）
  const batchDuration = newData.length * POINT_INTERVAL; // 0.01秒（10ms）
  
  const newDataPoints = newData.map((value, index) => {
    const pointTime = currentTimeOffset + index * POINT_INTERVAL;
    return [pointTime, value];
  });

  currentTimeOffset += batchDuration;

  // 添加到缓冲区
  dataBuffer.value.push(...newDataPoints);

  // 缓冲区管理（保留最近10秒数据）
  if (dataBuffer.value.length > MAX_BUFFER_SIZE) {
    const removeCount = dataBuffer.value.length - MAX_BUFFER_SIZE;
    dataBuffer.value = dataBuffer.value.slice(removeCount);
  }

  // 计算数据速率（点/秒）
  const currentTime = Date.now();
  if (currentTime - lastFpsTime >= 1000) {
    const newPoints = totalPoints.value - lastDataCount;
    dataRate.value = newPoints / 1000; // 转换为K点/秒
    lastDataCount = totalPoints.value;
    
    console.log(`数据速率: ${dataRate.value.toFixed(1)}K点/秒, 缓冲区: ${dataBuffer.value.length}点`);
  }

  scheduleWaveformUpdate();
};

// 渲染调度（性能优化）
let updateScheduled = false;
let lastRenderTime = 0;
const MIN_RENDER_INTERVAL = 100; // 最小渲染间隔100ms（最大10FPS）

const scheduleWaveformUpdate = () => {
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

// 更新波形显示
const updateWaveformDisplay = () => {
  if (!chart.value || dataBuffer.value.length === 0) return;
  
  try {
    const latestTime = currentTimeOffset;
    const displayStart = Math.max(0, latestTime - DISPLAY_TIME_WINDOW);
    const displayEnd = Math.max(DISPLAY_TIME_WINDOW, latestTime);

    // 筛选显示范围内的数据点
    const displayData = dataBuffer.value.filter(point => 
      point[0] >= displayStart && point[0] <= displayEnd
    );

    // 更新图表
    chart.value.setOption({
      xAxis: { 
        min: displayStart,
        max: displayEnd
      },
      series: [{ 
        data: displayData 
      }]
    }, { notMerge: false, lazyUpdate: true });

    // 更新FPS
    const currentTime = Date.now();
    if (currentTime - lastFpsTime >= 1000) {
      fps.value = frameCount;
      frameCount = 0;
      lastFpsTime = currentTime;
    }
    
  } catch (error) {
    console.error('更新波形显示失败:', error);
  }
};

// 控制方法
const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    scheduleWaveformUpdate();
  }
};

const clearWaveform = () => {
  dataBuffer.value = [];
  totalPoints.value = 0;
  dataRate.value = 0;
  startTime = Date.now();
  currentTimeOffset = 0;
  lastDataCount = 0;
  
  if (chart.value) {
    chart.value.setOption({
      xAxis: { min: 0, max: DISPLAY_TIME_WINDOW },
      series: [{ data: [] }]
    });
  }
  console.log('波形已清空，时间轴重置');
};

// 响应窗口大小变化
const handleResize = () => {
  chart.value?.resize();
};

// 生命周期钩子
onMounted(() => {
  initChart();
  initWebSocket();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (ws) ws.close();
  chart.value?.dispose();
  window.removeEventListener('resize', handleResize);
});

watch(isPlaying, (newVal) => {
  if (newVal) {
    scheduleWaveformUpdate();
  }
});
</script>

<style scoped>
.waveform-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  padding: 20px;
  box-sizing: border-box;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-wrapper {
  width: 100%;
  height: calc(100% - 60px);
  border: 1px solid #eee;
  border-radius: 4px;
}

.control-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 10px;
  height: 50px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #1890ff;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn:hover {
  background-color: #096dd9;
}

.btn-clear {
  background-color: #ff4d4f;
}

.btn-clear:hover {
  background-color: #d9363e;
}

.stats {
  margin-left: auto;
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: #666;
}

@media (max-width: 768px) {
  .control-bar {
    flex-direction: column;
    height: auto;
    gap: 10px;
  }

  .stats {
    margin-left: 0;
    justify-content: space-between;
    width: 100%;
  }
}
</style>