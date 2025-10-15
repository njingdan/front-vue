import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/", // 根路径
      name: "root", // 路由名称（可选）
      // redirect: '/wave' // 指定根路径对应的组件
      component: () => import("@/layout/Main.vue"), // 指定根路径对应的组件
    },
    {
      path: "/module",
      children: [
        {
          path: "collect",
          component: () => import("@/views/WaveformViewer.vue"),
        },
        {
          path: "key-manage",
          component: () => import("@/views/KeyManagement.vue"),
        },
        {
          path: "key-distribute",
          component: () => import("@/views/KeyDistribution.vue"),
        },
        {
          path: "encrypt",
          component: () => import("@/views/DataPacketEncryption.vue"),
        },
        { path: "auth", component: () => import("@/views/DeviceAuthentication.vue") },
        { path: "log", component: () => import("@/views/LogManagement.vue") },
      ],
    },
  ],
});

export default router;
