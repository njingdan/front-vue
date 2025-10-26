<template>
  <div class="topology-container">
    <el-row class="main-content" :gutter="20">
      <!-- 左侧筛选面板 -->
      <el-col :xs="24" :sm="8" :md="6" :lg="5" :xl="4">
        <el-card class="filter-panel">
          <div slot="header" class="panel-header">
            <span>筛选面板</span>
          </div>

          <div class="filter-content">
            <!-- 图例说明 -->
            <div class="legend-section">
              <h4 class="section-title">图例说明</h4>
              <div class="legend-item">
                <span class="legend-dot gateway" /> 安全网关
              </div>
              <div class="legend-item">
                <span class="legend-dot switch" /> 交换机
              </div>
              <div class="legend-item">
                <span class="legend-dot server" /> 服务器
              </div>
              <div class="legend-item">
                <span class="legend-dot qkd" /> 量子密钥终端
              </div>
              <div class="legend-item">
                <span class="legend-dot bus" /> 总线
              </div>
              <div class="legend-item">
                <span class="legend-dot distributed" /> 储能柜
              </div>
              <div class="legend-line">
                <span class="line-normal" /> 正常连接
              </div>
              <div class="legend-line">
                <span class="line-transferring" /> 数据传输中
              </div>
              <div class="legend-line">
                <span class="line-fault" /> 故障连接
              </div>
            </div>

            <el-divider />

            <!-- 节点筛选 -->
            <div class="filter-section">
              <h4 class="section-title">节点筛选</h4>

              <el-form :model="filterForm" label-position="top" size="small">
                <el-form-item label="设备类型">
                  <el-select v-model="filterForm.deviceType" placeholder="全部类型" clearable @change="handleFilterChange">
                    <el-option label="全部" value="" />
                    <el-option label="安全网关" value="gateway" />
                    <el-option label="交换机" value="switch" />
                    <el-option label="服务器" value="server" />
                    <el-option label="量子密钥终端" value="qkd" />
                    <el-option label="总线" value="bus" />
                    <el-option label="储能柜" value="distributed" />
                  </el-select>
                </el-form-item>

                <el-form-item label="状态筛选">
                  <el-select v-model="filterForm.status" placeholder="全部状态" clearable @change="handleFilterChange">
                    <el-option label="全部" value="" />
                    <el-option label="正常" value="normal" />
                    <el-option label="数据传输中" value="transferring" />
                    <el-option label="故障" value="fault" />
                  </el-select>
                </el-form-item>

                <el-form-item label="搜索节点">
                  <el-input v-model="filterForm.keyword" placeholder="输入节点名称" clearable @input="handleFilterChange" />
                </el-form-item>

                <el-form-item>
                  <el-button type="primary" size="mini" class="reset-btn" @click="resetFilter">
                    重置筛选
                  </el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 中间拓扑图区域 -->
      <el-col :xs="24" :sm="16" :md="12" :lg="14" :xl="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <div>
                <h1>服务拓扑可视化</h1>
                <p class="subtitle">展示设备连接关系，支持节点查看</p>
              </div>
            </div>
          </template>

          <!-- 拓扑图主体 -->
          <div class="chart-container">
            <div ref="chartRef" class="chart" />
          </div>
        </el-card>
      </el-col>

      <!-- 右侧属性面板 -->
      <el-col :xs="24" :sm="24" :md="6" :lg="5" :xl="4">
        <el-card class="property-panel">
          <div slot="header" class="panel-header">
            <span>属性面板</span>
          </div>

          <div v-if="selectedEntity" class="property-content">
            <h3 class="entity-name">{{ selectedEntity.name }}</h3>
            <el-tag :type="getStatusTagType(selectedEntity.status)" effect="dark" size="mini">
              {{ formatStatus(selectedEntity.status) }}
            </el-tag>

            <el-descriptions column="1" border class="property-descriptions">
              <el-descriptions-item label="类型">
                {{ selectedEntity.type === 'node' ? '设备节点' : '连接链路' }}
              </el-descriptions-item>

              <!-- 节点特有属性 -->
              <template v-if="selectedEntity.type === 'node'">
                <el-descriptions-item label="节点ID">
                  {{ selectedEntity.id }}
                </el-descriptions-item>
                <el-descriptions-item label="设备类型">
                  {{ formatDeviceType(selectedEntity.deviceType) }}
                </el-descriptions-item>
                <el-descriptions-item label="连接方式" v-if="selectedEntity.connection">
                  {{ selectedEntity.connection }}
                </el-descriptions-item>
                <el-descriptions-item label="最后更新时间">
                  {{ lastUpdateTime }}
                </el-descriptions-item>

                <!-- 量子密钥信息（仅储能柜显示） -->
                <el-descriptions-item label="实时量子密钥" v-if="selectedEntity.deviceType === 'distributed'">
                  <span class="key-value">{{ realtimeKey }}</span>
                </el-descriptions-item>
              </template>

              <!-- 链路特有属性 -->
              <template v-if="selectedEntity.type === 'edge'">
                <el-descriptions-item label="连接方向">
                  {{ formatDeviceType(selectedEntity.sourceType) }} → {{ formatDeviceType(selectedEntity.targetType) }}
                </el-descriptions-item>
                <el-descriptions-item label="连接类型">
                  {{ selectedEntity.name }}
                </el-descriptions-item>
                <el-descriptions-item label="两端节点">
                  {{ selectedEntity.sourceName }} → {{ selectedEntity.targetName }}
                </el-descriptions-item>
              </template>
            </el-descriptions>

            

            
          </div>

          <div v-else class="property-placeholder">
            <el-empty description="选择节点或连接查看详情" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import * as echarts from 'echarts';

