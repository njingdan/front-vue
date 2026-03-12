<template>
  <div class="key-negotiation-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>储能柜密钥协商</h1>
    </div>
    
    <!-- 主要内容区 -->
    <div class="main-content">
      <!-- 储能柜列表卡片 -->
      <el-card class="stat-card cabinet-list-card">
        <div class="card-header">
          <h2>储能柜列表</h2>
        </div>
        
        <!-- 储能柜列表 -->
        <div class="cabinet-list">
          <el-button 
            v-for="cabinet in cabinets" 
            :key="cabinet.id"
            :type="selectedCabinet === cabinet.id ? 'primary' : 'default'"
            size="default"
            @click="selectCabinet(cabinet.id)"
          >
            {{ cabinet.name }}
          </el-button>
        </div>
      </el-card>
      
      <!-- 密钥协商过程卡片 -->
      <el-card v-if="selectedCabinet" class="stat-card negotiation-process-card">
        <div class="card-header">
          <h2>{{ selectedCabinetName }} 密钥协商过程</h2>
          <el-tag effect="dark" :type="getStatusType()">
            {{ currentStatusText }}
          </el-tag>
        </div>
        
        <!-- 流程步骤 -->
        <div class="stage-indicators">
          <div class="stage-line" :style="{ width: `${(currentStatus + 1) / processSteps.length * 100}%` }"></div>
          <div 
            v-for="(step, index) in processSteps" 
            :key="index" 
            class="stage-indicator"
            :class="{
              completed: currentStatus >= index,
              active: currentStatus === index
            }"
          >
            <div class="stage-icon">
              <el-icon v-if="currentStatus >= index">
                <Check />
              </el-icon>
              <el-icon v-else>
                <Loading />
              </el-icon>
            </div>
            <div class="stage-name">{{ step }}</div>
          </div>
        </div>
        
        <!-- RSSI 曲线图 -->
        <div class="rssi-chart">
          <el-divider content-position="left">RSSI 数据曲线</el-divider>
          <div ref="chartRef" class="chart-container"></div>
        </div>
      </el-card>
      
      <!-- 未选择储能柜提示 -->
      <div v-else class="no-selection">
        <el-empty description="请选择一个储能柜查看密钥协商过程" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, onActivated, computed, watch, reactive } from 'vue';
import * as echarts from 'echarts';
import { Check, Loading } from '@element-plus/icons-vue';
import { getCabinetNegotiation, getNegotiateStatus, getRssiData } from '../api/key-negotiation';

// 储能柜列表（示例数据，实际可能从后端获取）
const cabinets = ref([
  { id: 'CB001', name: '储能柜 1' },
  { id: 'CB002', name: '储能柜 2' },
  { id: 'CB003', name: '储能柜 3' },
  { id: 'CB004', name: '储能柜 4' },
  { id: 'CB005', name: '储能柜 5' },
  { id: 'CB006', name: '储能柜 6' },
  { id: 'CB007', name: '储能柜 7' },
  { id: 'CB008', name: '储能柜 8' },
  { id: 'CB009', name: '储能柜 9' },
  { id: 'CB010', name: '储能柜 10' },
  { id: 'CB011', name: '储能柜 11' },
  { id: 'CB012', name: '储能柜 12' },
  { id: 'CB013', name: '储能柜 13' },
  { id: 'CB014', name: '储能柜 14' },
  { id: 'CB015', name: '储能柜 15' },
  { id: 'CB016', name: '储能柜 16' },
  { id: 'CB017', name: '储能柜 17' },
  { id: 'CB018', name: '储能柜 18' },
  { id: 'CB019', name: '储能柜 19' },
  { id: 'CB020', name: '储能柜 20' }
]);

// 选中的储能柜
const selectedCabinet = ref('');
const selectedCabinetName = computed(() => {
  const cabinet = cabinets.value.find(c => c.id === selectedCabinet.value);
  return cabinet ? cabinet.name : '';
});

// 协商过程步骤
const processSteps = ['信道探测', '密钥生成', '密钥分发', '密钥提取'];

// 储能柜状态管理
const cabinetStates = reactive({});

