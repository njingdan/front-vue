<template>
  <div class="service-topology-page">
    <aside class="tool-sidebar">
      <el-card shadow="hover" class="sidebar-card">
        <div slot="header" class="card-header">
          <span>拓扑工具栏</span>
        </div>
        <el-form :model="toolbar" label-position="top" class="toolbar-form">
          <el-form-item label="布局算法">
            <el-radio-group v-model="toolbar.layout" size="mini">
              <el-radio-button label="force">力导向</el-radio-button>
              <el-radio-button label="hierarchy">层次</el-radio-button>
              <el-radio-button label="circular">圆形</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="节点筛选">
            <el-input v-model="toolbar.keyword" placeholder="输入服务名称" clearable />
          </el-form-item>
          <el-form-item label="风险等级">
            <el-select v-model="toolbar.risk" placeholder="全部等级" clearable>
              <el-option label="全部" value="all" />
              <el-option label="低风险" value="low" />
              <el-option label="中风险" value="medium" />
              <el-option label="高风险" value="high" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="toolbar.onlyActive">仅显示活跃服务</el-checkbox>
          </el-form-item>
          <el-divider />
          <div class="legend-section">
            <div class="legend-item">
              <span class="legend-dot whitelist" /> 白名单服务
            </div>
            <div class="legend-item">
              <span class="legend-dot discovered" /> 活跃发现
            </div>
            <div class="legend-item">
              <span class="legend-dot risk-high" /> 高风险链路
            </div>
          </div>
        </el-form>
      </el-card>
    </aside>

    <section class="canvas-wrapper">
      <div class="canvas-header">
        <div>
          <h2>服务拓扑可视化</h2>
          <p class="subtitle">展示白名单与实时发现服务对照关系，支持缩放与拖拽。</p>
        </div>
        <div class="canvas-actions">
          <el-button type="primary" icon="el-icon-rank" @click="resetView">重置视图</el-button>
          <el-button icon="el-icon-zoom-in" @click="zoomIn">放大</el-button>
          <el-button icon="el-icon-zoom-out" @click="zoomOut">缩小</el-button>
        </div>
      </div>
      <div ref="topologyChart" class="topology-canvas" />
    </section>

    <aside class="property-panel">
      <el-card shadow="hover" class="sidebar-card">
        <div slot="header" class="card-header">
          <span>属性面板</span>
        </div>
        <div v-if="selectedEntity" class="property-content">
          <h3 class="entity-name">{{ selectedEntity.name }}</h3>
          <el-tag :type="riskTag(selectedEntity.risk)" effect="dark" size="mini">{{ selectedEntity.riskLabel }}</el-tag>
          <el-descriptions :column="1" border class="property-descriptions">
            <el-descriptions-item label="类型">{{ selectedEntity.type === 'edge' ? '链路' : '服务节点' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ selectedEntity.status }}</el-descriptions-item>
            <el-descriptions-item v-if="selectedEntity.owner" label="责任人">{{ selectedEntity.owner }}</el-descriptions-item>
            <el-descriptions-item v-if="selectedEntity.qps" label="调用 QPS">{{ selectedEntity.qps }}</el-descriptions-item>
            <el-descriptions-item v-if="selectedEntity.lastSeen" label="最后活跃">{{ selectedEntity.lastSeen }}</el-descriptions-item>
          </el-descriptions>
          <el-divider content-position="left">历史调用统计</el-divider>
          <el-progress
            v-if="selectedEntity.type !== 'edge'"
            :percentage="selectedEntity.health"
            :status="selectedEntity.health > 80 ? 'success' : selectedEntity.health > 50 ? 'warning' : 'exception'"
          />
          <el-timeline>
            <el-timeline-item
              v-for="item in selectedEntity.history"
              :key="item.time"
              :timestamp="item.time"
              :type="item.type"
            >
              {{ item.detail }}
            </el-timeline-item>
          </el-timeline>
        </div>
        <div v-else class="property-placeholder">
          <el-empty description="选择节点或链路查看详情" />
        </div>
      </el-card>
    </aside>

    <footer class="timeline-bar">
      <el-card shadow="hover">
        <div slot="header" class="card-header">
          <span>历史时间轴</span>
          <span class="timestamp">{{ currentTimelineLabel }}</span>
        </div>
        <el-slider
          v-model="timeline.current"
          :min="0"
          :max="timeline.points.length - 1"
          :marks="timeline.marks"
          :step="1"
          show-stops
          @change="handleTimelineChange"
        />
      </el-card>
    </footer>
  </div>
