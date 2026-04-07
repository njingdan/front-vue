import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "\u4e3b\u9762\u677f",
      component: () => import("@/layout/Main.vue"),
    },
    {
      path: "/module",
      children: [
        {
          path: "collect",
          name: "\u4fe1\u53f7\u91c7\u96c6",
          component: () => import("@/views/SignalMonitor.vue"),
        },
        {
          path: "key-manage",
          name: "\u5bc6\u94a5\u7ba1\u7406",
          component: () => import("@/views/KeyManagement.vue"),
          meta: {
            stationId: "",
          },
        },
        {
          path: "key-negotiation",
          name: "\u5bc6\u94a5\u534f\u5546",
          component: () => import("@/views/KeyNegotiation.vue"),
        },
        {
          path: "device-auth",
          name: "\u8bbe\u5907\u8ba4\u8bc1",
          component: () => import("@/views/DeviceAuthentication.vue"),
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
        { path: "test", component: () => import("@/views/SignalUploadTest.vue") },
      ],
    },
  ],
});

export default router;
