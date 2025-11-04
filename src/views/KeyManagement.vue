<template>
    <el-container class="app-container">
        <el-main>
            <el-tabs v-model="activeTab" type="card">
                <!-- 密钥池状态标签页（按充电桩序号排序） -->
                <el-tab-pane label="密钥池状态" name="pools">
                    <el-card>
                        <template #header>
                            <div class="card-header">
                                <span>所有储能柜密钥池状态</span>
                                <el-button size="small" @click="refreshPools">刷新</el-button>
                            </div>
                        </template>

                        <!-- 新增：筛选区域 -->
                        <div class="filter-container">
                            <el-input v-model="filterKeyword" placeholder="请输入储能柜ID或名称" clearable size="small"
                                style="width: 240px; margin-right: 16px;"></el-input>

                            <el-select v-model="filterStatus" placeholder="请选择状态" clearable size="small"
                                style="width: 180px;">
                                <el-option label="正常" value="NORMAL"></el-option>
                                <el-option label="预警" value="WARNING"></el-option>
                                <el-option label="耗尽" value="DEPLETED"></el-option>
                                <el-option label="补充中" value="REFILLING"></el-option>
                            </el-select>
                        </div>

                        <el-table :data="filteredKeyPools" border stripe style="width: 100%"
                            @row-click="handleRowClick">
                            <el-table-column prop="stationId" label="储能柜ID" width="100"></el-table-column>
                            <el-table-column prop="stationName" label="储能柜名称" width="100"></el-table-column>
                            <el-table-column prop="remainingKeys" label="剩余密钥" width="90"></el-table-column>
                            <el-table-column prop="capacity" label="总容量" width="90"></el-table-column>
                            <el-table-column prop="threshold" label="预警阈值" width="90"></el-table-column>
                            <el-table-column prop="refillBatchSize" label="补充批次量" width="100"></el-table-column>
                            <el-table-column prop="status" label="状态" width="80">
                                <template #default="scope">
                                    <el-tag :type="statusTagType(scope.row.status)">
                                        {{ statusText(scope.row.status) }}
                                    </el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="warningMessage" label="告警信息" width="100">
                                <template #default="scope">
                                    <span v-if="scope.row.warningMessage" class="warning-text">{{
                                        scope.row.warningMessage }}</span>
                                    <span v-else>无</span>
                                </template>
                            </el-table-column>
                            <el-table-column prop="lastUpdated" label="最后更新时间" width="200"></el-table-column>
                            <el-table-column label="操作" width="180">
                                <template #default="scope">
                                    <el-button size="small" type="primary"
                                        @click="openDetailDialog(scope.row.stationId)">
                                        查看详情
                                    </el-button>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-card>
                </el-tab-pane>

                <!-- 告警列表标签页（按最新时间排序） -->
                <el-tab-pane label="告警信息" name="alerts" :lazy="true">
                    <el-card>
                        <template #header>
                            <div class="card-header">
                                <span>当前告警列表</span>
                                <el-button size="small" @click="refreshAlerts">刷新</el-button>
                            </div>
                        </template>

                        <el-table :data="sortedAlerts" border stripe style="width: 100%">
                            <el-table-column prop="timestamp" label="告警时间" width="200"></el-table-column>
                            <el-table-column prop="stationId" label="充电桩ID" width="120"></el-table-column>
                            <el-table-column prop="severity" label="告警级别" width="120">
                                <template #default="scope">
                                    <el-tag type="warning">{{ scope.row.severity }}</el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="message" label="告警信息"></el-table-column>
                        </el-table>
                    </el-card>
                </el-tab-pane>

                <!-- 完整快照标签页（按快照时间+充电桩序号排序） -->
                <el-tab-pane label="完整快照" name="snapshot" :lazy="true">
                    <el-card>
                        <template #header>
                            <div class="card-header">
                                <span>所有密钥池完整快照</span>
                                <el-button size="small" @click="refreshSnapshot">刷新</el-button>
                            </div>
                        </template>
                        <div v-if="snapshotData.totalRemaining !== undefined" class="snapshot-summary">
                            <el-descriptions title="快照概览" border :column="4">
                                <el-descriptions-item label="快照时间">{{ snapshotData.generatedAt }}</el-descriptions-item>
                                <el-descriptions-item label="总剩余密钥">{{ snapshotData.totalRemaining
                                }}</el-descriptions-item>
                                <el-descriptions-item label="总容量">{{ snapshotData.totalCapacity
                                }}</el-descriptions-item>
                                <el-descriptions-item label="告警站点数">{{ snapshotData.warningStationCount
                                }}</el-descriptions-item>
                            </el-descriptions>
                            <el-table :data="sortedSnapshotStations" border stripe
                                style="width: 100%; margin-top: 16px;">
                                <el-table-column prop="stationId" label="充电桩ID" width="120"></el-table-column>
                                <el-table-column prop="stationName" label="充电桩名称" width="140"></el-table-column>
                                <el-table-column prop="remainingKeys" label="剩余密钥" width="120"></el-table-column>
                                <el-table-column prop="capacity" label="总容量" width="120"></el-table-column>
                                <el-table-column prop="status" label="状态" width="120">
                                    <template #default="scope">
                                        <el-tag :type="statusTagType(scope.row.status)">
                                            {{ statusText(scope.row.status) }}
                                        </el-tag>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                        <div v-else class="empty-tip">暂无快照数据</div>
                    </el-card>
                </el-tab-pane>

                <!-- 量子密钥数据标签页（按最新生成时间排序） -->
                <!-- <el-tab-pane label="量子密钥数据" name="keys" :lazy="true">
                    <el-card>
                        <template #header>
                            <div class="card-header">
                                <span>所有量子密钥详情</span>
                                <el-button size="small" @click="refreshKeys">刷新</el-button>
                            </div>
                        </template>

                        <el-table :data="sortedKeyMaterials" border stripe style="width: 100%">
                            <el-table-column prop="keyId" label="密钥ID" width="220"></el-table-column>
                            <el-table-column label="所属充电桩" width="140">
                                <template #default="scope">
                                    {{ scope.row.keyId.split('-key-')[0] }}
                                </template>
                            </el-table-column>
                            <el-table-column prop="stackIndex" label="栈索引" width="100"></el-table-column>
                            <el-table-column prop="materialPreview" label="密钥内容" width="300"></el-table-column>
                            <el-table-column prop="state" label="状态" width="120">
                                <template #default="scope">
                                    <el-tag :type="scope.row.state === 'USED' ? 'info' : 'success'">
                                        {{ scope.row.state === 'USED' ? '已使用' : '可用' }}
                                    </el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="generatedAt" label="生成时间" width="200"></el-table-column>
                            <el-table-column prop="consumedAt" label="消耗时间" width="200">
                                <template #default="scope">
                                    <span v-if="scope.row.consumedAt">{{ scope.row.consumedAt }}</span>
                                    <span v-else>未消耗</span>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-card>
                </el-tab-pane> -->
            </el-tabs>
        </el-main>

        <!-- 站点密钥详情弹窗 -->
        <el-dialog v-model="detailDialogVisible" :title="detailDialogTitle" :width="detailDialogWidth"
            :before-close="handleDialogClose">
            <el-card class="detail-card">
                <el-descriptions title="站点基本信息" border :column="4" style="margin-bottom: 16px;">
                    <el-descriptions-item label="充电桩ID">{{ detailData.summary.stationId }}</el-descriptions-item>
                    <el-descriptions-item label="充电桩名称">{{ detailData.summary.stationName }}</el-descriptions-item>
                    <el-descriptions-item label="总容量">{{ detailData.summary.capacity }}</el-descriptions-item>
                    <el-descriptions-item label="剩余密钥">{{ detailData.summary.remainingKeys }}</el-descriptions-item>
                    <el-descriptions-item label="预警阈值">{{ detailData.summary.threshold }}</el-descriptions-item>
                    <el-descriptions-item label="补充批次量">{{ detailData.summary.refillBatchSize }}</el-descriptions-item>
                    <el-descriptions-item label="状态">
                        <el-tag :type="statusTagType(detailData.summary.status)">
                            {{ statusText(detailData.summary.status) }}
                        </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="最后更新时间">{{ detailData.summary.lastUpdated }}</el-descriptions-item>
                </el-descriptions>

                <el-tabs v-model="detailTab" type="border-card" style="margin-bottom: 16px;">
                    <el-tab-pane label="可用密钥" name="available">
                        <el-table :data="detailData.availableKeys" border stripe style="width: 100%">
                            <el-table-column prop="keyId" label="密钥ID" width="220"></el-table-column>
                            <el-table-column prop="stackIndex" label="栈索引" width="100"></el-table-column>
                            <el-table-column prop="materialPreview" label="密钥内容" width="300"></el-table-column>
                            <el-table-column prop="generatedAt" label="生成时间" width="200"></el-table-column>
                            <el-table-column label="操作" width="120">
                                <template #default="scope">
                                    <el-button size="small" type="danger"
                                        @click="consumeKey(detailData.summary.stationId, scope.row.keyId)">
                                        消耗密钥
                                    </el-button>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>
                    <el-tab-pane label="已消耗密钥" name="consumed">
                        <el-table :data="detailData.consumedKeys" border stripe style="width: 100%">
                            <el-table-column prop="keyId" label="密钥ID" width="220"></el-table-column>
                            <el-table-column prop="stackIndex" label="栈索引" width="100"></el-table-column>
                            <el-table-column prop="materialPreview" label="密钥内容" width="300"></el-table-column>
                            <el-table-column prop="generatedAt" label="生成时间" width="200"></el-table-column>
                            <el-table-column prop="consumedAt" label="消耗时间" width="200"></el-table-column>
                        </el-table>
                    </el-tab-pane>
                    <el-tab-pane label="使用记录" name="usage">
                        <el-table :data="detailData.recentUsage" border stripe style="width: 100%">
                            <el-table-column label="使用时间" width="200">
                                <template #default="scope">{{ scope.row.occurredAt || '无' }}</template>
                            </el-table-column>
                            <el-table-column label="密钥ID" width="220">
                                <template #default="scope">{{ scope.row.keyId || '无' }}</template>
                            </el-table-column>
                            <el-table-column label="剩余密钥数" width="120">
                                <template #default="scope">{{ scope.row.remaining || '无' }}</template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>
                    <el-tab-pane label="补充记录" name="refill">
                        <el-table :data="detailData.refillHistory" border stripe style="width: 100%">
                            <el-table-column label="补充时间" width="200">
                                <template #default="scope">{{ scope.row.refilledAt || '无' }}</template>
                            </el-table-column>
                            <el-table-column label="补充密钥数" width="120">
                                <template #default="scope">{{ scope.row.keysAdded || '无' }}</template>
                            </el-table-column>
                            <el-table-column label="补充来源" width="120">
                                <template #default="scope">{{ scope.row.source || '无' }}</template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>
                </el-tabs>
            </el-card>
            <template #footer>
                <el-button @click="detailDialogVisible = false">关闭</el-button>
            </template>
        </el-dialog>
    </el-container>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import keyManageApi from '@/api/key-manage.js';
