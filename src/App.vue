<template>

    <div class="common-layout">
      <el-container>
        <el-aside width="200px">
          <Aside />
        </el-aside>
        <el-container>
          <!-- <el-header>
            <Header />
          </el-header> -->
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

</script>

<style>
#app {
  width: 100vw;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f5f5f5;
}
</style>