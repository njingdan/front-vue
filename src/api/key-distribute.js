// key-distribute.js
import { get } from '@/axios/request.js';

/**
 * 量子密钥分发相关API
 */
const keyDistributionApi = {
  /**
   * 获取量子信道当前状态
   */
  getChannelStatus() {
    return get('/api/key-distribution/channel');
  },

  /**
   * 获取分发流程日志
   */
  getProcessLogs() {
    return get('/api/key-distribution/process');
  },

  /**
   * 获取当前分发进度
   */
  getDistributionProgress() {
    return get('/api/key-distribution/progress');
  },

  /**
   * 获取完整快照信息
   */
  getDistributionSnapshot() {
    return get('/api/key-distribution/snapshot');
  }
};

export default keyDistributionApi;