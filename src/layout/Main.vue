<template>
  <div class="service-topology-page">
    <aside class="tool-sidebar">
      <el-card shadow="hover" class="sidebar-card">
        <div slot="header" class="card-header">
          <span>拓扑工具栏</span>
        </div>
        <el-form :model="toolbar" label-position="top" class="toolbar-form">
          <el-form-item label-class="custom-label">
            <div class="legend-title">布局算法</div>
            <el-radio-group v-model="toolbar.layout" size="mini">
              <el-radio-button label="force">力导向</el-radio-button>
              <el-radio-button label="grid">网格布局</el-radio-button>
              <el-radio-button label="circular">圆形</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label-class="custom-label">
            <div class="legend-title">节点筛选</div>
            <el-input v-model="toolbar.keyword" placeholder="输入设备名称" clearable />
          </el-form-item>
          <el-divider />
          <div class="legend-section">
            <div class="legend-title">设备类型</div>
            <div class="legend-item" v-for="(item, key) in deviceTypeLegend" :key="key">
              <div class="legend-icon" :style="{ backgroundImage: `url(${getDeviceIconSvg(key, '#67C23A')})` }"></div>
              {{ item.label }}
            </div>
            <el-divider />
            <div class="legend-title">链路状态</div>
            <div class="legend-item">
              <span class="legend-line normal" /> 正常联通 (绿色)
            </div>
            <div class="legend-item">
              <span class="legend-line fault" /> 故障 (红色)
            </div>
            <div class="legend-item">
              <span class="legend-line transferring" /> 数据传输中 (蓝色)
            </div>
          </div>
        </el-form>
      </el-card>
    </aside>

    <section class="canvas-wrapper">
      <div class="canvas-header">
        <div>
          <h2>拓扑可视化</h2>
        </div>
        <div class="canvas-actions">
          <el-button type="primary" :icon="icons.Refresh" @click="resetView">重置视图</el-button>
          <el-button :icon="icons.ZoomIn" @click="zoomIn">放大</el-button>
          <el-button :icon="icons.ZoomOut" @click="zoomOut">缩小</el-button>
        </div>
      </div>
      <p class="subtitle">展示设备间通信关系，支持缩放与拖拽。</p>
      <div ref="topologyChart" class="topology-canvas" />
    </section>

    <!-- 右侧固定属性面板 -->
    <aside class="property-panel">
      <el-card shadow="hover" class="sidebar-card">
        <div slot="header" class="card-header">
          <span>属性面板</span>
        </div>
        <div v-if="selectedEntity" class="property-content">
          <h3 class="entity-name">{{ selectedEntity.name }}</h3>

          <el-descriptions :column="1" border class="property-descriptions">
            <el-descriptions-item label="类型">{{ getEntityTypeName(selectedEntity) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag effect="dark" :type="selectedEntity.status === '故障' ? 'danger' :
                selectedEntity.status === '数据传输中' ? 'primary' : 'success'">
                {{ selectedEntity.status }}
              </el-tag>
            </el-descriptions-item>
            <template v-if="selectedEntity.type === 'node' && selectedEntity.deviceType === 'storage'">
              <el-descriptions-item label="总容量">{{ stationDetail.capacity || '加载中...' }}</el-descriptions-item>
              <el-descriptions-item label="剩余密钥数">{{ stationDetail.remainingKeys || '加载中...' }}</el-descriptions-item>
              <el-descriptions-item label="阈值">{{ stationDetail.threshold || '加载中...' }}</el-descriptions-item>
              <el-descriptions-item label="补充批量">{{ stationDetail.refillBatchSize || '加载中...' }}</el-descriptions-item>
              <el-descriptions-item label="密钥池状态">
                <el-tag effect="dark" :type="stationDetail.status === 'NORMAL' ? 'success' : 'warning'">
                  {{ stationDetail.status === 'NORMAL' ? '正常' : '异常' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="警告信息">{{ stationDetail.warningMessage || '无' }}</el-descriptions-item>
              <el-descriptions-item label="最后更新">
                {{ stationDetail.lastUpdated ? formatDate(stationDetail.lastUpdated) : '未知' }}
              </el-descriptions-item>
             
              <!-- 新增：管理密钥按钮 -->
              <el-descriptions-item label="管理秘钥" style="margin-top: 16px; text-align: right;">
                <el-button type="primary" @click="goToKeyManagement(selectedEntity.id)">
                  查看详情
                </el-button>
              </el-descriptions-item>
            </template>
            <el-descriptions-item v-if="selectedEntity.type === 'edge'" label="传输方向">
              {{ selectedEntity.source }} → {{ selectedEntity.target }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
        <div v-else class="property-placeholder">
          <el-empty description="选择节点或链路查看详情" />
        </div>
      </el-card>
    </aside>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { ElCol } from 'element-plus'
import keyManageApi from '@/api/key-manage.js';
import { useRouter } from 'vue-router'
import { useStationStore } from '@/store/station'; // 引入状态管理

const router = useRouter();
const stationStore = useStationStore();

// 点击“管理密钥”按钮时触发
const goToKeyManagement = (stationId) => {
  // 1. 将stationId存入状态管理
  stationStore.setStationId(stationId); // 如存入"station-6"
  // 2. 跳转至密钥管理页面（URL为/module/key-manage，无参数）
  router.push({ name: '秘钥管理' });
};

const stationDetail = ref({}); // 存储站点详细信息


// 格式化时间（兼容UTC格式）
const formatDate = (timeStr) => {
  if (!timeStr) return '未知'; // 无数据时返回未知
  try {
    const date = new Date(timeStr);
    // 检查是否为有效时间
    if (isNaN(date.getTime())) {
      return '格式错误';
    }
    // 格式化成本地时间（年月日 时分秒）
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // 24小时制
    });
  } catch (error) {
    console.error('时间格式化失败：', error);
    return '解析失败';
  }
};

// 随机状态生成函数
const getRandomStatus = () => {
  const statuses = ['正常', '故障', '数据传输中']
  return statuses[Math.floor(Math.random() * statuses.length)]
}

// 生成随机量子密钥
const generateQuantumKey = () => {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
}

// 映射图标，确保兼容性
const icons = {
  Shield: ElementPlusIconsVue.Shield || ElementPlusIconsVue.ShieldIcon,
  Key: ElementPlusIconsVue.Key || ElementPlusIconsVue.KeyIcon,
  Switch: ElementPlusIconsVue.Switch || ElementPlusIconsVue.SwitchIcon,
  Server: ElementPlusIconsVue.Server || ElementPlusIconsVue.ServerIcon,
  Link: ElementPlusIconsVue.Link || ElementPlusIconsVue.LinkIcon,
  Box: ElementPlusIconsVue.Box || ElementPlusIconsVue.BoxIcon,
  Refresh: ElementPlusIconsVue.Refresh || ElementPlusIconsVue.RefreshIcon,
  ZoomIn: ElementPlusIconsVue.ZoomIn || ElementPlusIconsVue.ZoomInIcon,
  ZoomOut: ElementPlusIconsVue.ZoomOut || ElementPlusIconsVue.ZoomOutIcon,
  HelpFilled: ElementPlusIconsVue.HelpFilled || ElementPlusIconsVue.HelpFilledIcon
}

// 设备类型图例配置
const deviceTypeLegend = {
  gateway: { label: '安全网关' },
  qkd: { label: '量子密钥终端' },
  switch: { label: '交换机' },
  server: { label: '串口服务器' },
  bus: { label: '储能区总线' },
  storage: { label: '储能柜' }
}

// 状态管理
const toolbar = ref({
  layout: 'grid', // 默认使用网格布局
  keyword: ''
})

// 提取储能柜节点便于单独处理布局
const storageCabinets = Array.from({ length: 13 }, (_, i) => ({
  id: `station-${i + 1}`,
  name: `储能柜${i + 1}`,
  status: getRandomStatus(),
  type: 'storage',
  quantumKey: generateQuantumKey(),
  index: i // 存储索引用于布局
}))

const topology = ref({
  nodes: [
    { id: 'gatewayB', name: '安全网关B', status: getRandomStatus(), type: 'gateway' },
    { id: 'qkdUpper', name: '量子密钥分配终端（上层）', status: getRandomStatus(), type: 'qkd' },
    { id: 'qkdStorage', name: '量子密钥分配终端（储能区）', status: getRandomStatus(), type: 'qkd' },
    { id: 'switch', name: '交换机', status: getRandomStatus(), type: 'switch' },
    { id: 'serialServer', name: '串口服务器', status: getRandomStatus(), type: 'server' },
    { id: 'distributedBus', name: '储能区总线', status: getRandomStatus(), type: 'bus' },
    ...storageCabinets
  ],
  links: [
    { source: 'switch', target: 'gatewayB', name: '光纤', type: 'link' },
    { source: 'qkdStorage', target: 'qkdUpper', name: '无线', type: 'link' },
    { source: 'gatewayB', target: 'qkdUpper', name: 'RJ45', type: 'link' },
    { source: 'switch', target: 'qkdStorage', name: 'RJ45', type: 'link' },
    { source: 'serialServer', target: 'switch', name: 'RJ45', type: 'link' },
    { source: 'distributedBus', target: 'switch', name: 'RJ45', type: 'link' },
    { source: 'distributedBus', target: 'serialServer', name: 'RS485', type: 'link' },
    // 储能柜向总线发送数据
    ...storageCabinets.map(cabinet => ({
      source: cabinet.id,
      target: 'distributedBus',
      name: 'RS485',
      type: 'link'
    }))
  ]
})

const chart = ref(null)
const selectedEntity = ref(null)
const zoomLevel = ref(1)
const topologyChart = ref(null)

// 过滤节点
const filteredNodes = computed(() => {
  return topology.value.nodes.filter(node => {
    if (toolbar.value.keyword && !node.name.includes(toolbar.value.keyword)) return false
    return true
  })
})

// 过滤链路
const filteredLinks = computed(() => {
  const nodeIds = new Set(filteredNodes.value.map(node => node.id))
  return topology.value.links.filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))
})

// 计算链路状态
const computedLinks = computed(() => {
  return filteredLinks.value.map(link => {
    const sourceNode = topology.value.nodes.find(n => n.id === link.source)
    const targetNode = topology.value.nodes.find(n => n.id === link.target)

    if (sourceNode?.status === '故障' || targetNode?.status === '故障') {
      return { ...link, status: '故障' }
    } else if (sourceNode?.status === '数据传输中' || targetNode?.status === '数据传输中') {
      return { ...link, status: '数据传输中' }
    } else {
      return { ...link, status: '正常' }
    }
  })
})

// 获取实体类型名称
const getEntityTypeName = (entity) => {
  if (entity.type === 'edge') return '通信链路'
  const typeMap = {
    'gateway': '安全网关',
    'qkd': '量子密钥终端',
    'switch': '交换机',
    'server': '串口服务器',
    'bus': '储能区总线',
    'storage': '储能柜'
  }
  return typeMap[entity.type] || '设备节点'
}

// 获取设备图标SVG（图表和图例共用）
const getDeviceIconSvg = (type, color = '#606266') => {
  const iconPaths = {
    'gateway': 'M384 192v160h-64V192H192v160c0 35.3 28.7 64 64 64h64v160h128V416h64c35.3 0 64-28.7 64-64V192h-128zM128 64h64v64H64V96c0-35.3 28.7-64 64-64zm576 0c35.3 0 64 28.7 64 64v32h-64V64h-64V32h64zM64 832v-32h64v64c0 35.3-28.7 64-64 64h-32v-64h32zm768 0h32v64h-64v-64h64v-32h-64v32z',
    'qkd': 'M704 416v48c0 44.2-35.8 80-80 80h-48v48c0 44.2-35.8 80-80 80h-48c-44.2 0-80-35.8-80-80v-48h-48c-44.2 0-80-35.8-80-80v-48c0-44.2 35.8-80 80-80h48v-48c0-44.2 35.8-80 80-80h48c44.2 0 80 35.8 80 80v48h48c44.2 0 80 35.8 80 80v48c0 44.2-35.8 80-80 80h-48zm-128-32c17.7 0 32-14.3 32-32s-14.3-32-32-32-32 14.3-32 32 14.3 32 32 32zm-64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32-32 14.3-32 32 14.3 32 32 32z',
    'switch': 'M384 64h128v64H384V64zm176 160c17.7 0 32 14.3 32 32v288c0 17.7-14.3 32-32 32H256c-17.7 0-32-14.3-32-32V256c0-17.7 14.3-32 32-32h208zM96 320c0-17.7 14.3-32 32-32h64v128H128c-17.7 0-32-14.3-32-32V320zm672 0c0-17.7-14.3-32-32-32h-64v128h64c17.7 0 32-14.3 32-32V320z',
    'server': 'M160 64h64v32H160V64zm-32 96h32v32h-32v-32zm192 0h32v32h-32v-32zm-96 0h32v32H128v-32zm288 0h32v32h-32v-32zm-96 0h32v32h-32v-32zm288 0h32v32h-32v-32zM96 288h32v32H96v-32zm608 0h32v32H704v-32zM96 416h32v32H96v-32zm608 0h32v32H704v-32zM96 544h32v32H96v-32zm608 0h32v32H704v-32zM160 704h64v32H160v-32zm-32-96h32v32h-32v-32zm192 0h32v32h-32v-32zm-96 0h32v32H128v-32zm288 0h32v32h-32v-32zm-96 0h32v32h-32v-32zm288 0h32v32h-32v-32zM64 64c0-17.7 14.3-32 32-32h640c17.7 0 32 14.3 32 32v640c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V64z',
    'bus': 'M832 448c0 44.2-35.8 80-80 80H272c-44.2 0-80-35.8-80-80s35.8-80 80-80h480c44.2 0 80 35.8 80 80zm0-320c0 44.2-35.8 80-80 80H272c-44.2 0-80-35.8-80-80S227.8 32 272 32h480c44.2 0 80 35.8 80 80zm0 640c0 44.2-35.8 80-80 80H272c-44.2 0-80-35.8-80-80s35.8-80 80-80h480c44.2 0 80 35.8 80 80z',
    'storage': 'M800 112H224c-26.5 0-48 21.5-48 48v624c0 26.5 21.5 48 48 48h576c26.5 0 48-21.5 48-48V160c0-26.5-21.5-48-48-48zm0 640H224V160h576v592z'
  }

  const path = iconPaths[type] || iconPaths['storage']
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 1024 1024">
      <path fill="${color}" d="${path}"/>
    </svg>
  `
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

// 获取状态对应的颜色
const getStatusColor = (status) => {
  switch (status) {
    case '正常': return '#67C23A'
    case '故障': return '#F56C6C'
    case '数据传输中': return '#409EFF'
    default: return '#909399'
  }
}

// 初始化图表
const initChart = () => {
  if (!topologyChart.value) return
  chart.value = echarts.init(topologyChart.value)

  // chart.value.on('click', params => {
  //   if (params.dataType === 'node') {
  //     selectedEntity.value = { ...params.data, type: 'node' }
  //   } else if (params.dataType === 'edge') {
  //     selectedEntity.value = { ...params.data, type: 'edge', name: `${params.data.source} → ${params.data.target}` }
  //   }
  // })
  chart.value.on('click', params => {
    if (params.dataType === 'node') {
      // 选中节点时更新选中状态
      selectedEntity.value = { ...params.data, type: 'node' };

      // 仅当点击储能柜时，调用接口调用API
      if (params.data.type === 'storage') {
        // 调用getStationDetail接口，传入储能柜ID（params.data.id）
        console.log(params.data.id)
        keyManageApi.getStationDetail(params.data.id)
          .then(res => {
            // 假设接口返回的数据结构直接包含所需字段
            console.log(res.data.data.summary);
            stationDetail.value = res.data.data.summary;
          })
          .catch(err => {
            console.error('获取站点详情失败:', err);
            stationDetail.value = { warningMessage: '获取详情失败' };
          });
      } else {
        // 非储能柜时清空详情
        stationDetail.value = {};
      }
    } else if (params.dataType === 'edge') {
      selectedEntity.value = { ...params.data, type: 'edge', name: `${params.data.source} → ${params.data.target}` };
      // 点击链路时也清空站点详情
      stationDetail.value = {};
    }
  });

  renderChart()
}

// 渲染图表
const renderChart = () => {
  if (!chart.value) return

  const nodes = filteredNodes.value.map(node => ({
    ...node,
    deviceType: node.type,
    symbol: `image://${getDeviceIconSvg(node.type, getStatusColor(node.status))}`,
    symbolSize: node.type === 'gateway' || node.type === 'switch' ? 50 :
      node.type === 'qkd' ? 45 :
        node.type === 'server' ? 40 : 35,
    label: {
      show: true,
      fontSize: 12,
      position: 'bottom',
      color: '#303133'
    }
  }))

  const links = computedLinks.value.map(link => ({
    ...link,
    lineStyle: {
      color: getStatusColor(link.status),
      width: 2.5,
      curveness: 0.2
    },
    label: {
      show: true,
      formatter: link.name,
      fontSize: 11,
      color: '#606266'
    },
    symbol: ['none', 'arrow'],
    symbolSize: [0, 8],
  }))

  const layout = toolbar.value.layout
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: params => {
        if (params.dataType === 'node') {
          return `设备：${params.data.name}<br/>类型：${getEntityTypeName(params.data)}<br/>状态：${params.data.status}`
        }
        return `链路：${params.data.source} → ${params.data.target}<br/>类型：${params.data.name}<br/>状态：${params.data.status}`
      }
    },
    animationDuration: 750,
    series: [
      {
        type: 'graph',
        layout: layout === 'force' ? 'force' : 'none',
        roam: true,
        zoom: zoomLevel.value, // 添加这一行，初始化缩放级别
        focusNodeAdjacency: true,
        data: nodes,
        links,
        force: layout === 'force' ? {
          repulsion: 450,
          edgeLength: 130,
          layoutAnimation: true
        } : undefined,
        lineStyle: { width: 2.5 }
      }
    ]
  }

  // 网格布局 - 储能柜按3列排列，序号相邻的挨在一起
  if (layout === 'grid') {
    option.series[0].layout = 'none'

    // 固定其他设备的位置
    const devicePositions = {
      'gatewayB': { x: 150, y: 100 },
      'qkdUpper': { x: 300, y: 100 },
      'qkdStorage': { x: 450, y: 100 },
      'switch': { x: 200, y: 220 },
      'serialServer': { x: 350, y: 220 },
      'distributedBus': { x: 275, y: 350 } // 总线放在储能柜上方居中位置
    }

    // 设置其他设备位置
    nodes.forEach(node => {
      if (devicePositions[node.id]) {
        node.x = devicePositions[node.id].x
        node.y = devicePositions[node.id].y
      }
    })

    // 储能柜按3列网格布局排列 (使用Element Plus的24分栏思想，3列即每列8份)
    const columnCount = 3
    const cellWidth = 150 // 列宽
    const cellHeight = 120 // 行高
    const startX = 100 // 起始X坐标
    const startY = 450 // 起始Y坐标（在总线下方）

    nodes.forEach(node => {
      if (node.type === 'storage' && node.index !== undefined) {
        const row = Math.floor(node.index / columnCount)
        const col = node.index % columnCount

        // 计算位置，模拟el-col的3列布局
        node.x = startX + (col * cellWidth)
        node.y = startY + (row * cellHeight)
      }
    })
  }
  // 圆形布局
  else if (layout === 'circular') {
    option.series[0].layout = 'none'
    const radius = 320
    const centerX = 450
    const centerY = 300
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length
      node.x = centerX + radius * Math.cos(angle)
      node.y = centerY + radius * Math.sin(angle)
    })
  }

  chart.value.setOption(option, true)
}

