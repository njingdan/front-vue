<template>
  <div ref="chartRef" class="w-full h-96"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  waveform: {
    type: Object,
    required: true
  }
})

const chartRef = ref(null)
let chartInstance = null

const initChart = () => {
  chartInstance = echarts.init(chartRef.value)

  const option = {
    title: { text: '实时波形监测', left: 'center', top: '-3px' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['Amplitude'], top: 30 },
    grid: { left: 40, right: 20, bottom: 40, top: 70 },
    xAxis: { type: 'category', boundaryGap: false },
    yAxis: { type: 'value', scale: true },
    series: [
      { name: 'Amplitude', type: 'line', data: [] }
    ]
  }
  chartInstance.setOption(option)
}

const updateChart = (waveform) => {
  if (!chartInstance || !waveform?.real) return
  const points = waveform.real.length
  const xData = Array.from({ length: points }, (_, i) => i)

  chartInstance.setOption({
    xAxis: { data: xData },
    series: [
      { name: 'Amplitude', data: waveform.amplitudes }
    ]
  })
}

onMounted(() => {
  initChart()
  updateChart(props.waveform)
  window.addEventListener('resize', () => chartInstance?.resize())
})

onUnmounted(() => {
  chartInstance?.dispose()
})

watch(() => props.waveform, (newVal) => {
  updateChart(newVal)
}, { deep: true })
</script>

<style scoped>
.w-full {
  width: 100%;
}
.h-96 {
  height: 24rem;
}
</style>
