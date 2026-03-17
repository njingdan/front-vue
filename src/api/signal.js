import { get, getServerUrl } from '@/axios/request'

const base = '/api/signal'

// 获取最新波形
export function fetchLatestWaveform() {
  return get(base + '/waveform');
}

// 订阅波形 SSE 流
export function subscribeWaveform(callback) {
  const eventSource = new EventSource(`http://localhost:8000${base}/stream`);
  console.log(base + '/stream');

  eventSource.addEventListener('signal', (event) => {
    const data = JSON.parse(event.data);
    callback(data);
  });

  eventSource.onerror = (err) => {
    console.error('SSE connection error:', err);
  };

  return eventSource;
}
