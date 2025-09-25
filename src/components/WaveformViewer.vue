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
const dataBuffer = ref([]);
let ws = null;
let frameCount = 0;
let lastFpsTime = Date.now();

// 滚动波形配置
const MAX_BUFFER_SIZE = 1500; // 缓冲区最大数据点（控制总显示长度）
const DISPLAY_POINTS = 1000;   // 图表单次显示的点数量（建议小于MAX_BUFFER_SIZE）


const sampleRate = 1000; // 采样率（每秒采样点数）

// 初始化ECharts图表
const initChart = () => {
  if (!chartRef.value) return;

  chart.value = echarts.init(chartRef.value);

  const option = {
    animation: false, // 实时数据建议关闭动画
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        snap: true
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
      type: 'value', // 数值轴
      name: '时间（秒）',
      nameLocation: 'end',
      nameTextStyle: {
        fontSize: 12,
        padding: [5, 0, 0, 0]
      },
      axisLine: {
        show: true,
        lineStyle: { color: '#ccc' }
      },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#f0f0f0'
        }
      },
      min: 0,
      max: 2,
      axisLabel: {
        formatter: function (value) {
          return value.toFixed(1);
        }
      }
    },
    yAxis: {
      type: 'value', // 数值轴
      name: '信号幅值',
      nameLocation: 'end',
      nameTextStyle: {
        fontSize: 12,
        padding: [0, 0, 5, 0]
      },
      min: -1.2,
      max: 1.2,
      axisLine: {
        show: true,
        lineStyle: { color: '#ccc' }
      },
      axisTick: { show: true },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#f0f0f0'
        }
      }
    },
    series: [
      {
        name: '波形数据',
        type: 'line',
        // 移除 coordinateSystem 配置，使用默认的笛卡尔坐标系
        // coordinateSystem: 'cartesian2d', // 这行注释掉或删除
        data: [],
        showSymbol: false, // 替代 symbol: 'none'
        smooth: true,
        lineStyle: {
          width: 1.2,
          color: '#1890ff'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
          ])
        }
      }
    ],
  };

  chart.value.setOption(option);
};

// 初始化WebSocket连接
const initWebSocket = () => {
  const wsUrl = `ws://${window.location.hostname}:8080/gnuradio/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接成功，开始接收波形数据');
    };

    ws.onmessage = (event) => {
      if (!isPlaying.value) return;
      try {
        const newData = JSON.parse(event.data);
        if (!Array.isArray(newData) || newData.length === 0) return;

        // 1. 更新统计数据
        totalPoints.value += newData.length;
        frameCount++;

        // 2. 直接添加新数据（不再裁剪，让缓冲区无限增长）
        dataBuffer.value.push(...newData);

        // 3. 触发滚动波形更新
        updateScrollingWaveform();
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

// 更新波形图 - 修复版本
const updateWaveform = () => {
  if (!chart.value || dataBuffer.value.length === 0) return;

  // 创建x轴数据（索引）
  const xData = Array.from({ length: dataBuffer.value.length }, (_, i) => i);

  const option = {
    series: [{
      data: dataBuffer.value.map((value, index) => [index, value])
      // 或者使用分开的x轴和y轴数据（推荐）：
      // data: dataBuffer.value
    }],
    xAxis: {
      data: xData // 设置x轴数据
    }
  };

  chart.value.setOption(option, {
    notMerge: false, // 使用合并模式，只更新变化的数据
    lazyUpdate: true // 懒更新，提高性能
  });

  // 计算FPS
  const now = Date.now();
  if (now - lastFpsTime >= 1000) {
    fps.value = frameCount / ((now - lastFpsTime) / 1000);
    frameCount = 0;
    lastFpsTime = now;
  }
};


// 在状态管理部分添加更新锁
let isUpdating = false; // 防止并发更新图表（性能优化）

const updateScrollingWaveform = () => {
  if (!chart.value || dataBuffer.value.length === 0 || isUpdating) return;
  isUpdating = true;

  requestAnimationFrame(() => {
    try {
      // 1. 计算最新数据的时间（最后一个数据点的时间）
      const latestTime = dataBuffer.value.length / sampleRate;
      // 2. 计算显示窗口的起始时间（最新时间 - 2秒，可调整窗口长度）
      const startTime = Math.max(0, latestTime - 2);

      // 3. 生成显示数据（只取窗口内的点）
      const displayData = dataBuffer.value.filter((_, index) => {
        const time = index / sampleRate;
        return time >= startTime && time <= latestTime;
      });

      // 4. 生成图表数据（[时间, 幅值] 格式）
      const seriesData = displayData.map((yValue, index) => [
        (dataBuffer.value.length - displayData.length + index) / sampleRate,
        yValue
      ]);

      // 5. 增量更新图表（X轴范围动态扩展）
      const updateOption = {
        xAxis: {
          min: startTime,
          max: latestTime // X轴最大值为最新数据的时间
        },
        series: [{
          data: seriesData
        }]
      };

      chart.value.setOption(updateOption, { notMerge: false, lazyUpdate: true });

      // 6. 计算FPS
      const currentTime = Date.now();
      if (currentTime - lastFpsTime >= 1000) {
        fps.value = frameCount / ((currentTime - lastFpsTime) / 1000);
        frameCount = 0;
        lastFpsTime = currentTime;
      }
    } finally {
      isUpdating = false;
    }
  });
};



// 控制方法
const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
};



// 响应窗口大小变化
const handleResize = () => {
  nextTick(() => {
    chart.value?.resize();
  });
};

// 生命周期钩子
onMounted(() => {
  nextTick(() => {
    initChart();
    initWebSocket();
    window.addEventListener('resize', handleResize);
  });
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
  chart.value?.dispose();
  window.removeEventListener('resize', handleResize);
});

const clearWaveform = () => {
  dataBuffer.value = [];
  totalPoints.value = 0;
  if (chart.value) {
    chart.value.setOption({
      xAxis: { min: 0, max: 2 }, // 重置为初始时间范围
      series: [{ data: [] }]
    });
  }
};

// 监听播放状态（恢复播放时更新滚动波形）
watch(isPlaying, (newVal) => {
  if (newVal && chart.value && dataBuffer.value.length > 0) {
    updateScrollingWaveform();
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