import request, { getServerUrl } from '@/axios/request';

export function getDataPackets() {
  return request.get('/api/communication/data-packets');
}

export function getRecentPackets() {
  return getDataPackets();
}

export function getCommunicationDetail(id) {
  return request.get(`/api/communication/${id}`);
}

export function getPlainPreview(id) {
  return request.get(`/api/communication/${id}/plain-preview`);
}

export function getPlainFileUrl(id) {
  const base = getServerUrl().replace(/\/+$/, '');
  return `${base}/api/communication/${id}/plain-file`;
}

export function getSnapshot() {
  return request.get('/api/communication/packets/snapshot');
}