// 图表容器引用
const chartRef = ref(null);
let myChart = null;
let zoomLevel = 1; // 缩放级别控制

// 属性面板数据
const selectedEntity = ref(null);
const realtimeKey = ref('');
const lastUpdateTime = ref('');

// 筛选表单数据
const filterForm = reactive({
  deviceType: '',
  status: '',
  keyword: ''
});

// 节点指标数据
const nodeMetrics = reactive({
  load: 0,
  signal: 0
});

// 原始数据存储 - 增加类型映射确保筛选后尺寸一致
const nodeTypeConfig = {
  'gateway': { size: 60 },
  'switch': { size: 60 },
  'server': { size: 50 },
  'qkd': { size: [80, 40], symbol: 'rect' },
  'bus': { size: [400, 8], symbol: 'rect' },
  'distributed': { size: 45 }
};

// 原始数据存储
const originalNodes = ref([]);
const originalLinks = ref([]);
const filteredNodes = ref([]);
const filteredLinks = ref([]);

// 定义渲染函数
const renderChart = ref(null);

// 定时器变量
let simulationTimer = null;
let flowAnimationTimer = null;
let metricsUpdateTimer = null;

// 统一颜色规范
const LINK_COLORS = {
  normal: '#10b981',    // 绿色 - 联通
  transferring: '#3b82f6', // 蓝色 - 数据流过
  fault: '#ef4444'      // 红色 - 故障
};

// 流动动画状态管理
const flowState = reactive({
  phase: 0
});

// 格式化设备类型显示
const formatDeviceType = (type) => {
  const typeMap = {
    'distributed': '分布式储能柜',
    'gateway': '安全网关',
    'switch': '交换机',
    'server': '服务器',
    'qkd': '量子密钥终端',
    'bus': '总线'
  };
  return typeMap[type] || '未知设备';
};

// 格式化状态显示
const formatStatus = (status) => {
  const statusMap = {
    'normal': '正常',
    'transferring': '数据传输中',
    'fault': '故障'
  };
  return statusMap[status] || '未知状态';
};

// 获取状态标签类型
const getStatusTagType = (status) => {
  const tagMap = {
    'normal': 'success',
    'transferring': 'info',
    'fault': 'danger'
  };
  return tagMap[status] || 'warning';
};

// 获取节点指标状态
const getNodeMetricStatus = (value) => {
  if (value > 80) return 'success';
  if (value > 50) return 'warning';
  return 'exception';
};

