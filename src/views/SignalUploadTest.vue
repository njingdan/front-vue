<template>
  <div class="upload-test-page">
    <section class="panel">
      <header class="panel-header">
        <h1>Signal Upload Test</h1>
        <p>用于手动触发分片上传并观察后端解析与波形推送状态。</p>
      </header>

      <div class="grid">
        <label class="field">
          <span>选择文件</span>
          <input type="file" accept=".bin,application/octet-stream" @change="handleFileChange" />
        </label>

        <div class="field">
          <span>上传 ID</span>
          <strong>{{ uploadId || '--' }}</strong>
        </div>

        <div class="field">
          <span>分片大小</span>
          <strong>{{ formatSize(chunkSizeBytes) }}</strong>
        </div>

        <div class="field">
          <span>已上传分片</span>
          <strong>{{ uploadedChunks }} / {{ totalChunks }}</strong>
        </div>
      </div>

      <div v-if="selectedFile" class="file-summary">
        <span>文件: {{ selectedFile.name }}</span>
        <span>大小: {{ formatSize(selectedFile.size) }}</span>
      </div>

      <div class="actions">
        <button class="btn primary" :disabled="!selectedFile || isUploading" @click="startChunkUpload">
          {{ isUploading ? '上传中...' : '开始分片上传' }}
        </button>
        <button class="btn secondary" :disabled="!uploadId || isUploading" @click="queryUploadProgress">
          查询上传进度
        </button>
        <button class="btn ghost" @click="clearLogs">清空日志</button>
      </div>

      <div class="progress-wrap">
        <div class="progress-head">
          <span>{{ uploadStatus }}</span>
          <strong>{{ uploadProgress }}%</strong>
        </div>
        <div class="track">
          <div class="fill" :style="{ width: `${uploadProgress}%` }"></div>
        </div>
      </div>

      <div class="parser-status">
        <span>解析中: {{ activeUploadId || '--' }}</span>
        <span>排队数: {{ pendingQueueSize }}</span>
        <span>SSE 状态: {{ playbackState }}</span>
      </div>
    </section>

    <section class="panel chart-panel">
      <div class="chart-head">
        <h2>实时波形</h2>
        <span>{{ latestTimestampText }}</span>
      </div>
      <WaveformChart :waveform="waveform" :playback-state="playbackState" :transition-ms="40" />
    </section>

    <section class="panel">
      <h3>操作日志</h3>
      <div class="logs">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <span class="time">{{ log.time }}</span>
          <span class="message">{{ log.message }}</span>
        </div>
        <p v-if="!logs.length" class="empty-log">暂无日志</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import WaveformChart from '@/components/WaveformChart.vue'
import {
  completeSignalUpload,
  fetchSignalParserStatus,
  fetchSignalUploadProgress,
  subscribeWaveform,
  uploadSignalChunk
} from '@/api/signal'

const chunkSizeBytes = 2 * 1024 * 1024

const createEmptyWaveform = () => ({
  real: [],
  imaginary: [],
  amplitudes: [],
  timestamp: null,
  type: 'IDLE'
})

const selectedFile = ref(null)
const uploadId = ref('')
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('等待上传')
const uploadedChunks = ref(0)
const totalChunks = ref(0)

const waveform = ref(createEmptyWaveform())
const playbackState = ref('idle')
const latestTimestamp = ref(null)
const pendingQueueSize = ref(0)
const activeUploadId = ref('')

const logs = ref([])

let eventSource = null
let parserStatusTimer = null
let reconnectTimer = null

const appendLog = (message) => {
  const now = new Date().toLocaleTimeString()
  logs.value.unshift({ time: now, message })
  if (logs.value.length > 120) {
    logs.value.length = 120
  }
}

const clearLogs = () => {
  logs.value = []
}

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

const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

