<template>
  <div class="signal-monitor-page">
    <section class="toolbar-card">
      <div class="toolbar-main">
        <div>
          <p class="eyebrow">Signal Monitor</p>
          <p style="font-size: 0.875rem;">Live Waveform Rendering</p>
        </div>

        <div class="toolbar-status">
          <span class="status-pill" :class="`status-${playbackState}`">{{ playbackStatus.text }}</span>
          <span class="toolbar-meta">{{ formattedTimestamp }}</span>
        </div>
      </div>

      <div class="stats-row">
        <div v-for="item in compactStats" :key="item.label" class="stat-chip">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    </section>

    <section class="chart-card">

      <WaveformChart :waveform="waveform" :playback-state="playbackState" :transition-ms="40" />

      <div class="chart-footer">
        <div class="summary-item">
          <span>Visible</span>
          <strong>{{ displayedPointCount.toLocaleString() }}</strong>
        </div>
        <div class="summary-item">
          <span>Peak</span>
          <strong>{{ formatNumber(amplitudeStats.max) }}</strong>
        </div>
        <div class="summary-item">
          <span>Floor</span>
          <strong>{{ formatNumber(amplitudeStats.min) }}</strong>
        </div>
        <div class="summary-item">
          <span>Average</span>
          <strong>{{ formatNumber(amplitudeStats.average) }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import WaveformChart from '@/components/WaveformChart.vue'
import { fetchLatestWaveform, fetchSignalParserStatus, subscribeWaveform } from '@/api/signal'

const createEmptyWaveform = () => ({
  real: [],
  imaginary: [],
  amplitudes: [],
  timestamp: null,
  type: 'IDLE'
})

const waveform = ref(createEmptyWaveform())
const playbackState = ref('idle')
const latestTimestamp = ref(null)
const replayFrames = ref(0)
const errorMessage = ref('')

const pendingQueueSize = ref(0)
const activeUploadId = ref('')

let eventSource = null
let parserStatusTimer = null
let reconnectTimer = null

const normalizeWaveform = (payload) => {
  const raw = payload?.data ?? payload ?? {}
  const parseSeries = (series) =>
    Array.isArray(series)
      ? series.map((item) => Number(item)).filter((item) => Number.isFinite(item))
      : []

  return {
    real: parseSeries(raw.real),
    imaginary: parseSeries(raw.imaginary),
    amplitudes: parseSeries(raw.amplitudes),
    timestamp: raw.timestamp ?? Date.now(),
    type: raw.type ?? 'REALTIME'
  }
}

const closeStream = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

const connectStream = () => {
  closeStream()
  eventSource = subscribeWaveform({
    onOpen: () => {
      if (playbackState.value === 'idle') {
        playbackState.value = 'queued'
      }
    },
    onSignal: (payload) => {
      const next = normalizeWaveform(payload)
      waveform.value = next
      latestTimestamp.value = next.timestamp
      replayFrames.value += 1
      errorMessage.value = ''
      playbackState.value = next.type === 'FINAL' ? 'completed' : 'playing'
    },
    onError: () => {
      if (!eventSource) {
        return
      }
      playbackState.value = 'error'
      errorMessage.value = 'SSE stream interrupted, reconnecting...'
      closeStream()
      reconnectTimer = window.setTimeout(connectStream, 1800)
    }
  })
}

const refreshParserStatus = async () => {
  try {
    const response = await fetchSignalParserStatus()
    const parser = response?.data?.data ?? {}
    pendingQueueSize.value = Number(parser.pendingQueueSize) || 0
    activeUploadId.value = parser.activeUploadId || ''

    if (playbackState.value === 'queued' && activeUploadId.value) {
      playbackState.value = 'playing'
    }
  } catch (error) {
    console.warn('Failed to fetch parser status:', error)
  }
}

const startParserPolling = () => {
  if (parserStatusTimer) {
    clearInterval(parserStatusTimer)
  }
  parserStatusTimer = setInterval(refreshParserStatus, 1500)
}

const loadWaveformSnapshot = async () => {
  try {
    const response = await fetchLatestWaveform()
    const snapshot = normalizeWaveform(response?.data?.data ?? response?.data)
    if (!snapshot.amplitudes.length) {
      return
    }
    waveform.value = snapshot
    latestTimestamp.value = snapshot.timestamp
    playbackState.value = snapshot.type === 'FINAL' ? 'completed' : 'playing'
  } catch (error) {
    console.warn('Failed to load waveform snapshot:', error)
  }
}

const amplitudeStats = computed(() => {
  const values = waveform.value.amplitudes
  if (!values.length) {
    return { min: null, max: null, average: null }
  }

  let min = values[0]
  let max = values[0]
  let sum = 0
  values.forEach((value) => {
    if (value < min) min = value
    if (value > max) max = value
    sum += value
  })
  return { min, max, average: sum / values.length }
})

const playbackStatusMap = {
  idle: { text: 'Idle' },
  queued: { text: 'Queued' },
  playing: { text: 'Parsing' },
  completed: { text: 'Completed' },
  error: { text: 'Error' }
}

const playbackStatus = computed(() => playbackStatusMap[playbackState.value] || playbackStatusMap.idle)

const formattedTimestamp = computed(() => {
  if (!latestTimestamp.value) {
    return 'Waiting for waveform stream'
  }
  return `Latest frame: ${new Date(latestTimestamp.value).toLocaleString()}`
})

const displayedPointCount = computed(() => waveform.value.amplitudes.length)

const compactStats = computed(() => [
  { label: 'Visible', value: displayedPointCount.value.toLocaleString() },
  { label: 'Frames', value: replayFrames.value.toLocaleString() },
  { label: 'Active Upload', value: activeUploadId.value || '--' },
])

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return Number(value).toFixed(4)
}

