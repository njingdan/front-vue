<template>
  <div class="key-negotiation-container">
    <div class="page-header">
      <h1>储能柜密钥协商</h1>
    </div>

    <div class="main-content">
      <!-- 柜子列表 -->
      <el-card class="stat-card cabinet-list-card">
        <div class="card-header">
          <h2>储能柜列表</h2>
        </div>

        <div class="cabinet-list">
          <el-button
            v-for="cabinet in cabinets"
            :key="cabinet.id"
            :type="selectedCabinet === cabinet.id ? 'primary' : 'default'"
            @click="selectCabinet(cabinet.id)"
          >
            {{ cabinet.name }}
          </el-button>
        </div>
      </el-card>

      <!-- 协商过程 -->
      <el-card v-if="selectedCabinet" class="stat-card negotiation-process-card">
        <div class="card-header">
          <h2>{{ selectedCabinetName }} 密钥协商过程</h2>
          <el-tag :type="getStatusType()">
            {{ currentStatusText }}
          </el-tag>
        </div>

        <!-- 阶段 -->
        <div class="stage-indicators">
          <div
            class="stage-line"
            :style="{ width: `${(currentStatus + 1) / processSteps.length * 100}%` }"
          ></div>

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
              <el-icon v-if="currentStatus >= index"><Check /></el-icon>
              <el-icon v-else><Loading /></el-icon>
            </div>
            <div class="stage-name">{{ step }}</div>
          </div>
        </div>

        <!-- 图表 -->
        <div class="rssi-chart">
          <el-divider content-position="left">RSSI 数据曲线</el-divider>
          <div ref="chartRef" class="chart-container"></div>
        </div>
      </el-card>

      <div v-else class="no-selection">
        <el-empty description="请选择一个储能柜查看密钥协商过程" />
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick
} from 'vue';
import * as echarts from 'echarts';
import { Check, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

/* ================= 基础数据 ================= */

const cabinets = ref(
  Array.from({ length: 20 }, (_, i) => ({
    id: `CB${i + 1}`,
    name: `储能柜 ${i + 1}`
  }))
);

const selectedCabinet = ref('');
const cabinetStates = reactive({});

/* ================= 工具：确保状态存在 ================= */
const ensureState = (cabinetId) => {
  if (!cabinetStates[cabinetId]) {
    cabinetStates[cabinetId] = {
      rssiData: [],
      status: -1
    };
  }
  return cabinetStates[cabinetId];
};

/* ================= 计算属性 ================= */

const selectedCabinetName = computed(() => {
  return cabinets.value.find(c => c.id === selectedCabinet.value)?.name || '';
});

const processSteps = ['信道探测', '密钥生成', '密钥分发', '密钥提取'];

const currentStatus = computed(() => {
  return cabinetStates[selectedCabinet.value]?.status ?? -1;
});

const currentStatusText = computed(() => {
  if (currentStatus.value === -1) return '未开始';
  if (currentStatus.value >= processSteps.length) return '完成';
  return processSteps[currentStatus.value];
});

const rssiData = computed(() => {
  return cabinetStates[selectedCabinet.value]?.rssiData || [];
});

/* ================= 图表 ================= */

const chartRef = ref(null);
let chart = null;
let updateTimer = null;

const scheduleUpdate = () => {
  if (updateTimer) return;
  updateTimer = setTimeout(() => {
    updateChart();
    updateTimer = null;
  }, 200);
};

const initChart = () => {
  if (!chartRef.value) return;
  if (!chart) chart = echarts.init(chartRef.value);
};

const updateChart = () => {
  if (!chartRef.value) return;
  if (!chart) chart = echarts.init(chartRef.value);

  const data = rssiData.value;

  chart.setOption({
    title: { text: 'RSSI 信号强度', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.map((_, i) => i + 1)
    },
    yAxis: { type: 'value' },
    series: [{ data, type: 'line', smooth: true }]
  });
};

/* ================= SSE（核心优化） ================= */

let eventSource = null;

const connectSSE = (cabinetId) => {
  // 关闭旧连接
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  const state = ensureState(cabinetId);

  eventSource = new EventSource(
    `http://localhost:8000/api/key-negotiate/sse?cabinetId=${cabinetId}`
  );

  /* ===== RSSI ===== */
  eventSource.addEventListener('rssi', (e) => {
    try {
      const res = JSON.parse(e.data);
      if (res.code !== 0) return;

      const rssi = res.data;
      if (typeof rssi !== 'number') return;

      state.rssiData.push(rssi);

      if (state.rssiData.length > 50) {
        state.rssiData.shift();
      }

      scheduleUpdate();
    } catch (err) {
      console.error('RSSI解析失败', err);
    }
  });

  /* ===== STATUS ===== */
  eventSource.addEventListener('status', (e) => {
    try {
      const res = JSON.parse(e.data);
      if (res.code !== 0) return;

      state.status = res.data;

      // 不再写死 4，改为动态判断
      if (state.status >= processSteps.length) {
        ElMessage.success(`${selectedCabinetName.value} 密钥协商完成！`);
      }
    } catch (err) {
      console.error('STATUS解析失败', err);
    }
  });

  eventSource.onerror = () => {
    console.error('SSE 连接异常');
    eventSource?.close();
    eventSource = null;
  };
};

/* ================= 交互 ================= */

const selectCabinet = async (cabinetId) => {
  if (selectedCabinet.value === cabinetId) return;

  selectedCabinet.value = cabinetId;

  ensureState(cabinetId);

  await nextTick();

  initChart();
  updateChart();

  connectSSE(cabinetId);
};

/* ================= 生命周期 ================= */

const handleResize = () => chart?.resize();

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  eventSource?.close();
  chart?.dispose();
  window.removeEventListener('resize', handleResize);
});

watch(rssiData, scheduleUpdate);

/* ================= UI ================= */

const getStatusType = () => {
  if (currentStatus.value === -1) return 'info';
  if (currentStatus.value >= processSteps.length) return 'success';
  return 'primary';
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