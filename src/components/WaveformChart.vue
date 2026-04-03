<template>
  <div ref="chartRef" class="waveform-chart"></div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  waveform: {
    type: Object,
    required: true
  },
  playbackState: {
    type: String,
    default: 'idle'
  },
  transitionMs: {
    type: Number,
    default: 120
  }
})

const chartRef = ref(null)
let chartInstance = null
let resizeHandler = null

const getStatePalette = (state) => {
  switch (state) {
    case 'completed':
      return {
        line: '#0284c7',
        areaStart: 'rgba(2, 132, 199, 0.18)',
        areaEnd: 'rgba(2, 132, 199, 0.01)'
      }
    case 'error':
      return {
        line: '#dc2626',
        areaStart: 'rgba(220, 38, 38, 0.18)',
        areaEnd: 'rgba(220, 38, 38, 0.01)'
      }
    default:
      return {
        line: '#0f766e',
        areaStart: 'rgba(15, 118, 110, 0.16)',
        areaEnd: 'rgba(15, 118, 110, 0.01)'
      }
  }
}

const getEmptyText = (state) => {
  switch (state) {
    case 'connecting':
      return 'Connecting replay stream...'
    case 'playing':
      return 'Receiving replay frames...'
    case 'error':
      return 'Replay stream interrupted'
    case 'completed':
      return 'Replay finished'
    case 'stopped':
      return 'Replay stopped'
    default:
      return 'Start replay to view the waveform'
  }
}

const initChart = () => {
  if (!chartRef.value) {
    return
  }

  chartInstance = echarts.init(chartRef.value)

  chartInstance.setOption({
    animationEasingUpdate: 'linear',
    textStyle: {
      fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
    },
    grid: {
      left: 52,
      right: 18,
      bottom: 34,
      top: 22
    },
    tooltip: {
      trigger: 'axis',
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      textStyle: {
        color: '#eff7fb'
      },
      formatter: (params) => {
        const point = params?.[0]
        if (!point) {
          return ''
        }

        const value = Number(point.data)
        const axisValue = Number(point.axisValue) + 1
        return `Sample ${axisValue}<br/>Amplitude ${value.toFixed(4)}`
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLine: {
        lineStyle: {
          color: 'rgba(113, 138, 153, 0.34)'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#718a99',
        margin: 12
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#718a99'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(113, 138, 153, 0.12)'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        zoomLock: false
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: {
          text: getEmptyText(props.playbackState),
          fill: '#86a0af',
          fontSize: 15,
          fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
        }
      }
    ],
    series: [
      {
        name: 'Amplitude',
        type: 'line',
        data: [],
        showSymbol: false,
        smooth: 0.08,
        sampling: 'lttb',
        progressive: 4000,
        lineStyle: {
          width: 2.5
        },
        areaStyle: {},
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: {
            type: 'dashed',
            color: 'rgba(113, 138, 153, 0.28)'
          },
          data: [{ yAxis: 0 }]
        }
      }
    ]
  })
}

const updateChart = (waveform) => {
  if (!chartInstance) {
    return
  }

  const amplitudes = Array.isArray(waveform?.amplitudes) ? waveform.amplitudes : []
  const xData = Array.from({ length: amplitudes.length }, (_, index) => index)
  const palette = getStatePalette(props.playbackState)
  const hasData = amplitudes.length > 0

  chartInstance.setOption({
    animationDurationUpdate: Math.min(Math.max(props.transitionMs, 30), 260),
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: {
          text: hasData ? '' : getEmptyText(props.playbackState),
          fill: '#86a0af',
          fontSize: 15,
          fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
        }
      }
    ],
    xAxis: {
      data: xData
    },
    series: [
      {
        name: 'Amplitude',
        data: amplitudes,
        lineStyle: {
          width: 2.5,
          color: palette.line
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: palette.areaStart },
            { offset: 1, color: palette.areaEnd }
          ])
        }
      }
    ]
  })
}

onMounted(() => {
  initChart()
  updateChart(props.waveform)
  resizeHandler = () => chartInstance?.resize()
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }

  chartInstance?.dispose()
})

watch(
  () => props.waveform,
  (newWaveform) => {
    updateChart(newWaveform)
  },
  { deep: true }
)

watch(
  () => props.playbackState,
  () => {
    updateChart(props.waveform)
  }
)
</script>

<style scoped>
.waveform-chart {
  width: 100%;
  height: 100%;
  flex: 1;
}
</style>