// 更新节点指标数据
const updateNodeMetrics = () => {
  if (!selectedEntity.value || selectedEntity.value.type !== 'node') return;

  nodeMetrics.load = Math.floor(Math.random() * 30) + 50; // 50-80之间随机值
  nodeMetrics.signal = Math.floor(Math.random() * 40) + 60; // 60-100之间随机值
  lastUpdateTime.value = new Date().toLocaleTimeString();
};

// 处理筛选条件变化
const handleFilterChange = () => {
  filterNodesAndLinks();
  renderChart.value();
};

// 重置筛选条件
const resetFilter = () => {
  filterForm.deviceType = '';
  filterForm.status = '';
  filterForm.keyword = '';
  filterNodesAndLinks();
  renderChart.value();
};

// 筛选节点和链路 - 确保节点大小一致且位置固定
const filterNodesAndLinks = () => {
  // 筛选节点 - 保留原始位置和尺寸
  filteredNodes.value = originalNodes.value.filter(node => {
    // 设备类型筛选
    if (filterForm.deviceType && node.deviceType !== filterForm.deviceType) {
      return false;
    }

    // 状态筛选（仅储能柜有状态）
    if (filterForm.status && node.deviceType === 'distributed' && node.status !== filterForm.status) {
      return false;
    }

    // 关键词筛选
    if (filterForm.keyword && !node.name.includes(filterForm.keyword)) {
      return false;
    }

    return true;
  }).map(node => ({
    ...node,
    // 强制使用类型配置的尺寸，确保筛选后大小一致
    symbolSize: nodeTypeConfig[node.deviceType].size,
    symbol: nodeTypeConfig[node.deviceType].symbol || 'circle'
  }));

  // 筛选链路（只保留两端节点都在筛选结果中的链路）
  const nodeIds = new Set(filteredNodes.value.map(node => node.id));
  filteredLinks.value = originalLinks.value.filter(link =>
    nodeIds.has(link.source) && nodeIds.has(link.target)
  );
};

// 重置视图
const resetView = () => {
  if (myChart) {
    zoomLevel = 1;
    myChart.dispatchAction({ type: 'restore' });
  }
};

// 放大
const zoomIn = () => {
  if (myChart) {
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    myChart.dispatchAction({ type: 'graphRoam', zoom: zoomLevel });
  }
};

// 缩小
const zoomOut = () => {
  if (myChart) {
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    myChart.dispatchAction({ type: 'graphRoam', zoom: zoomLevel });
  }
};