const createUploadId = () => `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

const handleFileChange = (event) => {
  const file = event.target.files?.[0] || null
  selectedFile.value = file
  if (!file) {
    return
  }
  totalChunks.value = Math.max(1, Math.ceil(file.size / chunkSizeBytes))
  uploadId.value = createUploadId()
  uploadProgress.value = 0
  uploadedChunks.value = 0
  uploadStatus.value = '文件已选择，等待上传'
  appendLog(`已选择文件: ${file.name}, 分片数: ${totalChunks.value}`)
}

const parseResponseData = (response) => response?.data?.data ?? response?.data ?? null

const queryUploadProgress = async () => {
  if (!uploadId.value) {
    return
  }

  try {
    const response = await fetchSignalUploadProgress(uploadId.value)
    const progress = parseResponseData(response) || {}
    const receivedChunks = Array.isArray(progress.receivedChunks)
      ? progress.receivedChunks.length
      : progress.receivedChunks?.length || 0

    uploadedChunks.value = receivedChunks
    totalChunks.value = progress.totalChunks || totalChunks.value
    pendingQueueSize.value = Number(progress.pendingQueueSize) || pendingQueueSize.value
    activeUploadId.value = progress.activeUploadId || activeUploadId.value

    appendLog(
      `上传进度: ${receivedChunks}/${totalChunks.value}, queued=${Boolean(progress.queuedForParsing)}, completed=${Boolean(progress.completed)}`
    )
  } catch (error) {
    appendLog(`查询进度失败: ${error?.message || 'unknown error'}`)
  }
}

const refreshParserStatus = async () => {
  try {
    const response = await fetchSignalParserStatus()
    const parser = parseResponseData(response) || {}
    pendingQueueSize.value = Number(parser.pendingQueueSize) || 0
    activeUploadId.value = parser.activeUploadId || ''
  } catch (error) {
    appendLog(`获取解析状态失败: ${error?.message || 'unknown error'}`)
  }
}

const startChunkUpload = async () => {
  if (!selectedFile.value || isUploading.value) {
    return
  }

  if (!uploadId.value) {
    uploadId.value = createUploadId()
  }

  const file = selectedFile.value
  totalChunks.value = Math.max(1, Math.ceil(file.size / chunkSizeBytes))
  uploadedChunks.value = 0
  uploadProgress.value = 0
  uploadStatus.value = '开始上传分片...'
  isUploading.value = true

  appendLog(`开始上传: uploadId=${uploadId.value}, totalChunks=${totalChunks.value}`)

  try {
    for (let chunkIndex = 0; chunkIndex < totalChunks.value; chunkIndex += 1) {
      const start = chunkIndex * chunkSizeBytes
      const end = Math.min(start + chunkSizeBytes, file.size)
      const chunk = file.slice(start, end)

      await uploadSignalChunk({
        uploadId: uploadId.value,
        chunkIndex,
        totalChunks: totalChunks.value,
        offset: start,
        fileName: file.name,
        chunk
      })

      uploadedChunks.value = chunkIndex + 1
      uploadProgress.value = Math.round((uploadedChunks.value / totalChunks.value) * 100)
      uploadStatus.value = `上传分片 ${uploadedChunks.value}/${totalChunks.value}`

      if ((chunkIndex + 1) % 10 === 0 || chunkIndex + 1 === totalChunks.value) {
        appendLog(`分片上传进度: ${uploadedChunks.value}/${totalChunks.value}`)
      }
    }

    const completeResponse = await completeSignalUpload(uploadId.value)
    const completeData = parseResponseData(completeResponse)
    uploadStatus.value = `上传完成: ${completeData || 'QUEUED'}`
    appendLog(`complete 接口返回: ${completeData || 'QUEUED'}`)

    await refreshParserStatus()
  } catch (error) {
    uploadStatus.value = '上传失败'
    appendLog(`上传失败: ${error?.response?.data?.message || error?.message || 'unknown error'}`)
  } finally {
    isUploading.value = false
  }
}

const closeWaveformStream = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

const connectWaveformStream = () => {
  closeWaveformStream()
  eventSource = subscribeWaveform({
    onOpen: () => {
      playbackState.value = 'queued'
      appendLog('SSE 已连接')
    },
    onSignal: (payload) => {
      const next = normalizeWaveform(payload)
      waveform.value = next
      latestTimestamp.value = next.timestamp
      playbackState.value = next.type === 'FINAL' ? 'completed' : 'playing'
    },
    onError: () => {
      playbackState.value = 'error'
      appendLog('SSE 中断，准备重连')
      closeWaveformStream()
      reconnectTimer = window.setTimeout(connectWaveformStream, 1800)
    }
  })
}

const latestTimestampText = computed(() =>
  latestTimestamp.value ? `最新帧: ${new Date(latestTimestamp.value).toLocaleString()}` : '等待波形数据'
)

onMounted(async () => {
  connectWaveformStream()
  await refreshParserStatus()
  parserStatusTimer = setInterval(refreshParserStatus, 1500)
})

onUnmounted(() => {
  closeWaveformStream()
  if (parserStatusTimer) {
    clearInterval(parserStatusTimer)
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
})
</script>

<style scoped>
.upload-test-page {
  min-height: 100vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: linear-gradient(180deg, #f6f9fb 0%, #edf3f7 100%);
}

.panel {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(208, 221, 229, 0.9);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
}

.panel-header h1 {
  margin: 0;
  font-size: 1.3rem;
  color: #132636;
}

.panel-header p {
  margin: 6px 0 0;
  color: #5a7180;
  font-size: 0.88rem;
}

.grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.field {
  border: 1px solid rgba(212, 223, 230, 0.95);
  border-radius: 12px;
  background: #fcfefe;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 0.78rem;
  color: #526877;
  font-weight: 700;
}

.field strong {
  font-size: 0.9rem;
  color: #193243;
  word-break: break-all;
}

.file-summary {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 0.85rem;
  color: #395061;
}

.actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  border: none;
  border-radius: 999px;
  min-height: 36px;
  padding: 0 16px;
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  color: #f5fffd;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
}

.btn.secondary {
  color: #1f3a4b;
  background: #d9e7ef;
}

.btn.ghost {
  color: #20384a;
  background: #edf3f6;
}

.progress-wrap {
  margin-top: 12px;
}

.progress-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.82rem;
  color: #3c5362;
  margin-bottom: 8px;
}

.track {
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #0f766e, #14b8a6);
  transition: width 0.2s ease;
}

.parser-status {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 0.82rem;
  color: #425b6b;
}

.chart-panel {
  min-height: 420px;
  display: flex;
  flex-direction: column;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.chart-head h2 {
  margin: 0;
  font-size: 1.05rem;
}

.chart-head span {
  font-size: 0.8rem;
  color: #607887;
}

.logs {
  margin-top: 8px;
  max-height: 240px;
  overflow: auto;
  border: 1px solid rgba(210, 224, 230, 0.95);
  border-radius: 12px;
  background: #fbfeff;
}

.log-item {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(232, 238, 242, 0.9);
  font-size: 0.8rem;
}

.log-item:last-child {
  border-bottom: none;
}

.time {
  color: #5f7887;
}

.message {
  color: #173142;
  word-break: break-word;
}

.empty-log {
  margin: 0;
  padding: 18px 12px;
  text-align: center;
  color: #7790a1;
  font-size: 0.82rem;
}

@media (max-width: 760px) {
  .upload-test-page {
    padding: 10px;
  }

  .actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .log-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
