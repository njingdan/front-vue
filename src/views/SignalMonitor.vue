<template>
  <div class="signal-monitor-page">
    <section class="toolbar-card">
      <div class="toolbar-main">
        <div>
          <p class="eyebrow">Signal Monitor</p>
          <h1>Waveform Replay</h1>
          <p class="toolbar-note">
            Replay the SSE waveform step by step and automatically keep the final view
            focused on the latest 500 samples.
          </p>
        </div>

        <div class="toolbar-status">
          <span class="status-pill" :class="`status-${playbackState}`">{{ playbackStatus.text }}</span>
          <span class="toolbar-meta">{{ formattedTimestamp }}</span>
        </div>
      </div>

      <div class="controls-grid">
        <label class="field">
          <span>Step</span>
          <input v-model.number="replayConfig.step" type="number" min="1" max="4096" />
        </label>

        <label class="field">
          <span>Interval (ms)</span>
          <input v-model.number="replayConfig.intervalMs" type="number" min="10" max="5000" />
        </label>

        <label class="field field-window">
          <div class="field-row">
            <span>Window</span>
            <label class="switch-row">
              <input v-model="replayConfig.windowEnabled" type="checkbox" />
              <span>{{ replayConfig.windowEnabled ? 'On' : 'Off' }}</span>
            </label>
          </div>
          <input
            v-model.number="replayConfig.windowSize"
            type="number"
            min="32"
            max="20000"
            :disabled="!replayConfig.windowEnabled"
          />
        </label>

        <div class="action-group">
          <button class="primary-btn" @click="startReplay(true)">
            {{ hasReceivedFrames ? 'Restart' : 'Start' }}
          </button>
          <button class="secondary-btn" @click="stopReplay" :disabled="!canStopReplay">
            Stop
          </button>
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
      <div class="chart-header">
        <div>
          <h2>Amplitude Waveform</h2>
          <p>{{ chartSubtitle }}</p>
        </div>

        <div class="chart-badges">
          <span class="soft-badge">{{ displayModeLabel }}</span>
          <span class="soft-badge">{{ replaySpeedLabel }}</span>
        </div>
      </div>

      <WaveformChart
        :waveform="waveform"
        :playback-state="playbackState"
        :transition-ms="replayConfig.intervalMs"
      />

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
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import WaveformChart from '@/components/WaveformChart.vue'
import { fetchLatestWaveform, subscribeWaveformReplay } from '@/api/signal'

const FINAL_TAIL_POINTS = 500

const createEmptyWaveform = () => ({
  real: [],
  imaginary: [],
  amplitudes: [],
  timestamp: null,
  type: 'IDLE'
})

const trimTail = (series, size) => {
  if (!Array.isArray(series) || series.length <= size) {
    return Array.isArray(series) ? series : []
  }

  return series.slice(series.length - size)
}

const buildFinalWaveform = (nextWaveform) => ({
  ...nextWaveform,
  real: trimTail(nextWaveform.real, FINAL_TAIL_POINTS),
  imaginary: trimTail(nextWaveform.imaginary, FINAL_TAIL_POINTS),
  amplitudes: trimTail(nextWaveform.amplitudes, FINAL_TAIL_POINTS),
  type: 'FINAL'
})

const waveform = ref(createEmptyWaveform())
const latestTimestamp = ref(null)
const playbackState = ref('idle')
const replayFrames = ref(0)
const fullWaveformPoints = ref(0)
const errorMessage = ref('')
const replayConfig = reactive({
  step: 8,
  intervalMs: 40,
  windowEnabled: true,
  windowSize: 1200
})

let eventSource = null

const normalizePositiveInt = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(Math.round(parsed), min), max)
}

const syncReplayConfig = () => {
  replayConfig.step = normalizePositiveInt(replayConfig.step, 8, 1, 4096)
  replayConfig.intervalMs = normalizePositiveInt(replayConfig.intervalMs, 40, 10, 5000)
  replayConfig.windowSize = normalizePositiveInt(replayConfig.windowSize, 1200, 32, 20000)
}

const normalizeWaveform = (payload) => {
  const raw = payload?.data ?? payload ?? {}

  const mapSeries = (series) => {
    if (!Array.isArray(series)) {
      return []
    }

    return series
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
  }

  return {
    real: mapSeries(raw.real),
    imaginary: mapSeries(raw.imaginary),
    amplitudes: mapSeries(raw.amplitudes),
    timestamp: raw.timestamp ?? payload?.timestamp ?? Date.now(),
    type: raw.type ?? payload?.type ?? 'STREAM'
  }
}

