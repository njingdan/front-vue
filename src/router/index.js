import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/", // 根路径
      name: "Dashboard", // 路由名称（可选）
      // redirect: '/wave' // 指定根路径对应的组件
      component: () => import("@/layout/Main.vue"), // 指定根路径对应的组件
    },
    {
      path: "/module",
      children: [
        {
          path: "collect",
          name: "信号采集",
          component: () => import("@/views/WaveformViewer.vue"),
        },
        {
          path: "key-manage",
          name: "秘钥管理",
          component: () => import("@/views/KeyManagement.vue"),
        },
        {
          path: "key-distribute",
          name: "秘钥分发",
          component: () => import("@/views/KeyDistribution.vue"),
        },
        {
          path: "encrypt",
          name: "数据包加密",
          component: () => import("@/views/DataPacketEncryption.vue"),
        },
        { path: "auth",name: "设备认证", component: () => import("@/views/DeviceAuthentication.vue") },
        { path: "log", name: "日志管理",component: () => import("@/views/LogManagement.vue") },
      ],
    },
  ],
});

export default router;
