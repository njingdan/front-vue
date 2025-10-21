<template>
  <el-card shadow="never" class="mt-4">
    <template #header>
      <span class="font-semibold">📈 日志类型分布</span>
    </template>
    <div ref="chartRef" style="height: 400px; width: 100%"></div>
  </el-card>
</template>

<script setup>
import * as echarts from 'echarts'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  logs: { eventType: Array, required: true }
})

const chartRef = ref(null)
let chartInstance = null

const initChart = () => {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  renderChart()
  window.addEventListener('resize', () => chartInstance.resize())
}

const renderChart = () => {
  const countByType = props.logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1
    return acc
  }, {})

  const option = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 10 },
    series: [
      {
        name: '日志类型',
        type: 'pie',
        radius: '60%',
        data: Object.entries(countByType).map(([type, count]) => ({
          name: type,
          value: count
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0,0,0,0.3)'
          }
        }
      }
    ]
  }
  chartInstance.setOption(option)
}

watch(() => props.logs, renderChart, { deep: true })
onMounted(initChart)
onBeforeUnmount(() => {
  chartInstance?.dispose()
})
</script>
