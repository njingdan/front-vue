<template>

    <div class="common-layout">
      <el-container>
        <el-aside width="auto">
          <Aside />
        </el-aside>
        <el-container>
          <el-header style="padding: 0;">
            <Header />
          </el-header>
          <el-main>
            <router-view></router-view>
          </el-main>
          <el-footer>
            <Footer />
          </el-footer>
        </el-container>
      </el-container>
    </div>

</template>

<script setup>
import Aside from './layout/Aside.vue'
import Header from './layout/Header.vue';
import Footer from './layout/Footer.vue';

import { useSidebarStore } from './store/sidebarStore';

const sidebarStore = useSidebarStore();


</script>

<style>
#app {
  width: 100vw;
  height: 100vh;
  padding: 0px;
  box-sizing: border-box;
  background-color: #f5f5f5;
}

.el-aside {
  background-color: #fff;
}

.el-main {
  --el-main-padding: 0px;
}


</style>