<script setup>
import {
    Document,
    Menu as IconMenu,
    Location,
    Setting,
    Operation,
    Open,
    DataLine,
    Key,
    Notebook,
    Tools,
    Message,
    Promotion,
    HomeFilled,
    OfficeBuilding
} from '@element-plus/icons-vue'

import { ref,computed } from 'vue'

import { useRouter } from 'vue-router'


import { useSidebarStore } from '@/store/sidebarStore'
import { storeToRefs } from 'pinia'

const sidebarStore = useSidebarStore()

const { isExpanded } = storeToRefs(sidebarStore)
const isCollapse = computed(() => !isExpanded.value) // 使用computed保持响应式关联

const handleOpen = (key, keyPath) => {
    // console.log(key, keyPath)
}
const handleClose = (key, keyPath) => {
    // console.log(key, keyPath)
}
</script>

<template>

    <el-row class="sidebar-container">

        <el-col  class="sidebar-col">
            

            <el-menu :collapse="isCollapse" router default-active="/" class="sidebar-menu" @open="handleOpen" @close="handleClose">

                <el-menu-item index="/">
                    <el-icon><icon-menu /></el-icon>
                    <span>主面板</span>
                </el-menu-item>



                <el-menu-item index="/module/key-negotiation">
                    <el-icon><Promotion /></el-icon>
                    <span>秘钥协商</span>
                </el-menu-item>

                <el-sub-menu index="/module">
                    <template #title>
                       <el-icon><Tools /></el-icon>
                        <span>管理模块</span>
                    </template>

                    <!-- 子菜单 -->
                    <el-menu-item index="/module/collect"><el-icon><DataLine /></el-icon>信号采集</el-menu-item>
                    <el-menu-item index="/module/key-manage"><el-icon><Key /></el-icon>秘钥管理</el-menu-item>
                    <el-menu-item index="/module/encrypt"><el-icon><Message /></el-icon>数据包加密</el-menu-item>
                    <el-menu-item index="/module/auth"><el-icon><OfficeBuilding /></el-icon>设备日志</el-menu-item>
                    <el-menu-item index="/module/log"><el-icon><Notebook /></el-icon>日志管理</el-menu-item>
                    <!-- <el-menu-item index="/module/test">测试</el-menu-item> -->
                </el-sub-menu>


                <!-- <el-menu-item index="3">
                    <el-icon>
                        <setting />
                    </el-icon>
                    <span>其他</span>
                </el-menu-item> -->
            </el-menu>

        </el-col>

    </el-row>

</template>

<style scoped>

.el-menu{
    background-color: #fff;
}

.el-sub-menu{
    background-color: #fff;
}

.el-menu-item {
    background-color: #fff;
}

/* 容器占满左侧高度 */
.sidebar-container {
  height: 100vh; /* 占满视口高度 */
  margin: 0; /* 清除默认margin */
  padding: 0; /* 清除默认padding */
}

.sidebar-col {
  height: 100%; /* 继承父容器高度 */
  background-color: blue; /* 可选：统一背景色 */
}

/* 菜单样式调整 */
.sidebar-menu {
  height: 100%; /* 菜单占满父容器高度 */
}



</style>