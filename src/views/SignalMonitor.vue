<template>
  <div class="p-6">
    <div class="text-gray-500 mb-2">
      更新时间：{{ latestTimestamp ? new Date(latestTimestamp).toLocaleTimeString() : '——' }}
    </div>

    <WaveformChart :waveform="waveform" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import WaveformChart from '@/components/WaveformChart.vue'
import { fetchLatestWaveform, subscribeWaveform } from '@/api/signal'

const waveform = ref({ real: [], imaginary: [], amplitudes: [] })
const latestTimestamp = ref(null)
let eventSource = null

onMounted(async () => {
  // 获取初始数据
  try {
    const res = await fetchLatestWaveform()
    
    if (res.data) {
      waveform.value = res.data
      latestTimestamp.value = res.data.timestamp
    }
  } catch (err) {
    console.error('获取初始波形失败:', err)
  }

  // 订阅SSE
  eventSource = subscribeWaveform((data) => {
    waveform.value = data
    latestTimestamp.value = data.timestamp
  })
})

onUnmounted(() => {
  if (eventSource) eventSource.close()
})
</script>

<style scoped>
.p-6 {
  padding: 1.5rem;
}
.text-2xl {
  font-size: 1.5rem;
}
.font-semibold {
  font-weight: 600;
}
.mb-4 {
  margin-bottom: 1rem;
}
.mb-2 {
  margin-bottom: 0.5rem;
}
</style>
