// src/api/key-manage.js
import { get } from '@/axios/request.js';

/**
 * 密钥池管理相关API
 */
const keyManageApi = {
  /**
   * 获取所有充电桩密钥池状态
   * @returns {Promise}
   */
  getKeyPools: () => {
    return get('/api/key-management/pools');
  },

  /**
   * 获取指定充电桩的密钥池详细信息
   * @param {string} stationId - 充电桩ID
   * @returns {Promise}
   */
  getStationDetail: (stationId) => {
    return get(`/api/key-management/pools/${stationId}`);
  },

  /**
   * 获取当前告警列表
   * @returns {Promise}
   */
  getAlerts: () => {
    return get('/api/key-management/alerts');
  },

  /**
   * 获取所有密钥池完整快照
   * @returns {Promise}
   */
  getSnapshot: () => {
    return get('/api/key-management/snapshot');
  },

  /**
   * 获取具体量子密钥数据信息
   * @returns {Promise}
   */
  getKeyMaterials: () => {
    return get('/api/key-management/keys');
  },

  /**
   * 获取指定充电桩的静态密钥数据
   * @param {string} stationId - 充电桩ID
   * @returns {Promise}
   */
  getStaticKeys: (stationId) => {
    return get(`/api/key-management/pools/${stationId}/keys/static`);
  }
};

export default keyManageApi;