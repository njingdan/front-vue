<script setup>
import {
    Document,
    Menu as IconMenu,
    Location,
    Setting,
} from '@element-plus/icons-vue'

import { useRouter } from 'vue-router'
const router = useRouter()

const handleOpen = (key, keyPath) => {
    console.log(key, keyPath)
}
const handleClose = (key, keyPath) => {
    console.log(key, keyPath)
}
</script>

<template>

    <el-row class="tac">
        <el-col :span="20">
            <h5 class="mb-2" style="margin-bottom: 20px;">
                <el-text class="mx-1" size="large" type="primary">安全通信演示系统</el-text>
            </h5>
            <el-menu router default-active="/" class="el-menu-vertical-demo" @open="handleOpen" @close="handleClose">

                <el-menu-item index="/">
                    <el-icon><icon-menu /></el-icon>
                    <span>主面板</span>
                </el-menu-item>

                <el-sub-menu index="/module">
                    <template #title>
                        <el-icon>
                            <location />
                        </el-icon>
                        <span>功能模块</span>
                    </template>

                    <!-- 子菜单 -->
                    <el-menu-item index="/module/collect">信号采集</el-menu-item>
                    <el-menu-item index="/module/key-manage">秘钥管理</el-menu-item>
                    <el-menu-item index="/module/key-distribute">秘钥分发</el-menu-item>
                    <el-menu-item index="/module/encrypt">数据包加密</el-menu-item>
                    <el-menu-item index="/module/auth">设备认证</el-menu-item>
                    <el-menu-item index="/module/log">日志管理</el-menu-item>
                </el-sub-menu>


                <el-menu-item index="3">
                    <el-icon>
                        <setting />
                    </el-icon>
                    <span>其他</span>
                </el-menu-item>
            </el-menu>
        </el-col>

    </el-row>

</template>

<style scoped></style>