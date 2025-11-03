// src/api/authRecord.js

import request from '@/axios/request'

const base = '/api/auth-records'

/**
 * 获取设备认证记录列表（分页）
 * @param {number} page 当前页码，默认 1
 * @param {number} size 每页条数，默认 10
 * @returns {Promise<Object>} 返回分页结果 { records: [...], total: 100 }
 */
export function getAuthRecords(page = 1, size = 5) {
  return request.get(`${base}/get_list`, { page, size })
}

/**
 * 添加设备认证记录
 * @param {Object} record - 认证记录对象
 * {
 *   deviceId: string,
 *   result: 'success' | 'failure',
 *   similarity?: number
 * }
 */
export function addAuthRecord(record) {
  return request.post(`${base}/add_record`, record)
}

/**
 * 获取认证记录统计信息
 * @returns {Promise<Object>} 返回 { resultStats: [...], averageSimilarity: number }
 */
export function getAuthStatistics() {
  return request.get(`${base}/statistics`)
}

export default {
  getAuthRecords,
  addAuthRecord,
  getAuthStatistics
}