// 视图控制方法
const resetView = () => chart.value && chart.value.dispatchAction({ type: 'restore' })
// 修复后的缩放函数
const zoomIn = () => {
  if (!chart.value) return;

  // 获取当前图表配置
  const option = chart.value.getOption();
  // 获取当前缩放级别（默认为1）
  const currentZoom = option.series[0].zoom || 1;
  // 计算新缩放级别（限制最大3倍）
  const newZoom = Math.min(currentZoom * 1.2, 3);

  // 更新缩放级别并重新设置配置
  option.series[0].zoom = newZoom;
  chart.value.setOption(option);

  // 同步更新zoomLevel状态
  zoomLevel.value = newZoom;
};

const zoomOut = () => {
  if (!chart.value) return;

  // 获取当前图表配置
  const option = chart.value.getOption();
  // 获取当前缩放级别（默认为1）
  const currentZoom = option.series[0].zoom || 1;
  // 计算新缩放级别（限制最小0.5倍）
  const newZoom = Math.max(currentZoom / 1.2, 0.5);

  // 更新缩放级别并重新设置配置
  option.series[0].zoom = newZoom;
  chart.value.setOption(option);

  // 同步更新zoomLevel状态
  zoomLevel.value = newZoom;
};



// 窗口大小变化处理
const handleResize = () => chart.value && chart.value.resize()
const disposeChart = () => chart.value && chart.value.dispose()