</template>

<script>
import * as echarts from 'echarts'

export default {
  name: 'ServiceTopology',
  data() {
    const timelinePoints = [
      '2024-07-18 12:00',
      '2024-07-18 12:30',
      '2024-07-18 13:00',
      '2024-07-18 13:30'
    ]
    return {
      toolbar: {
        layout: 'force',
        keyword: '',
        risk: 'all',
        onlyActive: false
      },
      timeline: {
        points: timelinePoints,
        current: timelinePoints.length - 1,
        marks: timelinePoints.reduce((acc, cur, idx) => {
          acc[idx] = cur.split(' ')[1]
          return acc
        }, {})
      },
      whitelist: ['auth-service', 'config-center', 'energy-gateway', 'billing-service', 'storage-adapter'],
      topology: {
        nodes: [
          { id: 'auth-service', name: 'auth-service', group: 'whitelist', risk: 'low', status: '在线', owner: '张敏', qps: 260, lastSeen: '13:30', health: 95, history: [{ time: '12:00', type: 'success', detail: '认证耗时正常' }] },
          { id: 'config-center', name: 'config-center', group: 'whitelist', risk: 'low', status: '在线', owner: '李雷', qps: 180, lastSeen: '13:28', health: 92, history: [{ time: '11:30', type: 'info', detail: '配置同步成功' }] },
          { id: 'energy-gateway', name: 'energy-gateway', group: 'whitelist', risk: 'medium', status: '告警', owner: '王华', qps: 520, lastSeen: '13:30', health: 65, history: [{ time: '13:10', type: 'warning', detail: '检测异常流量突增' }] },
          { id: 'billing-service', name: 'billing-service', group: 'whitelist', risk: 'low', status: '在线', owner: '赵倩', qps: 140, lastSeen: '13:25', health: 88, history: [{ time: '12:45', type: 'success', detail: '账单同步完成' }] },
          { id: 'storage-adapter', name: 'storage-adapter', group: 'whitelist', risk: 'medium', status: '在线', owner: '刘强', qps: 310, lastSeen: '13:29', health: 76, history: [{ time: '13:05', type: 'info', detail: '新增副本实例' }] },
          { id: 'dispatch-scheduler', name: 'dispatch-scheduler', group: 'discovered', risk: 'high', status: '异常', owner: '未登记', qps: 80, lastSeen: '13:30', health: 42, history: [{ time: '13:18', type: 'danger', detail: '越权调用能量分配接口' }] },
          { id: 'prediction-engine', name: 'prediction-engine', group: 'discovered', risk: 'medium', status: '在线', owner: '技术部', qps: 230, lastSeen: '13:30', health: 70, history: [{ time: '12:58', type: 'info', detail: '模型重新加载成功' }] },
          { id: 'grid-metrics', name: 'grid-metrics', group: 'discovered', risk: 'low', status: '在线', owner: '监控中心', qps: 190, lastSeen: '13:27', health: 83, history: [{ time: '12:40', type: 'success', detail: '指标采集正常' }] },
          { id: 'external-audit', name: 'external-audit', group: 'discovered', risk: 'high', status: '未授权', owner: '未知', qps: 45, lastSeen: '13:20', health: 30, history: [{ time: '13:15', type: 'danger', detail: '疑似外部扫描请求' }] }
        ],
        links: [
          { source: 'auth-service', target: 'config-center', status: '正常', risk: 'low', calls: 1200 },
          { source: 'auth-service', target: 'energy-gateway', status: '告警', risk: 'medium', calls: 1840 },
          { source: 'energy-gateway', target: 'dispatch-scheduler', status: '异常', risk: 'high', calls: 620 },
          { source: 'dispatch-scheduler', target: 'billing-service', status: '异常', risk: 'high', calls: 180 },
          { source: 'prediction-engine', target: 'energy-gateway', status: '正常', risk: 'medium', calls: 980 },
          { source: 'grid-metrics', target: 'prediction-engine', status: '正常', risk: 'low', calls: 450 },
          { source: 'external-audit', target: 'energy-gateway', status: '未授权', risk: 'high', calls: 220 }
        ]
      },
      chart: null,
      selectedEntity: null,
      zoomLevel: 1
    }
  },
  computed: {
    filteredNodes() {
      return this.topology.nodes.filter(node => {
        if (this.toolbar.onlyActive && node.status !== '在线') return false
        if (this.toolbar.keyword && !node.name.includes(this.toolbar.keyword)) return false
        if (this.toolbar.risk && this.toolbar.risk !== 'all' && node.risk !== this.toolbar.risk) return false
        return true
      })
    },
    filteredLinks() {
      const nodeIds = new Set(this.filteredNodes.map(node => node.id))
      return this.topology.links.filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))
    },
    currentTimelineLabel() {
      return this.timeline.points[this.timeline.current]
    }
  },
  watch: {
    'toolbar.layout': 'renderChart',
    'toolbar.keyword': 'renderChart',
    'toolbar.risk': 'renderChart',
    'toolbar.onlyActive': 'renderChart'
  },
  mounted() {
    this.$nextTick(() => {
      this.initChart()
      window.addEventListener('resize', this.handleResize)
    })
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
    this.disposeChart()
  },
  methods: {
    initChart() {
      if (!this.$refs.topologyChart) return
      this.chart = echarts.init(this.$refs.topologyChart)
      this.chart.on('click', params => {
        if (params.dataType === 'node') {
          this.handleNodeClick(params.data)
        } else if (params.dataType === 'edge') {
          this.handleEdgeClick(params.data)
        }
      })
      this.renderChart()
    },
    renderChart() {
      if (!this.chart) return
      const nodes = this.filteredNodes.map(node => ({
        ...node,
        symbolSize: node.group === 'whitelist' ? 52 : 46,
        itemStyle: {
          color: node.group === 'whitelist' ? '#67C23A' : '#409EFF',
          borderColor: node.risk === 'high' ? '#F56C6C' : node.risk === 'medium' ? '#E6A23C' : '#C0C4CC',
          borderWidth: node.risk === 'high' ? 4 : 2
        },
        label: { show: true }
      }))
      const links = this.filteredLinks.map(link => ({
        ...link,
        lineStyle: {
          color: link.risk === 'high' ? '#F56C6C' : link.risk === 'medium' ? '#E6A23C' : '#909399',
          width: link.risk === 'high' ? 3 : 2,
          curveness: 0.2
        },
        label: {
          show: true,
          formatter: `${link.calls} cpm`,
          fontSize: 11,
          color: '#606266'
        }
      }))
      const layout = this.toolbar.layout
      const option = {
        tooltip: {
          trigger: 'item',
          formatter: params => {
            if (params.dataType === 'node') {
              return `服务：${params.data.name}<br/>风险：${params.data.risk}<br/>状态：${params.data.status}`
            }
            return `链路：${params.data.source} → ${params.data.target}<br/>调用：${params.data.calls}`
          }
        },
        animationDuration: 500,
        series: [
          {
            type: 'graph',
            layout: layout === 'force' ? 'force' : 'none',
            roam: true,
            focusNodeAdjacency: true,
            symbol: 'circle',
            data: nodes,
            links,
            label: { position: 'bottom' },
            force: layout === 'force' ? { repulsion: 320, edgeLength: 120 } : undefined,
            lineStyle: { color: '#909399' }
          }
        ]
      }
      if (layout === 'hierarchy') {
        option.series[0].layout = 'none'
        nodes.forEach((node, index) => {
          node.x = 200 * (index % 2) + (node.group === 'whitelist' ? 80 : 320)
          node.y = Math.floor(index / 2) * 120 + 40
        })
      } else if (layout === 'circular') {
        option.series[0].layout = 'none'
        const radius = 260
        const centerX = 360
        const centerY = 260
        nodes.forEach((node, index) => {
          const angle = (2 * Math.PI * index) / nodes.length
          node.x = centerX + radius * Math.cos(angle)
          node.y = centerY + radius * Math.sin(angle)
        })
      }
      this.chart.setOption(option, true)
    },
    handleNodeClick(node) {
      this.selectedEntity = {
        ...node,
        type: 'node',
        riskLabel: this.riskLabel(node.risk)
      }
    },
    handleEdgeClick(edge) {
      this.selectedEntity = {
        ...edge,
        type: 'edge',
        name: `${edge.source} → ${edge.target}`,
        riskLabel: this.riskLabel(edge.risk),
        history: [
          { time: '13:25', type: 'warning', detail: `最近 5 分钟调用 ${edge.calls} 次` }
        ]
      }
    },
    riskTag(risk) {
      switch (risk) {
        case 'high':
          return 'danger'
        case 'medium':
          return 'warning'
        case 'low':
          return 'success'
        default:
          return 'info'
      }
    },
    riskLabel(risk) {
      switch (risk) {
        case 'high':
          return '高风险'
        case 'medium':
          return '中风险'
        case 'low':
          return '低风险'
        default:
          return '未知'
      }
    },
    handleTimelineChange() {
      this.$message.info(`回放至 ${this.timeline.points[this.timeline.current]}`)
      this.renderChart()
    },
    resetView() {
      if (this.chart) {
        this.chart.dispatchAction({ type: 'restore' })
      }
    },
    zoomIn() {
      if (!this.chart) return
      this.zoomLevel = Math.min(this.zoomLevel + 0.2, 3)
      this.chart.dispatchAction({ type: 'graphRoam', zoom: this.zoomLevel })
    },
    zoomOut() {
      if (!this.chart) return
      this.zoomLevel = Math.max(this.zoomLevel - 0.2, 0.5)
      this.chart.dispatchAction({ type: 'graphRoam', zoom: this.zoomLevel })
    },
    handleResize() {
      if (this.chart) {
        this.chart.resize()
      }
    },
    disposeChart() {
      if (this.chart) {
        this.chart.dispose()
        this.chart = null
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.service-topology-page {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  grid-template-rows: auto 88px;
  grid-template-areas:
    'sidebar canvas property'
    'timeline timeline timeline';
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

.canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #303133;
  }
  .subtitle {
    margin: 4px 0 0;
    color: #909399;
    font-size: 13px;
  }
  .canvas-actions {
    display: flex;
    gap: 8px;
  }
}

.topology-canvas {
  flex: 1;
  min-height: 520px;
}

.property-panel {
  grid-area: property;
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

.legend-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    &.whitelist {
      background: #67c23a;
    }
    &.discovered {
      background: #409eff;
    }
    &.risk-high {
      background: #f56c6c;
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

.timeline-bar {
  grid-area: timeline;
}

.timestamp {
  color: #909399;
  font-size: 13px;
}

@media (max-width: 1280px) {
  .service-topology-page {
    grid-template-columns: 260px 1fr;
    grid-template-areas:
      'sidebar canvas'
      'property canvas'
      'timeline timeline';
  }
  .property-panel {
    grid-area: property;
  }
}

@media (max-width: 1024px) {
  .service-topology-page {
    grid-template-columns: 1fr;
    grid-template-areas:
      'sidebar'
      'canvas'
      'property'
      'timeline';
  }
  .topology-canvas {
    min-height: 400px;
  }
}
</style>