onMounted(async () => {
  // 等待DOM渲染完成
  await nextTick();

  // 创建基础节点数据 - 固定位置和尺寸
  const createNodes = () => {
    const baseNodes = [
      {
        id: 'gatewayB',
        name: '安全网关B',
        x: 100, y: 100, // 固定位置
        deviceType: 'gateway',
        itemStyle: { borderColor: '#4895ef', borderWidth: 2, color: '#4895ef' },
        label: { color: '#000', position: 'center', fontSize: 12 }
      },
      {
        id: 'switch',
        name: '交换机',
        x: 100, y: 220, // 固定位置
        deviceType: 'switch',
        itemStyle: { borderColor: '#64748b', borderWidth: 2, color: '#64748b' },
        label: { color: '#000', position: 'center', fontSize: 12 }
      },
      {
        id: 'serialServer',
        name: '串口服务器',
        x: 100, y: 340, // 固定位置
        deviceType: 'server',
        itemStyle: { borderColor: '#94a3b8', borderWidth: 2, color: '#94a3b8' },
        label: { color: '#000', position: 'center', fontSize: 12 }
      },
      {
        id: 'qkd1',
        name: '量子密钥分配终端\n（上层）',
        x: 300, y: 100, // 固定位置
        deviceType: 'qkd',
        itemStyle: { borderColor: '#f59e0b', borderWidth: 2, color: '#f59e0b' },
        label: { color: '#000', position: 'center', fontSize: 10 }
      },
      {
        id: 'qkd2',
        name: '量子密钥分配终端\n（储能区）',
        x: 300, y: 220, // 固定位置
        deviceType: 'qkd',
        itemStyle: { borderColor: '#f59e0b', borderWidth: 2, color: '#f59e0b' },
        label: { color: '#000', position: 'center', fontSize: 10 }
      },
      {
        id: 'distributedBus',
        name: '储能区总线',
        x: 450, y: 400, // 固定位置
        deviceType: 'bus',
        itemStyle: { borderColor: '#64748b', borderWidth: 1, color: '#e2e8f0' },
        label: { color: '#000', position: 'top', fontSize: 12 }
      }
    ];

    // 储能柜布局 - 固定位置
    const distributedNodes = [
      { id: 'distributed1', name: '储能柜1', x: 300, y: 480, deviceType: 'distributed', status: 'normal', connection: 'RS485', itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 } },
      { id: 'distributed2', name: '储能柜2', x: 380, y: 480, deviceType: 'distributed', status: 'normal', connection: 'RS485', itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 } },
      { id: 'distributed3', name: '储能柜3', x: 460, y: 480, deviceType: 'distributed', status: 'normal', connection: 'RS485', itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 } },
      { id: 'distributed4', name: '储能柜4', x: 340, y: 540, deviceType: 'distributed', status: 'normal', connection: 'RS485', itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 } },
      { id: 'distributed5', name: '储能柜5', x: 420, y: 540, deviceType: 'distributed', status: 'normal', connection: 'RS485', itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 } },
      { id: 'distributed6', name: '储能柜6', x: 500, y: 540, deviceType: 'distributed', status: 'normal', connection: 'RS485', itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 } }
    ];

    return [...baseNodes, ...distributedNodes];
  };

  // 创建连线数据
  const createLinks = () => {
    return [
      {
        source: 'switch',
        target: 'gatewayB',
        name: '光纤',
        status: 'normal',
        lineStyle: { width: 3, opacity: 0.7 }
      },
      {
        source: 'qkd2',
        target: 'qkd1',
        name: '无线',
        status: 'normal',
        lineStyle: { width: 2, type: 'dashed', opacity: 0.7 }
      },
      {
        source: 'gatewayB',
        target: 'qkd1',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'switch',
        target: 'qkd2',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'serialServer',
        target: 'switch',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'distributedBus',
        target: 'switch',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'distributedBus',
        target: 'serialServer',
        name: 'RS485',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      // 储能柜到总线连接
      { source: 'distributed1', target: 'distributedBus', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributed2', target: 'distributedBus', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributed3', target: 'distributedBus', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributed4', target: 'distributedBus', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributed5', target: 'distributedBus', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributed6', target: 'distributedBus', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } }
    ];
  };

  // 初始化原始数据
  originalNodes.value = createNodes();
  originalLinks.value = createLinks();
  filteredNodes.value = [...originalNodes.value];
  filteredLinks.value = [...originalLinks.value];

  // 初始化图表
  const initChart = () => {
    if (!chartRef.value) return;

    // 确保图表容器尺寸正确
    const container = chartRef.value;
    container.style.width = '100%';
    container.style.height = '100%';

    // 初始化ECharts实例
    myChart = echarts.init(container);

    // 获取图表配置 - 移除连线动画，确保初始渲染完成连接
    const getOption = (currentNodes, currentLinks) => {
      // 处理节点 - 确保尺寸一致
      const processedNodes = currentNodes.map(node => ({
        ...node,
        symbolSize: nodeTypeConfig[node.deviceType].size,
        symbol: nodeTypeConfig[node.deviceType].symbol || 'circle',
        itemStyle: node.deviceType === 'distributed'
          ? node.status === 'fault'
            ? { ...node.itemStyle, borderColor: '#ef4444', color: '#fecaca' }
            : node.status === 'transferring'
              ? { ...node.itemStyle, borderColor: '#3b82f6', color: '#dbeafe' }
              : { ...node.itemStyle, borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }
          : node.itemStyle
      }));

      // 处理连线 - 无初始动画，直接显示完整连接
      const processedLinks = currentLinks.map(link => {
        let lineColor = LINK_COLORS[link.status] || LINK_COLORS.normal;

        if (link.status === 'transferring') {
          lineColor = {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: (flowState.phase + 0) % 1, color: '#93c5fd' },
              { offset: (flowState.phase + 0.3) % 1, color: '#3b82f6' },
              { offset: (flowState.phase + 0.6) % 1, color: '#93c5fd' }
            ],
            global: false
          };
        }

        return {
          ...link,
          lineStyle: {
            ...link.lineStyle,
            color: lineColor,
            width: link.status === 'transferring' ? 4 : (link.lineStyle.width || 2),
            type: link.status === 'transferring' ? 'dashed' : link.lineStyle.type,
            dashOffset: link.status === 'transferring' ? flowState.phase * 10 : 0
          },
          // 禁用连线动画
          animation: false,
          // 显示箭头表示方向
          symbol: ['none', 'arrow'],
          symbolSize: [0, 8]
        }
      });

      return {
        // 禁用全局动画，确保初始渲染完成连接
        animation: false,
        roam: true, // 启用拖拽和缩放
        roamConfig: {
          mouseWheel: true, // 允许鼠标滚轮缩放
          drag: true,       // 允许拖拽
          scaleLimit: {     // 限制缩放范围
            min: 0.5,
            max: 3
          }
        },
        grid: {
          left: '5%',
          right: '5%',
          top: '5%',
          bottom: '5%',
          containLabel: true
        },
        tooltip: {
          trigger: 'item'
        },
        series: [
          {
            type: 'graph',
            layout: 'none', // 固定布局，防止节点乱跑
            data: processedNodes,
            links: processedLinks,
            label: {
              show: true,
              color: '#000',
              fontSize: 10,
              formatter: params => params.name,
              position: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: [3, 5],
              borderRadius: 3
            },
            itemStyle: {
              borderWidth: 2
            },
            emphasis: {
              itemStyle: {
                borderColor: '#facc15',
                shadowBlur: 10
              },
              lineStyle: {
                width: 4,
                color: '#facc15'
              }
            },
            // 关闭节点拖拽，只允许视图拖拽
            draggable: false,
            // 确保连线始终显示完整
            lineStyle: {
              animation: false
            }
          }
        ]
      };
    };

    // 定义渲染图表方法
    renderChart.value = () => {
      if (!myChart) return;
      myChart.setOption(getOption(filteredNodes.value, filteredLinks.value), true);
    };

    // 初始渲染 - 直接显示完整连接
    renderChart.value();

    // 节点点击事件
    myChart.on('click', (params) => {
      if (params.dataType === 'node') {
        // 节点点击 - 更新属性面板
        selectedEntity.value = {
          ...params.data,
          type: 'node'
        };
        updateNodeMetrics();

        if (params.data.deviceType === 'distributed') {
          realtimeKey.value = Math.random().toString(36).substring(2, 10).toUpperCase();
        }
      }
      // 链路点击事件
      else if (params.dataType === 'edge') {
        // 链路点击 - 更新属性面板
        selectedEntity.value = {
          ...params.data,
          type: 'edge',
          name: `${params.data.source} → ${params.data.target}`,
          // 获取源节点和目标节点的类型和名称
          sourceType: originalNodes.value.find(n => n.id === params.data.source)?.deviceType,
          targetType: originalNodes.value.find(n => n.id === params.data.target)?.deviceType,
          sourceName: originalNodes.value.find(n => n.id === params.data.source)?.name,
          targetName: originalNodes.value.find(n => n.id === params.data.target)?.name
        };
      }
    });

    // 窗口大小调整
    const handleResize = () => {
      if (myChart && !myChart.isDisposed()) {
        myChart.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    // 组件卸载时清理事件
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });
  };

  // 初始化图表
  initChart();

  // 流动动画效果 - 只针对传输中的连线
  flowAnimationTimer = setInterval(() => {
    if (!myChart || myChart.isDisposed()) {
      clearInterval(flowAnimationTimer);
      return;
    }

    flowState.phase = (flowState.phase + 0.05) % 1;
    renderChart.value();
  }, 100);

  // 状态模拟
  const simulateStatusChange = () => {
    let simulationCount = 0;

    simulationTimer = setInterval(() => {
      if (!myChart || myChart.isDisposed()) {
        clearInterval(simulationTimer);
        return;
      }

      simulationCount++;
      const mode = simulationCount % 3;

      // 重置所有状态
      originalNodes.value.forEach(node => {
        if (node.deviceType === 'distributed') {
          node.status = 'normal';
        }
      });
      originalLinks.value.forEach(link => {
        link.status = 'normal';
      });

      if (mode === 0) {
        console.log('模拟模式：正常状态');
      }
      else if (mode === 1) {
        console.log('模拟模式：数据传输');
        const distributedNodes = originalNodes.value.filter(node => node.deviceType === 'distributed');
        const dataCount = Math.floor(Math.random() * 2) + 2;

        for (let i = 0; i < dataCount; i++) {
          if (distributedNodes.length > 0) {
            const randomNode = distributedNodes[Math.floor(Math.random() * distributedNodes.length)];
            randomNode.status = 'transferring';

            const correspondingLink = originalLinks.value.find(link =>
              link.source === randomNode.id && link.target === 'distributedBus'
            );
            if (correspondingLink) {
              correspondingLink.status = 'transferring';
            }
          }
        }
      }
      else if (mode === 2) {
        console.log('模拟模式：故障状态');
        const distributedNodes = originalNodes.value.filter(node => node.deviceType === 'distributed');
        const faultCount = Math.floor(Math.random() * 2) + 1;

        for (let i = 0; i < faultCount; i++) {
          if (distributedNodes.length > 0) {
            const randomNode = distributedNodes[Math.floor(Math.random() * distributedNodes.length)];
            randomNode.status = 'fault';

            const correspondingLink = originalLinks.value.find(link =>
              link.source === randomNode.id && link.target === 'distributedBus'
            );
            if (correspondingLink) {
              correspondingLink.status = 'fault';
            }
          }
        }
      }

      // 重新筛选并渲染
      filterNodesAndLinks();
      renderChart.value();
    }, 5000);
  };

  simulateStatusChange();

  // 节点指标定时更新
  metricsUpdateTimer = setInterval(updateNodeMetrics, 3000);
});