// 状态标签和格式化
const statusTag = (status) => {
  switch (status) {
    case '正常': return 'success'
    case '故障': return 'danger'
    case '数据传输中': return 'info'
    default: return 'warning'
  }
}
const formatStatus = (status) => ({
  'normal': '正常',
  'fault': '故障',
  'transferring': '数据传输中'
}[status] || '未知状态')

// 生命周期
onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeChart()
})

// 监听变化
watch(() => toolbar.value.layout, renderChart)
watch(() => toolbar.value.keyword, renderChart)
watch(() => topology.value.nodes, renderChart, { deep: true })
</script>

<style lang="scss" scoped>
.card-header {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

/* 针对水平分割线，去除上下 margin */
.el-divider--horizontal {
  margin: 0 !important;
}

.toolbar-form .el-form-item--label {
  font-size: 16px;
  font-weight: 200;
  color: #303133
}

.custom-label {
  font-size: 16px;
  font-weight: 200;
  color: #909399
}

.service-topology-page {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  /* 固定三列布局，确保属性面板在右侧 */
  grid-template-rows: auto;
  grid-template-areas:
    'sidebar canvas property';
  gap: 16px;
  padding: 16px;
  min-height: calc(100vh - 120px);
  background: #f5f7fa;
}

.tool-sidebar {
  grid-area: sidebar;
}

.canvas-wrapper {
  grid-area: canvas;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.subtitle {
  display: inline-block;
  padding: 4px 0px;
  color: #909399;
  font-size: 13px;

}

.canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #303133;
  }



  .canvas-actions {
    display: flex;
    gap: 0px;
  }
}