import { useRoute } from 'vue-router';
import { useStationStore } from '@/store/station.js';

const route = useRoute();

//接收参数信息，如果有stationId参数，则显示详情弹窗
//如果没有，正常显示

// 状态管理
const activeTab = ref('pools');
const keyPools = ref([]);
const alerts = ref([]);
const snapshotData = ref({ stations: [] });
const keyMaterials = ref([]);
const currentStationId = ref('');
const detailData = ref({
    summary: {},
    availableKeys: [],
    consumedKeys: [],
    recentUsage: [],
    refillHistory: []
});
const detailTab = ref('available');

// 新增：筛选相关状态
const filterKeyword = ref(''); // 用于筛选充电桩ID/名称的关键词
const filterStatus = ref(''); // 用于筛选状态的选中值

// 详情弹窗相关状态
const detailDialogVisible = ref(false);
const detailDialogTitle = ref('站点密钥详情');
const detailDialogWidth = ref('90%');

// 状态文本映射
const statusText = (status) => {
    const map = {
        'NORMAL': '正常',
        'WARNING': '预警',
        'DEPLETED': '耗尽',
        'REFILLING': '补充中'
    };
    return map[status] || status;
};

// 状态标签样式映射
const statusTagType = (status) => {
    const map = {
        'NORMAL': 'success',
        'WARNING': 'warning',
        'DEPLETED': 'danger',
        'REFILLING': 'info'
    };
    return map[status] || 'info';
};

