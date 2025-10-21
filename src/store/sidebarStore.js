// stores/sidebarStore.js
import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebar', {
  state: () => ({
    // 侧边栏是否展开的状态
    isExpanded: false//默认折叠
  }),
  actions: {
    // 切换侧边栏展开状态的方法
    toggleSidebar() {
      this.isExpanded = !this.isExpanded
    },
    // 手动设置展开状态
    setExpanded(status) {
      this.isExpanded = status
    }
  },
  getters: {
    // 可以根据需要添加计算属性
    sidebarStatus(state) {
      return state.isExpanded ? 'expanded' : 'collapsed'
    }
  }
})