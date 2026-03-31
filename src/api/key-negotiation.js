import { get, post } from '../axios/request';

// 获取储能柜协商数据
export function getCabinetNegotiation(cabinetId) {
  return get('/api/key-negotiate/getCabinetNegotiation', { cabinetId });
}

// 获取协商状态
export function getNegotiateStatus(cabinetId) {
  return get('/api/key-negotiate/getNegotiateStatus', { cabinetId });
}

// 获取RSSI数据
export function getRssiData(cabinetId) {
  return get('/api/key-negotiate/getRssiData', { cabinetId });
}

// 获取单个RSSI值
export function getSingleRssiData(cabinetId, rssi = 100) {
  return post('/api/key-negotiate/getSingleRssiData', { cabinetId, rssi });
}

export default {
  getCabinetNegotiation,
  getNegotiateStatus,
  getRssiData,
  getSingleRssiData
};