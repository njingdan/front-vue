import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', // 根路径
      name: 'root', // 路由名称（可选）
      redirect: '/wave' // 指定根路径对应的组件
    },
    {
      path: '/wave', // 根路径
      name: 'wave', // 路由名称（可选）
      component: ()=>import('@/components/WaveformViewer.vue') // 指定根路径对应的组件
      // 如果用波形图组件作为首页，这里改为：component: WaveformViewer
    }
  ],
})

export default router