onMounted(async () => {
  await loadWaveformSnapshot()
  connectStream()
  await refreshParserStatus()
  startParserPolling()
})

onUnmounted(() => {
  closeStream()
  if (parserStatusTimer) {
    clearInterval(parserStatusTimer)
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
})
</script>

<style scoped>
.signal-monitor-page {
  min-height: 100vh;
  padding: 16px;
  color: #112230;
  background: linear-gradient(180deg, #f7fafc 0%, #edf3f6 100%);
  display: flex;
  flex-direction: column;
}

.toolbar-card,
.chart-card {
  border: 1px solid rgba(211, 223, 229, 0.86);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
}

.toolbar-card {
  padding: 16px;
  border-radius: 20px;
}

.toolbar-main,
.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
}

h1 {
  font-size: 1.5rem;
}

.toolbar-note,
.chart-header p {
  margin: 6px 0 0;
  color: #617786;
  line-height: 1.5;
  font-size: 0.9rem;
}

.toolbar-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 220px;
  padding: 10px 12px;
  border: 1px solid rgba(211, 223, 229, 0.92);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(250, 253, 253, 0.98), rgba(244, 248, 250, 0.98));
}

.toolbar-meta {
  color: #5b7080;
  font-size: 0.8rem;
  text-align: right;
}

.status-pill,
.soft-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}

.status-idle {
  color: #415361;
  background: rgba(148, 163, 184, 0.16);
}

.status-playing {
  color: #0f766e;
  background: rgba(20, 184, 166, 0.14);
}

.status-queued {
  color: #0b5cab;
  background: rgba(59, 130, 246, 0.14);
}

.status-completed {
  color: #0369a1;
  background: rgba(14, 165, 233, 0.14);
}

.status-error {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.14);
}

.stats-row,
.chart-footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.stat-chip,
.summary-item {
  border: 1px solid rgba(211, 223, 229, 0.92);
  background: #fdfefe;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 64px;
  padding: 10px 12px;
  border-radius: 14px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.stat-chip span,
.summary-item span {
  color: #647987;
  font-size: 0.75rem;
}

.stat-chip strong,
.summary-item strong {
  color: #102331;
  font-size: 0.98rem;
  font-weight: 700;
}

.error-banner {
  margin: 14px 0 0;
  padding: 12px 14px;
  border-radius: 16px;
  color: #991b1b;
  background: rgba(254, 226, 226, 0.9);
}

.chart-card {
  margin-top: 18px;
  padding: 16px;
  border-radius: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chart-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.soft-badge {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.08);
}

@media (max-width: 1080px) {
  .toolbar-main,
  .chart-header {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-status {
    align-items: flex-start;
  }

  .toolbar-meta {
    text-align: left;
  }
}

@media (max-width: 720px) {
  .signal-monitor-page {
    padding: 10px;
  }

  .toolbar-card,
  .chart-card {
    padding: 12px;
    border-radius: 18px;
  }

  .stats-row,
  .chart-footer {
    grid-template-columns: 1fr;
  }
}
</style>