.topology-canvas {
  flex: 1;
  min-height: 600px;
  /* 增加高度以容纳网格布局 */
}

/* 右侧固定属性面板 */
.property-panel {
  grid-area: property;
  position: sticky;
  top: 16px;
  align-self: start;
  height: 100%;
  overflow-y: auto;
}

.sidebar-card {
  height: 100%;
  border-radius: 12px;
}

.toolbar-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-title {
  font-weight: 600;
  margin-top: 8px;
  color: #303133;
  font-size: 14px;
}

.legend-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: #606266;
  padding: 8px 0;

  .legend-title {
    font-weight: 600;
    margin-top: 8px;
    color: #303133;
    font-size: 14px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 0;
  }

  .legend-icon {
    width: 24px;
    height: 24px;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  .legend-line {
    width: 24px;
    height: 2px;
    display: inline-block;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      right: 0;
      top: -3px;
      width: 6px;
      height: 6px;
      border-top: 2px solid currentColor;
      border-right: 2px solid currentColor;
      transform: rotate(45deg);
    }

    &.normal {
      background-color: #67C23A;
      color: #67C23A;
    }

    &.fault {
      background-color: #F56C6C;
      color: #F56C6C;
    }

    &.transferring {
      background-color: #409EFF;
      color: #409EFF;
    }
  }
}

.property-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.entity-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.property-descriptions {
  font-size: 13px;
}

.property-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 确保在各种屏幕尺寸下属性面板都在右侧 */
@media (max-width: 1280px) {
  .service-topology-page {
    grid-template-columns: 260px 1fr 320px;
  }
}

@media (max-width: 1024px) {
  .service-topology-page {
    grid-template-columns: 240px 1fr 300px;
  }
}
</style>