onUnmounted(() => {
  // 清理定时器
  if (simulationTimer) clearInterval(simulationTimer);
  if (flowAnimationTimer) clearInterval(flowAnimationTimer);
  if (metricsUpdateTimer) clearInterval(metricsUpdateTimer);

  // 销毁图表
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
});
</script>

<style scoped>
.topology-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 20px;
  box-sizing: border-box;
  gap: 20px;
  margin: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  height: calc(100% - 40px);
  overflow: hidden;
}

/* 左侧筛选面板 */
.filter-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 中间图表区域 */
.chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 右侧属性面板 */
.property-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
}

.chart-actions {
  display: flex;
  gap: 5px;
}

/* 图表容器 */
.chart-container {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  padding: 15px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
}

.chart {
  width: 100%;
  height: 100%;
  min-height: 400px;
  background-color: #f8fafc;
  border-radius: 4px;
}

/* 图例样式 */
.legend-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item,
.legend-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4b5563;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.line-normal,
.line-transferring,
.line-fault {
  height: 2px;
  width: 24px;
  display: inline-block;
}

/* 图例颜色定义 */
.gateway {
  background-color: #4895ef;
}

.switch {
  background-color: #64748b;
}

.server {
  background-color: #94a3b8;
}

.qkd {
  background-color: #f59e0b;
}

.bus {
  background-color: #e2e8f0;
}

.distributed {
  background-color: #d1fae5;
}

.line-normal {
  background-color: #10b981;
}

.line-transferring {
  background-color: #3b82f6;
}

.line-fault {
  background-color: #ef4444;
}

/* 属性面板样式 */
.property-content {
  padding: 10px 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100% - 50px);
  overflow-y: auto;
}

.entity-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.property-descriptions {
  font-size: 13px;
  margin-bottom: 10px;
}

.property-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.key-value {
  font-family: monospace;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
}

.metrics-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px 0;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.metric-label {
  font-size: 13px;
  color: #606266;
}

/* 响应式布局调整 */
@media (max-width: 768px) {
  .topology-container {
    padding: 10px;
  }

  .main-content {
    height: calc(100% - 20px);
  }

  .chart-container {
    padding: 10px;
  }
}
</style>
/* 确保在移动设备上图表能够自适应 */