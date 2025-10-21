// src/api/securityLog.js

import request from '@/axios/request'

const base = '/api/logs'

/**
 * 获取全部日志
 */
export function getLogsByPage(pageNum = 1, pageSize = 5) {
  return request.get(`${base}/splits/list`, { pageNum, pageSize })
}

/**
 * 按关键字搜索日志
 * @param {string} keyword - 搜索关键字
 */
export function searchLogs(keyword) {
  return request.get(`${base}/search`, { keyword })
}

/**
 * 导出日志
 * @param {string} type - 日志类型（可选）
 * @param {string} format - 导出格式（csv / json）
 */
export function exportLogs(type = '', format = 'csv') {
  // 这里我们直接用 axios 的 blob 方式，防止下载文件乱码
  return new Promise((resolve, reject) => {
    request.getServerUrl && console.log('Server URL:', request.getServerUrl())
    // 由于封装的 get() 不支持设置 responseType，需要直接调用 axios 实例
    import('axios').then(({ default: axios }) => {
      axios({
        url: `http://localhost:8000${base}/export`,
        method: 'get',
        params: { type, format },
        responseType: 'blob',
        headers: {
          AUTHORIZATION: window.sessionStorage.getItem('token')
        }
      })
        .then((response) => resolve(response))
        .catch((error) => reject(error))
    })
  })
}

/**
 * 添加日志
 * @param {object} log - 日志对象
 */
export function addLog(log) {
  return request.post(`${base}/add`, log)
}

export default {
  getLogsByPage,
  searchLogs,
  exportLogs,
  addLog
}