// 1. 密钥池状态：按充电桩序号升序排序（提取stationId数字部分比较）
const sortedKeyPools = computed(() => {
    return [...keyPools.value].sort((a, b) => {
        // 提取stationId中的数字（支持station_001、1001等格式）
        const numA = parseInt(a.stationId.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.stationId.replace(/\D/g, '')) || 0;
        return numA - numB;
    });
});

// 新增：筛选后的密钥池数据（先排序后筛选）
const filteredKeyPools = computed(() => {
    return sortedKeyPools.value.filter(item => {
        // 1. 关键词筛选（匹配充电桩ID或名称）
        const keywordMatch = filterKeyword.value
            ? item.stationId.includes(filterKeyword.value) ||
            (item.stationName && item.stationName.includes(filterKeyword.value))
            : true;

        // 2. 状态筛选（匹配选中的状态）
        const statusMatch = filterStatus.value
            ? item.status === filterStatus.value
            : true;

        // 同时满足两个条件
        return keywordMatch && statusMatch;
    });
});

// 2. 告警列表：按告警时间倒序排序（最新时间在上面）
const sortedAlerts = computed(() => {
    return [...alerts.value].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
});

// 3. 完整快照：先按快照时间倒序（全局），快照内站点按充电桩序号升序
const sortedSnapshotStations = computed(() => {
    // 复制快照站点数据进行排序
    const stations = [...(snapshotData.value.stations || [])];
    return stations.sort((a, b) => {
        const numA = parseInt(a.stationId.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.stationId.replace(/\D/g, '')) || 0;
        return numA - numB;
    });
});

