# 安全通信演示系统-配套前端

该前端基于Vue(Vite)搭建，配套后端GitHub地址 -> https://github.com/deng0724/QKH

后端展示层通过 REST/SSE 向前端暴露数据，前端采用组件化开发，分组件展示不同模块数据。

## 前端技术栈

具体版本可见项目 packeage.json 文档

| 技术栈       | 版本   | 主要作用     | 特点/优势                       |
| :----------- | :----- | :----------- | :------------------------------ |
| Vue          | 3.5.18 | 核心前端框架 | 响应式、组件化、Composition API |
| Vite         | 7.0.6  | 构建工具     | 极速冷启动、热更新              |
| Element Plus | 2.11.4 | UI 组件库    | 丰富的桌面端组件                |
| ECharts      | 6.0.0  | 数据可视化   | 强大图表功能                    |
| Pinia        | 3.0.3  | 状态管理     | 轻量、类型安全                  |
| Vue Router   | 4.5.1  | 路由管理     | 嵌套路由、导航守卫              |
| Axios        | 1.12.2 | 处理请求     | 基于Promise                     |

## 基本命令

### 1.项目构建

通过以下命令本地下载前端依赖模块 node_modules

```sh
npm install
```

### 2.编译和开发热启动

通过以下命令本地编译和运行Vue项目

```sh
npm run dev
```

### 3.编译和生产环境压缩

```sh
npm run build
```

## 前端项目架构图

### 目录结构

```mermaid
graph TD
    root[front-demo/ 项目根目录]
    root --> public[public/ 静态资源]
    public --> indexhtml[index.html 入口HTML]
    
    root --> src[src/ 源代码核心目录]
    src --> assets[assets/ 资源文件]
    src --> axios[axios/ 网络请求配置]
    src --> components[components/ 业务组件]
    components --> c1[DataPacketEncryption.vue 数据包加密]
    components --> c2[DeviceAuthentication.vue 设备认证]
    components --> c3[KeyDistribution.vue 秘钥分发]
    components --> c4[KeyManagement.vue 秘钥管理]
    components --> c5[LogManagement.vue 日志管理]
    components --> c6[WaveformViewer.vue 波形查看器]
    
    src --> layout[layout/ 布局组件]
    src --> router[router/ 路由配置]
    src --> stores[stores/ 状态管理]
    src --> utils[utils/ 工具函数]
    src --> app[App.vue 根组件]
    src --> main[main.js 入口文件]
    
    root --> gitignore[.gitignore Git忽略配置]
    root --> package[package.json 依赖配置]
    root --> readme[README.md 项目说明]