const closeReplayStream = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

const formattedTimestamp = computed(() => {
  return latestTimestamp.value
    ? `Latest frame: ${new Date(latestTimestamp.value).toLocaleString()}`
    : 'Waiting for replay data'
})

const displayedPointCount = computed(() => waveform.value.amplitudes.length)
const hasReceivedFrames = computed(() => replayFrames.value > 0)
const canStopReplay = computed(() => ['connecting', 'playing'].includes(playbackState.value))
const isFinalTailView = computed(() => playbackState.value === 'completed')
const replaySpeedLabel = computed(() => {
  const pointsPerSecond = Math.round((1000 / replayConfig.intervalMs) * replayConfig.step)
  return `${pointsPerSecond.toLocaleString()} pts/sec`
})

const playbackStatusMap = {
  idle: {
    text: 'Ready',
    description: 'Tune the replay arguments and start when you are ready.'
  },
  connecting: {
    text: 'Connecting',
    description: 'The page is waiting for the first waveform frame.'
  },
  playing: {
    text: 'Playing',
    description: 'Frames are arriving and the waveform is advancing smoothly.'
  },
  completed: {
    text: 'Complete',
    description: 'Playback finished and the chart now keeps only the last 500 samples.'
  },
  stopped: {
    text: 'Stopped',
    description: 'The current view is frozen until you launch another replay.'
  },
  error: {
    text: 'Error',
    description: 'The SSE replay stream dropped. Restart after the backend is ready.'
  }
}

const playbackStatus = computed(() => {
  return playbackStatusMap[playbackState.value] || playbackStatusMap.idle
})

const displayModeLabel = computed(() => {
  if (isFinalTailView.value) {
    return `Final tail view · ${displayedPointCount.value} points`
  }

  if (replayConfig.windowEnabled) {
    return `Replay window · ${replayConfig.windowSize.toLocaleString()} points`
  }

  return 'Replay accumulation'
})

const chartSubtitle = computed(() => {
  if (isFinalTailView.value) {
    return 'The replay is complete. The chart keeps the latest 500 samples for the final view.'
  }

  return 'The waveform updates directly from each incoming signal event, keeping the page simple and easy to read.'
})

const amplitudeStats = computed(() => {
  const values = waveform.value.amplitudes
  if (!values.length) {
    return {
      min: null,
      max: null,
      average: null
    }
  }

  let min = values[0]
  let max = values[0]
  let sum = 0

  values.forEach((value) => {
    if (value < min) min = value
    if (value > max) max = value
    sum += value
  })

  return {
    min,
    max,
    average: sum / values.length
  }
})

const compactStats = computed(() => [
  {
    label: 'Visible',
    value: displayedPointCount.value.toLocaleString()
  },
  {
    label: 'Frames',
    value: replayFrames.value.toLocaleString()
  },
  {
    label: 'Full size',
    value: fullWaveformPoints.value ? fullWaveformPoints.value.toLocaleString() : 'Unknown'
  },
  {
    label: 'Window',
    value: isFinalTailView.value
      ? `Last ${FINAL_TAIL_POINTS}`
      : replayConfig.windowEnabled
        ? replayConfig.windowSize.toLocaleString()
        : 'Off'
  }
])

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return Number(value).toFixed(4)
}

const loadWaveformSummary = async () => {
  try {
    const response = await fetchLatestWaveform()
    const snapshot = normalizeWaveform(response?.data?.data ?? response?.data)

    if (snapshot.amplitudes.length) {
      fullWaveformPoints.value = snapshot.amplitudes.length
    }
  } catch (error) {
    console.warn('Failed to load waveform snapshot:', error)
  }
}

const startReplay = (resetView = true) => {
  syncReplayConfig()
  closeReplayStream()
  errorMessage.value = ''

  if (resetView) {
    waveform.value = createEmptyWaveform()
    latestTimestamp.value = null
    replayFrames.value = 0
  }

  playbackState.value = 'connecting'

  eventSource = subscribeWaveformReplay(
    {
      step: replayConfig.step,
      intervalMs: replayConfig.intervalMs,
      windowSize: replayConfig.windowEnabled ? replayConfig.windowSize : undefined
    },
    {
      onOpen: () => {
        playbackState.value = 'playing'
      },
      onSignal: (payload) => {
        const nextWaveform = normalizeWaveform(payload)
        const rawPointCount = nextWaveform.amplitudes.length

        if (rawPointCount) {
          fullWaveformPoints.value = Math.max(fullWaveformPoints.value, rawPointCount)
        }

        replayFrames.value += 1
        latestTimestamp.value = nextWaveform.timestamp

        if (nextWaveform.type === 'FINAL') {
          waveform.value = buildFinalWaveform(nextWaveform)
          playbackState.value = 'completed'
          closeReplayStream()
          return
        }

        waveform.value = nextWaveform
      },
      onError: () => {
        if (!eventSource) {
          return
        }

        playbackState.value = 'error'
        errorMessage.value = 'Replay SSE stream interrupted. Check the backend and start again.'
        closeReplayStream()
      }
    }
  )
}

