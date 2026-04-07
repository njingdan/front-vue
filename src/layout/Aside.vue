<script setup>
import {
  Menu as IconMenu,
  DataLine,
  Key,
  Notebook,
  Tools,
  Message,
  Promotion,
  OfficeBuilding
} from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useSidebarStore } from '@/store/sidebarStore'
import { storeToRefs } from 'pinia'

const sidebarStore = useSidebarStore()
const { isExpanded } = storeToRefs(sidebarStore)
const isCollapse = computed(() => !isExpanded.value)
const navText = {
  dashboard: '\u4e3b\u9762\u677f',
  keyNegotiation: '\u5bc6\u94a5\u534f\u5546',
  deviceAuth: '\u8bbe\u5907\u8ba4\u8bc1',
  management: '\u7ba1\u7406\u6a21\u5757',
  signalCollection: '\u4fe1\u53f7\u91c7\u96c6',
  keyManagement: '\u5bc6\u94a5\u7ba1\u7406',
  packetEncryption: '\u6570\u636e\u5305\u52a0\u5bc6',
  deviceLogs: '\u8bbe\u5907\u65e5\u5fd7',
  logs: '\u65e5\u5fd7\u7ba1\u7406'
}

const handleOpen = () => {}
const handleClose = () => {}
</script>

<template>
  <el-row class="sidebar-container">
    <el-col class="sidebar-col">
      <el-menu
        :collapse="isCollapse"
        router
        default-active="/"
        class="sidebar-menu"
        @open="handleOpen"
        @close="handleClose"
      >
        <el-menu-item index="/">
          <el-icon><icon-menu /></el-icon>
          <span>{{ navText.dashboard }}</span>
        </el-menu-item>

        <el-menu-item index="/module/key-negotiation">
          <el-icon><Promotion /></el-icon>
          <span>{{ navText.keyNegotiation }}</span>
        </el-menu-item>

        <el-menu-item index="/module/device-auth">
          <el-icon><OfficeBuilding /></el-icon>
          <span>{{ navText.deviceAuth }}</span>
        </el-menu-item>

        <el-sub-menu index="/module">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>{{ navText.management }}</span>
          </template>

          <el-menu-item index="/module/collect"><el-icon><DataLine /></el-icon>{{ navText.signalCollection }}</el-menu-item>
          <el-menu-item index="/module/key-manage"><el-icon><Key /></el-icon>{{ navText.keyManagement }}</el-menu-item>
          <el-menu-item index="/module/encrypt"><el-icon><Message /></el-icon>{{ navText.packetEncryption }}</el-menu-item>
          <el-menu-item index="/module/auth"><el-icon><OfficeBuilding /></el-icon>{{ navText.deviceLogs }}</el-menu-item>
          <el-menu-item index="/module/log"><el-icon><Notebook /></el-icon>{{ navText.logs }}</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-col>
  </el-row>
</template>

<style scoped>
.el-menu {
  background-color: #fff;
}

.el-sub-menu {
  background-color: #fff;
}

.el-menu-item {
  background-color: #fff;
}

.sidebar-container {
  height: 100vh;
  margin: 0;
  padding: 0;
}

.sidebar-col {
  height: 100%;
  background-color: blue;
}

.sidebar-menu {
  height: 100%;
}
</style>
