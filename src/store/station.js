// 安装Pinia：npm install pinia
import { defineStore } from 'pinia';

export const useStationStore = defineStore('station', {
  state: () => ({
    stationId: '' // 存储当前需要打开的储能柜ID
  }),
  actions: {
    // 设置stationId
    setStationId(id) {
      this.stationId = id;
    },
    // 清空stationId
    clearStationId() {
      this.stationId = '';
    }
  }
});