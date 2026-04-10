<template>
  <div class="device-authentication-container">
    <div class="page-header">
      <h1>{{ texts.pageTitle }}</h1>
    </div>

    <div class="content-layout">
      <div class="main-content">
        <el-card class="stat-card cabinet-list-card">
          <div class="card-header">
            <h2>{{ texts.cabinetList }}</h2>
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
                :loading="!!authenticatingCabinets[cabinet.id]"
                @click="initiateAuthentication(cabinet.id)"
              >
                {{ texts.initiateAuth }}
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card v-if="selectedCabinet" class="stat-card authentication-process-card">
          <div class="card-header">
            <h2>{{ selectedCabinetName }} {{ texts.processTitleSuffix }}</h2>
            <el-tag :type="getStatusType()">
              {{ currentStatusText }}
            </el-tag>
          </div>

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
        </el-card>

        <div v-else class="no-selection">
          <el-empty :description="texts.selectProcessEmpty" />
        </div>
      </div>

      <el-card class="stat-card cabinet-sidebar-card">
        <div class="card-header">
          <h2>{{ texts.logsTitle }}</h2>
        </div>

        <div v-if="selectedCabinet" class="cabinet-sidebar-list">
          <div class="selected-cabinet-title">{{ selectedCabinetName }} {{ texts.latestLogsSuffix }}</div>

          <el-empty v-if="selectedCabinetLogs.length === 0" :description="texts.noLogs" />

          <div v-else class="cabinet-log-list">
            <div
              v-for="log in selectedCabinetLogs"
              :key="`${log.timestamp}-${log.step}-${log.info}`"
              class="cabinet-log-item"
            >
              <div class="cabinet-log-time">{{ formatTimestamp(log.timestamp) }}</div>
              <div class="cabinet-log-step">{{ log.step }}</div>
              <div class="cabinet-log-info">{{ log.info }}</div>
            </div>
          </div>
        </div>

        <div v-else class="sidebar-empty-wrap">
          <el-empty :description="texts.selectLogsEmpty" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue';
import { Check, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { get, post, getServerUrl } from '../axios/request';

const texts = {
  pageTitle: '\u50a8\u80fd\u67dc\u8bbe\u5907\u8ba4\u8bc1',
  cabinetList: '\u50a8\u80fd\u67dc\u5217\u8868',
  initiateAuth: '\u53d1\u8d77\u8bbe\u5907\u8ba4\u8bc1',
  processTitleSuffix: '\u8bbe\u5907\u8ba4\u8bc1\u6d41\u7a0b',
  selectProcessEmpty: '\u8bf7\u9009\u62e9\u4e00\u4e2a\u50a8\u80fd\u67dc\u67e5\u770b\u8bbe\u5907\u8ba4\u8bc1\u6d41\u7a0b',
  logsTitle: '\u50a8\u80fd\u67dc\u65e5\u5fd7',
  latestLogsSuffix: '\u6700\u8fd110\u6761\u65e5\u5fd7',
  noLogs: '\u6682\u65e0\u65e5\u5fd7\u6570\u636e',
  selectLogsEmpty: '\u8bf7\u9009\u62e9\u5de6\u4fa7\u50a8\u80fd\u67dc\u67e5\u770b\u65e5\u5fd7',
  authCompleted: '\u8bbe\u5907\u8ba4\u8bc1\u5b8c\u6210',
  initiated: '\u5df2\u53d1\u8d77\u8bbe\u5907\u8ba4\u8bc1',
  initiateFailed: '\u53d1\u8d77\u8bbe\u5907\u8ba4\u8bc1\u5931\u8d25',
  notStarted: '\u672a\u5f00\u59cb',
  completed: '\u5b8c\u6210'
};

const cabinets = ref(
  Array.from({ length: 20 }, (_, i) => ({
    id: `CB${i + 1}`,
    name: `\u50a8\u80fd\u67dc${i + 1}`
  }))
);

const selectedCabinet = ref('');
const cabinetStates = reactive({});
const selectedCabinetLogs = ref([]);
const authenticatingCabinets = reactive({});

const ensureState = (cabinetId) => {
  if (!cabinetStates[cabinetId]) {
    cabinetStates[cabinetId] = { status: -1 };
  }
  return cabinetStates[cabinetId];
};

const selectedCabinetName = computed(() => {
  return cabinets.value.find((c) => c.id === selectedCabinet.value)?.name || '';
});

const processSteps = [
  '\u4fe1\u53f7\u91c7\u96c6',
  '\u4fe1\u53f7\u5904\u7406',
  '\u7279\u5f81\u63d0\u53d6',
  '\u8bbe\u5907\u8ba4\u8bc1'
];

const currentStatus = computed(() => cabinetStates[selectedCabinet.value]?.status ?? -1);

const getStatusTextByValue = (status) => {
  if (status === -1) return texts.notStarted;
  if (status >= processSteps.length) return texts.completed;
  return processSteps[status] || `Stage ${status}`;
};

const getStatusTypeByValue = (status) => {
  if (status === -1) return 'info';
  if (status >= processSteps.length) return 'success';
  return 'primary';
};

const currentStatusText = computed(() => getStatusTextByValue(currentStatus.value));

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
    `${serverBase}/api/device-auth/sse?cabinetId=${encodeURIComponent(cabinetId)}`
  );
  eventSource = source;

  source.addEventListener('status', (e) => {
    try {
      const res = JSON.parse(e.data);
      if (res.code !== 0) return;

      const prevStatus = state.status;
      state.status = res.data;

      if (prevStatus < processSteps.length && state.status >= processSteps.length) {
        ElMessage.success(`${getCabinetName(cabinetId)} ${texts.authCompleted}`);
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
    const resp = await get('/api/device-auth/log', { cabinetId });
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

const selectCabinet = async (cabinetId) => {
  if (selectedCabinet.value === cabinetId) return;

  selectedCabinet.value = cabinetId;
  ensureState(cabinetId);
  await fetchSelectedCabinetLogs(cabinetId);
  connectCabinetSSE(cabinetId);
};

const initiateAuthentication = async (cabinetId) => {
  if (!cabinetId || authenticatingCabinets[cabinetId]) return;

  authenticatingCabinets[cabinetId] = true;
  try {
    const resp = await post('/api/device-auth/initiate', { cabinetId });
    if (resp?.data?.code !== 0) {
      ElMessage.error(resp?.data?.message || texts.initiateFailed);
      return;
    }

    ElMessage.success(`${getCabinetName(cabinetId)} ${texts.initiated}`);
  } catch (err) {
    console.error('initiate authentication failed', err);
    ElMessage.error(texts.initiateFailed);
  } finally {
    authenticatingCabinets[cabinetId] = false;
  }
};

onUnmounted(() => {
  closeEventSource();
});

const getStatusType = () => getStatusTypeByValue(currentStatus.value);

const formatTimestamp = (timestamp) => {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return '--';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
};
</script>

<style scoped>
.device-authentication-container {
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

.authentication-process-card {
  padding-bottom: 20px;
}

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

.no-selection {
  padding: 100px 0;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

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