// 当前选中储能柜的状态
const currentStatus = computed(() => {
  // 1. 获取当前选中的柜子状态值
  const status = selectedCabinet.value ? cabinetStates[selectedCabinet.value]?.status : undefined;

  // 2. 严格判定：必须是数字，且在 [0, 4] 闭区间内
  if (typeof status === 'number' && status >= 0 && status <= 4) {
    return status;
  }

  // 3. 其他所有情况（undefined、超出范围、null 等）均返回 -1
  return -1;
});

const currentStatusText = computed(() => {
  if (currentStatus.value === -1) return '未开始';
  if (currentStatus.value < processSteps.length) return processSteps[currentStatus.value];
  return '完成';
});

// 当前选中储能柜的RSSI数据
const rssiData = computed(() => {
  return selectedCabinet.value ? (cabinetStates[selectedCabinet.value]?.rssiData || []) : [];
});

// 图表引用
const chartRef = ref(null);
let chart = null;
let timer = null;

// 选择储能柜
const selectCabinet = (cabinetId) => {
  // 如果点击的是当前柜子直接返回
  if (selectedCabinet.value === cabinetId) return;
  selectedCabinet.value = cabinetId;
  // 初始化数据
  fetchNegotiationData(cabinetId);
  // 启动定时任务
  startTimer(cabinetId);
};

// 获取协商数据
const fetchNegotiationData = async (cabinetId) => {
  try {
    cabinetStates[cabinetId] = {};
    const response = await getCabinetNegotiation(cabinetId);
    const data = response.data;
    
    if (data.code === 0) {
      cabinetStates[cabinetId].status = data.data.negotiate_status;
      cabinetStates[cabinetId].rssiData = data.data.rssiData;

      // 如果当前选中的是该储能柜，更新图表
      if (selectedCabinet.value === cabinetId) {
        updateChart();
      }
    }
    
  } catch (error) {
    console.error('获取协商数据失败:', error);
  }
};

// 获取协商状态
const fetchNegotiationStatus = async (cabinetId) => {
  try {
    const response = await getNegotiateStatus(cabinetId);
    const data = response.data;
    if (data.code === 0) {
      // 更新储能柜状态
      if (!cabinetStates[cabinetId]) {
        cabinetStates[cabinetId] = {};
      }
      cabinetStates[cabinetId].status = data.data;
      // 当状态为信道探测时，获取RSSI数据
      if (data.data === 0) {
        fetchRssiData(cabinetId);
      }
    }
  } catch (error) {
    console.error('获取协商状态失败:', error);
  }
};

// 获取 RSSI 数据
const fetchRssiData = async (cabinetId) => {
  try {
    const response = await getRssiData(cabinetId);
    const data = response.data;
    if (data.code === 0) {
      // 更新储能柜RSSI数据
      if (!cabinetStates[cabinetId]) {
        cabinetStates[cabinetId] = {};
      }
      cabinetStates[cabinetId].rssiData = data.data;
      // 如果当前选中的是该储能柜，更新图表
      if (selectedCabinet.value === cabinetId) {
        updateChart();
      }
    }
  } catch (error) {
    console.error('获取 RSSI 数据失败:', error);
  }
};

// 启动定时任务
const startTimer = (cabinetId) => {
  // 清除之前的定时器
  if (timer) {
    clearInterval(timer);
  }
  // 每 2 秒获取一次协商数据（同时获取状态和RSSI）
  timer = setInterval(() => {
    fetchNegotiationData(cabinetId);
  }, 2000);
};

// 更新图表
const updateChart = () => {
  // 确保rssiData存在且有值
  if (!chartRef.value) return;
  
  if (!chart) {
    chart = echarts.init(chartRef.value);
  }
  
  const option = {
    title: {
      text: 'RSSI 信号强度',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        return `时间点 ${params[0].dataIndex + 1}: ${params[0].value} dBm`;
      }
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: rssiData.value.length }, (_, i) => i + 1),
      name: '时间点'
    },
    yAxis: {
      type: 'value',
      name: '信号强度 (dBm)',
      min: Math.min(...rssiData.value) - 5,
      max: Math.max(...rssiData.value) + 5
    },
    series: [{
      data: rssiData.value,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2
      },
      itemStyle: {
        color: '#409EFF'
      }
    }]
  };
  
  chart.setOption(option);
};