const stopReplay = () => {
  closeReplayStream()
  playbackState.value = hasReceivedFrames.value ? 'stopped' : 'idle'
}

onMounted(async () => {
  await loadWaveformSummary()
  startReplay(true)
})

onUnmounted(() => {
  closeReplayStream()
})
</script>

<style scoped>
.signal-monitor-page {
  min-height: 100vh;
  padding: 24px;
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
  padding: 24px;
  border-radius: 24px;
}

.toolbar-main,
.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #0f766e;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.toolbar-card h1,
.chart-card h2 {
  margin: 0;
  font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.toolbar-card h1 {
  font-size: 2rem;
  line-height: 1.12;
}

.toolbar-note,
.chart-header p {
  margin: 10px 0 0;
  max-width: 720px;
  color: #617786;
  line-height: 1.65;
}

.toolbar-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  min-width: 220px;
  padding: 14px 16px;
  border: 1px solid rgba(211, 223, 229, 0.92);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(250, 253, 253, 0.98), rgba(244, 248, 250, 0.98));
}

.toolbar-meta {
  color: #5b7080;
  font-size: 0.92rem;
  text-align: right;
}

.status-pill,
.soft-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 14px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
}

.status-idle,
.status-stopped {
  color: #415361;
  background: rgba(148, 163, 184, 0.16);
}

.status-connecting,
.status-playing {
  color: #0f766e;
  background: rgba(20, 184, 166, 0.14);
}

.status-completed {
  color: #0369a1;
  background: rgba(14, 165, 233, 0.14);
}

.status-error {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.14);
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.field,
.action-group,
.stat-chip,
.summary-item {
  border: 1px solid rgba(211, 223, 229, 0.92);
  background: #fdfefe;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
}

.field span {
  font-size: 0.9rem;
  font-weight: 700;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.field input[type="number"] {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 12px;
  color: #112230;
  background: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.field input[type="number"]:focus {
  border-color: rgba(15, 118, 110, 0.68);
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.1);
}

.field input[type="number"]:disabled {
  background: #eef4f7;
  color: #8aa0ad;
  cursor: not-allowed;
}

.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #5b7080;
  font-size: 0.9rem;
}

.switch-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #0f766e;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
}

.primary-btn,
.secondary-btn {
  flex: 1;
  min-height: 44px;
  border: none;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.primary-btn {
  color: #f5fffd;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
}

.secondary-btn {
  color: #314452;
  background: #eaf0f4;
}

.primary-btn:hover,
.secondary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 16px;
  align-items: stretch;
}

.stat-chip,
.summary-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 8px;
  min-height: 88px;
  padding: 16px 18px;
  border-radius: 20px;
  box-sizing: border-box;
}

.stat-chip span,
.summary-item span {
  color: #647987;
  font-size: 0.88rem;
  line-height: 1.2;
}

.stat-chip strong,
.summary-item strong {
  color: #102331;
  font-size: 1.28rem;
  line-height: 1.15;
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
  padding: 22px;
  border-radius: 24px;
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

.chart-footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 16px;
  align-items: stretch;
}

@media (max-width: 1180px) {
  .controls-grid,
  .stats-row,
  .chart-footer {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

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
    padding: 14px;
  }

  .toolbar-card,
  .chart-card {
    padding: 16px;
    border-radius: 20px;
  }

  .toolbar-card h1 {
    font-size: 1.6rem;
  }

  .controls-grid,
  .stats-row,
  .chart-footer {
    grid-template-columns: 1fr;
  }

  .action-group,
  .chart-badges {
    flex-direction: column;
  }

  .primary-btn,
  .secondary-btn {
    width: 100%;
  }

  .stat-chip,
  .summary-item,
  .toolbar-status {
    min-height: auto;
  }
}
</style>