// 4. 量子密钥数据：按生成时间倒序排序（最新生成在上面）
const sortedKeyMaterials = computed(() => {
    return [...keyMaterials.value].sort((a, b) => {
        return new Date(b.generatedAt) - new Date(a.generatedAt);
    });
});

// 接口调用函数
const fetchKeyPools = async () => {
    try {
        const response = await keyManageApi.getKeyPools();
        keyPools.value = response.data.data || [];
    } catch (error) {
        console.error('获取密钥池状态失败:', error);
        ElMessage.error('获取密钥池状态失败');
        keyPools.value = [];
    }
};

const fetchAlerts = async () => {
    try {
        const response = await keyManageApi.getAlerts();
        alerts.value = response.data.data || [];
    } catch (error) {
        console.error('获取告警列表失败:', error);
        ElMessage.error('获取告警列表失败');
        alerts.value = [];
    }
};

const fetchSnapshot = async () => {
    try {
        const response = await keyManageApi.getSnapshot();
        const snapshot = response.data.data || {};
        // 全局快照按时间倒序（如果有多个快照时生效，单个快照则直接使用）
        snapshotData.value = {
            ...snapshot,
            stations: snapshot.stations || []
        };
    } catch (error) {
        console.error('获取密钥池快照失败:', error);
        ElMessage.error('获取密钥池快照失败');
        snapshotData.value = { stations: [] };
    }
};

const fetchKeyMaterials = async () => {
    try {
        const response = await keyManageApi.getKeyMaterials();
        keyMaterials.value = response.data.data || [];
    } catch (error) {
        console.error('获取量子密钥数据失败:', error);
        ElMessage.error('获取量子密钥数据失败');
        keyMaterials.value = [];
    }
};

const fetchStationDetail = async (stationId) => {
    try {
        const response = await keyManageApi.getStationDetail(stationId);
        const data = response.data.data || {};
        detailData.value = {
            summary: data.summary || {},
            availableKeys: data.availableKeys || [],
            consumedKeys: data.consumedKeys || [],
            recentUsage: data.recentUsage || [],
            refillHistory: data.refillHistory || []
        };
        detailDialogTitle.value = `${data.summary?.stationName || '未知站点'}（${stationId}）密钥详情`;
    } catch (error) {
        console.error(`获取充电桩${stationId}详情失败:`, error);
        ElMessage.error(`获取充电桩${stationId}详情失败`);
        detailData.value = {
            summary: {},
            availableKeys: [],
            consumedKeys: [],
            recentUsage: [],
            refillHistory: []
        };
    }
};

const fetchStaticKeys = async (stationId) => {
    try {
        const response = await keyManageApi.getStaticKeys(stationId);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error(`获取充电桩${stationId}静态密钥失败:`, error);
        ElMessage.error(`获取充电桩${stationId}静态密钥失败`);
        return [];
    }
};

// 操作函数
const refreshPools = () => {
    fetchKeyPools();
};

const refreshAlerts = () => {
    fetchAlerts();
};

const refreshSnapshot = () => {
    fetchSnapshot();
};

const refreshKeys = () => {
    fetchKeyMaterials();
};