// 监听窗口大小变化
const handleResize = () => {
  if (chart) {
    chart.resize();
  }
};

// 组件挂载
onMounted(() => {
  window.addEventListener('resize', handleResize);
  // 组件挂载时如果有选中的储能柜，更新图表
  if (selectedCabinet.value && rssiData.value && rssiData.value.length > 0) {
    updateChart();
  }
});

// 组件激活时
onActivated(() => {
  // 组件激活时重新初始化图表
  if (chart) {
    chart.dispose();
    chart = null;
  }
  // 如果有选中的储能柜，更新图表
  if (selectedCabinet.value && rssiData.value && rssiData.value.length > 0) {
    updateChart();
  }
});

// 组件卸载
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
  if (chart) {
    chart.dispose();
  }
  window.removeEventListener('resize', handleResize);
});

// 监听 RSSI 数据变化
watch(rssiData, () => {
  updateChart();
});

// 获取状态标签类型
const getStatusType = () => {
  if (currentStatus.value === -1) return 'info';
  if (currentStatus.value < processSteps.length) return 'primary';
  return 'success';
};
</script>

<style scoped>
/* 全局样式 */
.key-negotiation-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  margin-bottom: 20px;
  text-align: center;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.main-content {
  gap: 20px;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  margin: 0 auto;
}

/* 卡片样式 */
.stat-card {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.card-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

/* 储能柜列表样式 */
.cabinet-list-card {
  padding-bottom: 20px;
}

.cabinet-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  padding: 20px;
}

.cabinet-list .el-button {
  width: 100%;       /* 强制按钮宽度撑满 grid 单元格的 120px+ */
  margin-left: 0;    /* 彻底消除 Element 按钮默认的左边距（这是主因） */
  margin-right: 0;
  padding-left: 10px; /* 如果内容太长，确保左右内边距对称 */
  padding-right: 10px;
  display: flex;     /* 确保按钮文字居中 */
  justify-content: center;
}

/* 兼容 Element Plus 的间距重置 */
.cabinet-list .el-button + .el-button {
  margin-left: 0;    /* 覆盖 Element 默认的 .el-button + .el-button 样式 */
}

/* 协商过程样式 */
.negotiation-process-card {
  padding-bottom: 20px;
}

/* 阶段指示器样式 */
.stage-indicators {
  display: flex;
  justify-content:space-around;
  position: relative;
  margin: 30px 20px;
  padding: 0 10px;
}

.stage-line {
  position: absolute;
  top: 16px;
  left: 30px;
  height: 2px;
  background-color: #409EFF;
  z-index: 1;
  transition: width 0.3s;
}

.stage-indicators::before {
  content: '';
  position: absolute;
  top: 16px;
  left: 30px;
  right: 30px;
  height: 2px;
  background-color: #e5e7eb;
  z-index: 0;
}

.stage-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
  width: 80px;
}

.stage-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  color: #fff;
  transition: all 0.3s;
}

.stage-indicator.completed .stage-icon {
  background-color: #52c41a;
}

.stage-indicator.active .stage-icon {
  background-color: #409eff;
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.2);
}

.stage-name {
  font-size: 14px;
  color: #666;
  text-align: center;
  white-space: nowrap;
  transition: all 0.3s;
}

.stage-indicator.completed .stage-name,
.stage-indicator.active .stage-name {
  color: #333;
  font-weight: 500;
}

/* RSSI 图表样式 */
.rssi-chart {
  padding: 0 20px 20px;
}

.chart-container {
  width: 100%;
  height: 400px;
  margin-top: 10px;
}

/* 未选择储能柜样式 */
.no-selection {
  padding: 100px 0;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stage-indicators {
    flex-direction: column;
    align-items: flex-start;
    margin: 20px;
  }
  
  .stage-indicators::before,
  .stage-line {
    display: none;
  }
  
  .stage-indicator {
    flex-direction: row;
    width: 100%;
    margin-bottom: 15px;
  }
  
  .stage-icon {
    margin-bottom: 0;
    margin-right: 10px;
  }
  
  .stage-name {
    text-align: left;
  }
  
  .cabinet-list {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>