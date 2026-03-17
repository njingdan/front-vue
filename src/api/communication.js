import request from '@/axios/request';

export function getRecentPackets() {
  return request.get('/api/communication/data-packets');
}

export function getSnapshot() {
  return request.get('/api/communication/packets/snapshot');
}