// 打开详情弹窗
const openDetailDialog = async (stationId) => {
    if (!stationId) {
        ElMessage.warning('请选择有效的充电桩');
        return;
    }
    currentStationId.value = stationId;
    await fetchStationDetail(stationId);
    await fetchStaticKeys(stationId);
    detailDialogVisible.value = true;
};

// 表格行点击事件
const handleRowClick = (row) => {
    openDetailDialog(row.stationId);
};


// 关闭弹窗时的处理（修改原有handleDialogClose函数）
const handleDialogClose = () => {
  detailDialogVisible.value = false;
  
};

// 消耗密钥函数
const consumeKey = async (stationId, keyId) => {
    try {
        // 模拟密钥消耗接口调用
        await new Promise(resolve => setTimeout(resolve, 500));

        const consumedKey = detailData.value.availableKeys.find(key => key.keyId === keyId);
        if (!consumedKey) {
            ElMessage.warning('未找到该密钥');
            return;
        }

        // 过滤可用密钥列表
        detailData.value.availableKeys = detailData.value.availableKeys.filter(
            key => key.keyId !== keyId
        );

        // 更新状态并添加到已消耗列表
        const updatedKey = {
            ...consumedKey,
            state: 'USED',
            consumedAt: new Date().toISOString()
        };
        detailData.value.consumedKeys.push(updatedKey);

        // 更新剩余密钥数
        if (detailData.value.summary) {
            detailData.value.summary.remainingKeys = detailData.value.availableKeys.length;
            if (detailData.value.summary.remainingKeys < detailData.value.summary.threshold) {
                detailData.value.summary.status = 'WARNING';
                detailData.value.summary.warningMessage = '密钥余量不足，请补充';
            }
        }

        // 同步更新全局密钥列表
        const globalKeyIndex = keyMaterials.value.findIndex(key => key.keyId === keyId);
        if (globalKeyIndex !== -1) {
            keyMaterials.value[globalKeyIndex].state = 'USED';
            keyMaterials.value[globalKeyIndex].consumedAt = new Date().toISOString();
        }

        ElMessage.success('密钥消耗成功');
        fetchKeyPools();
    } catch (error) {
        console.error('消耗密钥失败:', error);
        ElMessage.error('消耗密钥失败');
    }
};

const stationStore = useStationStore();

// 页面初始化时获取参数
onMounted(() => {
  // 1. 加载页面基础数据
  fetchKeyPools();
  fetchAlerts();
  
  // 2. 从状态管理获取stationId
  const stationId = stationStore.stationId;
  if (stationId) {
    // 打开对应储能柜的详情弹窗
    openDetailDialog(stationId);
    // 3. 用完后立即清空，避免刷新页面时重复打开
    stationStore.clearStationId();
  }
});

// 监听路由参数变化（如从其他页面跳转过来时）
watch(
  () => route.params.stationId, // 监听stationId参数变化
  (newStationId) => {
    if (newStationId) {
      openDetailDialog(newStationId); // 新参数存在时打开弹窗
    } else {
      detailDialogVisible.value = false; // 参数消失时关闭弹窗
    }
  }
);

// 监听标签页切换，加载对应数据
watch(activeTab, (newVal) => {
    if (newVal === 'snapshot') {
        fetchSnapshot();
    } else if (newVal === 'keys') {
        fetchKeyMaterials();
    } else if (newVal === 'alerts') {
        fetchAlerts();
    }
});
</script>

<style scoped>
/* 新增：筛选区域样式 */
.filter-container {
    margin-bottom: 16px;
    /* 与表格保持距离 */
    display: flex;
    /* 横向排列控件 */
    align-items: center;
    /* 垂直居中 */
}

.app-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.el-main {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.warning-text {
    color: #e6a23c;
    font-weight: 500;
}

.empty-tip {
    text-align: center;
    padding: 40px;
    color: #999;
}

.detail-card {
    margin-top: 16px;
}

.snapshot-summary {
    margin-bottom: 16px;
}

pre {
    background-color: #f5f7fa;
    padding: 15px;
    border-radius: 4px;
    overflow-x: auto;
    max-height: 600px;
}

.el-tag {
    margin-right: 0;
}

/* 表格单元格溢出处理 */
.el-table .cell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 弹窗内容区域滚动 */
.el-dialog__body {
    max-height: 70vh;
    overflow-y: auto;
    padding: 16px 24px;
}
</style>