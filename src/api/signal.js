import axios from 'axios'
import { get, getServerUrl } from '@/axios/request'

const base = '/api/signal'

const buildSignalUrl = (path, params = {}) => {
  const url = new URL(path, getServerUrl())

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

export function fetchLatestWaveform() {
  return get(base + '/waveform')
}

export function fetchSignalParserStatus() {
  return get(base + '/upload/parser-status')
}

export function fetchSignalUploadProgress(uploadId) {
  return get(base + '/upload/progress', { uploadId })
}

export async function uploadSignalChunk(
  {
    uploadId,
    chunkIndex,
    totalChunks,
    offset,
    fileName,
    chunk
  },
  options = {}
) {
  const formData = new FormData()
  formData.append('uploadId', uploadId)
  formData.append('chunkIndex', String(chunkIndex))
  formData.append('totalChunks', String(totalChunks))
  formData.append('offset', String(offset))
  formData.append('fileName', fileName)
  formData.append('file', chunk)

  return axios.post(buildSignalUrl(`${base}/upload/chunk`), formData, {
    withCredentials: true,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: options.onUploadProgress
  })
}

export async function completeSignalUpload(uploadId) {
  return axios.post(
    buildSignalUrl(`${base}/upload/complete`, { uploadId }),
    null,
    { withCredentials: true }
  )
}

export function subscribeWaveform(handlers = {}) {
  const eventSource = new EventSource(buildSignalUrl(`${base}/stream`), {
    withCredentials: true
  })

  eventSource.onopen = () => {
    handlers.onOpen?.()
  }

  eventSource.addEventListener('signal', (event) => {
    const data = JSON.parse(event.data)
    handlers.onSignal?.(data)
  })

  eventSource.onerror = (err) => {
    handlers.onError?.(err)
  }

  return eventSource
}

export function subscribeWaveformReplay(params = {}, handlers = {}) {
  const eventSource = new EventSource(buildSignalUrl(`${base}/stream/replay`, params), {
    withCredentials: true
  })

  eventSource.onopen = () => {
    handlers.onOpen?.()
  }

  eventSource.addEventListener('signal', (event) => {
    const data = JSON.parse(event.data)
    handlers.onSignal?.(data)
    if (data?.type === 'FINAL') {
      handlers.onFinal?.(data)
    }
  })

  eventSource.onerror = (err) => {
    handlers.onError?.(err)
  }

  return eventSource
}
