<template>
  <div class="key-negotiation-container">
    <div class="page-header">
      <h1>储能柜密钥协商</h1>
    </div>

    <div class="content-layout">
      <div class="main-content">
        <!-- 柜子列表 -->
        <el-card class="stat-card cabinet-list-card">
          <div class="card-header">
            <h2>储能柜列表</h2>
          </div>

          <div class="cabinet-list">
            <div
              v-for="cabinet in cabinets"
              :key="cabinet.id"
              class="cabinet-action-item"
            >
              <el-button
                :type="selectedCabinet === cabinet.id ? 'primary' : 'default'"
                @click="selectCabinet(cabinet.id)"
              >
                {{ cabinet.name }}
              </el-button>
              <el-button
                type="success"
                plain
                :loading="!!negotiatingCabinets[cabinet.id]"
                @click="initiateNegotiation(cabinet.id)"
              >
                发起密钥协商
              </el-button>
            </div>
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

      <!-- 右侧边栏：选中储能柜日志 -->
      <el-card class="stat-card cabinet-sidebar-card">
        <div class="card-header">
          <h2>储能柜日志</h2>
        </div>

        <div v-if="selectedCabinet" class="cabinet-sidebar-list">
          <div class="selected-cabinet-title">{{ selectedCabinetName }} 最近10条日志</div>

          <el-empty v-if="selectedCabinetLogs.length === 0" description="暂无日志数据" />

          <div v-else class="cabinet-log-list">
            <div
              v-for="log in selectedCabinetLogs"
              :key="`${log.timestamp}-${log.flag ?? 1}-${log.step}-${log.info}`"
              class="cabinet-log-item"
            >
              <div class="cabinet-log-time">{{ formatTimestamp(log.timestamp) }}</div>
              <div class="cabinet-log-step">{{ log.step }}</div>
              <div class="cabinet-log-info">{{ log.info }}</div>
            </div>
          </div>
        </div>

        <div v-else class="sidebar-empty-wrap">
          <el-empty description="请选择左侧储能柜查看日志" />
        </div>
      </el-card>
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
import { get, post, getServerUrl } from '../axios/request';

/* ================= 基础数据 ================= */

const cabinets = ref(
  Array.from({ length: 20 }, (_, i) => ({
    id: `CB${i + 1}`,
    name: `储能柜${i + 1}`
  }))
);

const selectedCabinet = ref('');
const cabinetStates = reactive({});
const selectedCabinetLogs = ref([]);
const negotiatingCabinets = reactive({});
const LAST_SELECTED_CABINET_KEY = 'key-negotiation:selected-cabinet';

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
  return cabinets.value.find((c) => c.id === selectedCabinet.value)?.name || '';
});

const processSteps = ['信道探测', '密钥生成', '密钥分发', '密钥提取'];

const currentStatus = computed(() => {
  return cabinetStates[selectedCabinet.value]?.status ?? -1;
});

const getStatusTextByValue = (status) => {
  if (status === -1) return '未开始';
  if (status >= processSteps.length) return '完成';
  return processSteps[status] || `阶段${status}`;
};

const getStatusTypeByValue = (status) => {
  if (status === -1) return 'info';
  if (status >= processSteps.length) return 'success';
  return 'primary';
};

const currentStatusText = computed(() => getStatusTextByValue(currentStatus.value));

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

/* ================= SSE（当前选中柜实时） ================= */

let eventSource = null;

const closeEventSource = () => {
  if (!eventSource) return;
  // Avoid stale callbacks from a closed source touching the new active source.
  eventSource.onopen = null;
  eventSource.onerror = null;
  eventSource.onmessage = null;
  eventSource.close();
  eventSource = null;
};

const getCabinetName = (cabinetId) => {
  return cabinets.value.find((c) => c.id === cabinetId)?.name || cabinetId;
};

const connectCabinetSSE = (cabinetId) => {
  if (!cabinetId) return;

  closeEventSource();

  const state = ensureState(cabinetId);
  const serverBase = getServerUrl().replace(/\/$/, '');
  const source = new EventSource(
    `${serverBase}/api/key-negotiate/sse?cabinetId=${encodeURIComponent(cabinetId)}`
  );
  eventSource = source;

  source.addEventListener('rssi', (e) => {
    try {
      const res = JSON.parse(e.data);
      if (res.code !== 0) return;

      const rssi = res.data;
      if (typeof rssi !== 'number') return;

      state.rssiData.push(rssi);
      if (state.rssiData.length > 50) state.rssiData.shift();
      scheduleUpdate();
    } catch (err) {
      console.error('RSSI parse failed', err);
    }
  });

  source.addEventListener('status', (e) => {
    try {
      const res = JSON.parse(e.data);
      if (res.code !== 0) return;

      const prevStatus = state.status;
      state.status = res.data;

      if (prevStatus < processSteps.length && state.status >= processSteps.length) {
        ElMessage.success(`${getCabinetName(cabinetId)} 密钥协商完成`);
      }
    } catch (err) {
      console.error('STATUS parse failed', err);
    }
  });

  source.addEventListener('log', (e) => {
    try {
      const res = JSON.parse(e.data);
      if (res.code !== 0) return;
      const logItem = res.data;
      selectedCabinetLogs.value = [logItem, ...selectedCabinetLogs.value]
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        .slice(0, 10);
    } catch (err) {
      console.error('LOG parse failed', err);
    }
  });

  source.onerror = () => {
    // Firefox may fire error while closing an old source; guard active instance.
    if (eventSource !== source) {
      source.close();
      return;
    }
    closeEventSource();
  };
};

