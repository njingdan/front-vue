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
          component: () => import("@/views/SignalMonitor.vue"),
        },
        {
          path: "key-manage", //带参数的路由，用于传递storage ID
          name: "秘钥管理",
          component: () => import("@/views/KeyManagement.vue"),
          meta: {
            stationId: "", // 用于临时传递参数（实际通过状态管理获取）
          },
        },
        {
          path: "key-distribute",
          name: "秘钥分发",
          component: () => import("@/views/KeyDistribution.vue"),
        },
        {
          path: "encrypt",
          component: () => import("@/views/CommunicationPage.vue"),
        },
        {
          path: "auth",
          component: () => import("@/views/AuthenticationRecord.vue"),
        },
        { path: "log", component: () => import("@/views/LogManagement.vue") },
      ],
    },
  ],
});

export default router;
