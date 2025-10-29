<script setup>

import { House, ArrowLeftBold, ArrowRightBold, Expand,Fold } from '@element-plus/icons-vue'
import { useSidebarStore } from '@/store/sidebarStore'
import { useRoute } from 'vue-router'


const sidebarStore = useSidebarStore()
const route = useRoute()

</script>

<template>

    <div class="header-main">
        <el-button @click="sidebarStore.toggleSidebar()">
            <!-- <el-icon><ArrowRightBold /></el-icon> -->
            <el-icon>
                <!-- 当侧边栏折叠时显示向右箭头，展开时显示向左箭头 -->
                <Expand v-if="sidebarStore.sidebarStatus === 'collapsed'" />
                <Fold v-else />
            </el-icon>
            <!-- 获取当前路由的name -->
            <!-- 显示当前路由名称（若路由配置了name） -->
        </el-button>

        <div class="current-route" v-if="route.name">
            {{ route.name }}
        </div>

        <el-text size="large" class="mx-1 ml-auto" >安全通信演示系统</el-text>
    </div>

</template>

<style scoped>
.header-main {
    width: 100%;
    height: 60px;
    background-color: #fff;

    display: flex;
    align-items: center;
    padding:0 20px;

}

.current-route {
  margin-left: 20px; /* 与按钮保持间距 */
  font-size: 16px;
  font-weight: 500;
  color: #a19e9e;
}

/* 新增自动左外边距样式 */
.ml-auto {
  margin-left: auto;
  padding-right: 60px;
}


</style>