const fetchSelectedCabinetLogs = async (cabinetId) => {
  try {
    const resp = await get('/api/key-negotiate/log', { cabinetId });
    if (resp?.data?.code !== 0 || !Array.isArray(resp?.data?.data)) {
      selectedCabinetLogs.value = [];
      return;
    }
    selectedCabinetLogs.value = resp.data.data
      .slice()
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
      .slice(0, 10);
  } catch (err) {
    selectedCabinetLogs.value = [];
    console.error('fetch selected logs failed', err);
  }
};

const fetchCabinetState = async (cabinetId) => {
  const state = ensureState(cabinetId);
  try {
    const resp = await get('/api/key-negotiate/state', { cabinetId });
    const payload = resp?.data;
    if (payload?.code !== 0 || !payload?.data) {
      state.status = -1;
      state.rssiData = [];
      return;
    }

    const backendState = payload.data;
    const rawStatus = Number(backendState.negotiate_status);
    state.status = Number.isFinite(rawStatus) ? rawStatus : -1;

    const rawRssi = Array.isArray(backendState.rssiData) ? backendState.rssiData : [];
    state.rssiData = rawRssi
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .slice(-50);
  } catch (err) {
    state.status = -1;
    state.rssiData = [];
    console.error('fetch cabinet negotiation state failed', err);
  }
};

/* ================= 交互 ================= */

const selectCabinet = async (cabinetId) => {
  selectedCabinet.value = cabinetId;
  localStorage.setItem(LAST_SELECTED_CABINET_KEY, cabinetId);
  ensureState(cabinetId);
  await Promise.all([
    fetchCabinetState(cabinetId),
    fetchSelectedCabinetLogs(cabinetId)
  ]);

  await nextTick();

  initChart();
  updateChart();

  connectCabinetSSE(cabinetId);
};

const initiateNegotiation = async (cabinetId) => {
  if (!cabinetId || negotiatingCabinets[cabinetId]) return;

  negotiatingCabinets[cabinetId] = true;
  try {
    const resp = await post('/api/key-negotiate/initiate', { cabinetId });
    if (resp?.data?.code !== 0) {
      ElMessage.error(resp?.data?.message || '发起密钥协商失败');
      return;
    }

    ElMessage.success(`${getCabinetName(cabinetId)} 已发起密钥协商`);
  } catch (err) {
    console.error('initiate negotiation failed', err);
    ElMessage.error('发起密钥协商失败');
  } finally {
    negotiatingCabinets[cabinetId] = false;
  }
};

/* ================= 生命周期 ================= */

const handleResize = () => chart?.resize();

const restoreLastSelectedCabinet = async () => {
  const lastSelected = localStorage.getItem(LAST_SELECTED_CABINET_KEY);
  if (!lastSelected) return;
  const exists = cabinets.value.some((cabinet) => cabinet.id === lastSelected);
  if (!exists) return;
  await selectCabinet(lastSelected);
};

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await restoreLastSelectedCabinet();
});

onUnmounted(() => {
  closeEventSource();
  chart?.dispose();
  window.removeEventListener('resize', handleResize);
});

watch(rssiData, scheduleUpdate);

/* ================= UI ================= */

const getStatusType = () => getStatusTypeByValue(currentStatus.value);

const formatTimestamp = (timestamp) => {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return '--';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
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

.content-layout {
  display: flex;
  gap: 20px;
  max-width: 1600px;
  margin: 0 auto;
  align-items: flex-start;
}

.main-content {
  flex: 1;
  min-width: 0;
  gap: 20px;
  display: flex;
  flex-direction: column;
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

.cabinet-action-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cabinet-action-item .el-button {
  width: 100%;
  margin-left: 0;
  margin-right: 0;
  padding-left: 10px;
  padding-right: 10px;
  display: flex;
  justify-content: center;
}

.cabinet-action-item .el-button + .el-button {
  margin-left: 0;
}

/* 协商过程样式 */
.negotiation-process-card {
  padding-bottom: 20px;
}

/* 阶段指示器样式 */
.stage-indicators {
  display: flex;
  justify-content: space-around;
  position: relative;
  margin: 30px 20px;
  padding: 0 10px;
}

.stage-line {
  position: absolute;
  top: 16px;
  left: 30px;
  height: 2px;
  background-color: #409eff;
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

/* 未选择样式 */
.no-selection {
  padding: 100px 0;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 右侧边栏 */
.cabinet-sidebar-card {
  width: 360px;
  max-height: calc(100vh - 120px);
  position: sticky;
  top: 20px;
}

.cabinet-sidebar-list {
  padding: 12px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.selected-cabinet-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.sidebar-empty-wrap {
  padding: 20px 12px;
}

.cabinet-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cabinet-log-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  background-color: #fafafa;
}

.cabinet-log-time {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.cabinet-log-step {
  font-size: 13px;
  color: #303133;
  font-weight: 600;
  margin-bottom: 4px;
}

.cabinet-log-info {
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
  word-break: break-word;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .content-layout {
    flex-direction: column;
  }

  .cabinet-sidebar-card {
    width: 100%;
    max-height: none;
    position: static;
  }

  .cabinet-sidebar-list {
    max-height: none;
  }

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
