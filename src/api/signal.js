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

export function subscribeWaveform(callback) {
  const eventSource = new EventSource(buildSignalUrl(`${base}/stream`), {
    withCredentials: true
  })

  eventSource.addEventListener('signal', (event) => {
    const data = JSON.parse(event.data)
    callback(data)
  })

  eventSource.onerror = (err) => {
    console.error('SSE connection error:', err)
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