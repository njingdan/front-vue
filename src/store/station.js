// 安装Pinia：npm install pinia
import { defineStore } from 'pinia';

export const useStationStore = defineStore('station', {
  state: () => ({
    stationName: '' // 存储当前需要打开的储能柜ID
  }),
  actions: {
    // 设置stationName
    setStationName(name) {
      this.stationName = name;
    },
    // 清空stationName
    clearStationName() {
      this.stationName = '';
    }
  }
});