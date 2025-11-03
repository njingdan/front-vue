<template>
  <div class="similarity-statistics-card p-6">
    <el-card shadow="hover">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold">🔍 认证成功或失败展示</span>
        </div>
      </template>

      <div ref="chartRef" style="width: 100%; height: 400px;"></div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'
import { getAuthStatistics } from '@/api/authenticationRecord'

// 图表实例
const chartRef = ref(null)
let chartInstance = null

// 加载统计数据并渲染图表
const loadStatistics = async () => {
  try {
    const res = await getAuthStatistics()

    // 构建图表数据
    const stats = res.data.resultStats || []
    const data = stats.map((s) => ({
      name: s.result === 'success' ? '成功' : '失败',
      value: s.count
    }))

    renderChart(data)
  } catch (error) {
    console.error('加载统计数据失败：', error)
  }
}

// 渲染图表
const renderChart = (data) => {
  if (!chartInstance && chartRef.value) {
    chartInstance = echarts.init(chartRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      bottom: 10,
      left: 'center'
    },
    series: [
      {
        name: '验证结果统计',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 14
        },
        labelLine: {
          show: true
        },
        data
      }
    ]
  }

  chartInstance.setOption(option)
}

onMounted(() => {
  loadStatistics()
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})
</script>

<style scoped>
.similarity-statistics-card {
  width: 100%;
}
</style>
