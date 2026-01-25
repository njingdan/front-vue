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
                                <el-option label="正常" value="正常"></el-option>
                                <el-option label="异常" value="异常"></el-option>
                            </el-select>
                        </div>

                        <el-table :data="filteredKeyPools" border stripe style="width: 100%">
                            <el-table-column prop="stationId" label="储能柜ID" align="center"></el-table-column>
                            <el-table-column prop="stationName" label="储能柜名称" align="center"></el-table-column>
                            <el-table-column prop="remainingKeys" label="剩余密钥" align="center"></el-table-column>
                            <el-table-column prop="capacity" label="总容量" align="center"></el-table-column>
                            <el-table-column prop="threshold" label="预警阈值" align="center"></el-table-column>
                            <el-table-column prop="refillBatchSize" label="补充批次量" align="center"></el-table-column>
                            <el-table-column prop="status" label="状态" align="center">
                                <template #default="scope">
                                    <el-tag :type="scope.row.status === 1 || scope.row.status === '正常' ? 'success' : 'danger'">
                                        {{ scope.row.status === 1 || scope.row.status === '正常' ? '正常' : '异常' }}
                                    </el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="lastUpdateTime" label="最后更新时间" width="200" align="center"></el-table-column>
                            <el-table-column label="操作" width="180" align="center">
                                <template #default="scope">
                                    <el-button size="small" type="primary"
                                        @click="openDetailDialog(scope.row.stationId, scope.row.stationName)">
                                        查看详情
                                    </el-button>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-card>
                </el-tab-pane>
            </el-tabs>
        </el-main>

        <!-- 站点密钥详情弹窗 -->
        <el-dialog v-model="detailDialogVisible" :title="`储能柜` + currentStationId + ` ` + detailDialogTitle" :width="detailDialogWidth"
            :before-close="handleDialogClose">
            <el-card class="detail-card">
                <el-tabs v-model="detailTab" type="border-card" style="margin-bottom: 16px;">
                    <el-tab-pane label="可用密钥" name="available">
                        <el-table :data="detailData.availableKeys" border stripe style="width: 100%">
                            <el-table-column prop="keyId" label="密钥ID" align="center"></el-table-column>
                            <el-table-column label="密钥状态" width="100" align="center">
                                <template #default="scope">
                                    <el-tag :type="statusTagType(scope.row.status)">
                                        {{ statusText(scope.row.status) }}
                                    </el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="value" label="密钥内容"  align="center"></el-table-column>
                            <el-table-column prop="createTime" label="创建时间"  align="center"></el-table-column>
                        </el-table>
                    </el-tab-pane>
                    <el-tab-pane label="使用记录" name="recentUsage">
                        <el-table :data="detailData.recentUsage" border stripe style="width: 100%">
                            <el-table-column prop="secretKeyId" label="密钥ID"  align="center"></el-table-column>
                            <el-table-column prop="keyContent" label="密钥内容"  align="center"></el-table-column>
                            <el-table-column prop="useTime" label="使用时间"  align="center"></el-table-column>
                        </el-table>
                    </el-tab-pane>
                    <el-tab-pane label="补充记录" name="refillHistory">
                        <el-table :data="detailData.refillHistory" border stripe style="width: 100%">
                            <el-table-column prop="secretKeyId" label="密钥ID" align="center"></el-table-column>
                            <el-table-column prop="keyContent" label="密钥内容" align="center"></el-table-column>
                            <el-table-column prop="keyState" label="状态" align="center">
                                <template #default="scope">
                                    <el-tag :type="scope.row.status === 1 || scope.row.status === '正常' ? 'success' : 'danger'">
                                        {{ scope.row.status === 1 || scope.row.status === '正常' ? '正常' : '异常' }}
                                    </el-tag>
                                </template>
                            </el-table-column>
                            <el-table-column prop="addTime" label="补充时间"  align="center"></el-table-column>
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
    recentUsage: [],
    refillHistory: []
});
const detailTab = ref('available');

// 新增：筛选相关状态
const filterKeyword = ref(''); // 用于筛选充电桩ID/名称的关键词
const filterStatus = ref(''); // 用于筛选状态的选中值

// 详情弹窗相关状态
const detailDialogVisible = ref(false);
const detailDialogTitle = ref('密钥详情');
const detailDialogWidth = ref('90%');

// 状态标签颜色映射
const statusTagType = (status) => {
    switch (status) {
        case 0: return 'success'; // 绿色 (有效)
        case 1: return '';        // 默认蓝色 (冷冻) - 也可以写 'primary'
        case 2: return 'danger';  // 红色 (删除)
        default: return 'info';   // 灰色 (未知)
    }
};

// 状态文字显示映射
const statusText = (status) => {
    const map = {
        0: '有效',
        1: '冷冻',
        2: '删除'
    };
    // 使用 map[status] 获取文字，如果不存在则显示 '未知'
    return map[status] ?? '未知';
};

// 1. 密钥池状态：按充电桩序号升序排序（提取stationId数字部分比较）
const sortedKeyPools = computed(() => {
    return [...keyPools.value].sort((a, b) => {
        return a.stationName.localeCompare(b.stationName, 'en', { numeric: true });
    });
});

// 新增：筛选后的密钥池数据（先排序后筛选）
const filteredKeyPools = computed(() => {
    return sortedKeyPools.value.filter(item => {
        // 1. 关键词筛选（匹配充电桩ID或名称）
        const keywordMatch = filterKeyword.value
            ? (item.stationId && item.stationId == filterKeyword.value) ||
            (item.stationName && item.stationName == filterKeyword.value)
            : true;

        // 2. 状态筛选（匹配选中的状态）
        const statusMatch = filterStatus.value
            ? item.status === filterStatus.value
            : true;

        // 同时满足两个条件
        return keywordMatch && statusMatch;
    });
});

// 接口调用函数
const fetchKeyPools = async () => {
    try {
        const response = await keyManageApi.getKeyPools();
        console.log(response);
        
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

// 获取可用密钥
const fetchUsableKeys = async (stationName) => {
    try {
        const response = await keyManageApi.getUsableKeys(stationName);
        return Array.isArray(response.data.data) ? response.data.data : [];
    } catch (error) {
        console.error(`获取充电桩${stationName}可用密钥失败:`, error);
        ElMessage.error(`获取充电桩${stationName}可用密钥失败`);
        return [];
    }
};

// 获取使用记录
const fetchUsageRecords = async (stationName) => {
    try {
        const response = await keyManageApi.getUsageRecords(stationName);
        return Array.isArray(response.data.data) ? response.data.data : [];
    } catch (error) {
        console.error(`获取充电桩${stationName}使用记录失败:`, error);
        ElMessage.error(`获取充电桩${stationName}使用记录失败`);
        return [];
    }
};

// 获取补充记录
const fetchRefillHistory = async (stationName) => {
    try {
        const response = await keyManageApi.getRefillHistory(stationName);
        console.log(response);
        
        return Array.isArray(response.data.data) ? response.data.data : [];
    } catch (error) {
        console.error(`获取充电桩${stationName}补充记录失败:`, error);
        ElMessage.error(`获取充电桩${stationName}补充记录失败`);
        return [];
    }
};

// 获取密钥信息
const refreshPools = () => {
    fetchKeyPools();
};

// 打开详情弹窗
const openDetailDialog = async (stationId, stationName) => {
    if (!stationId) {
        ElMessage.warning('请选择有效的充电桩');
        return;
    }
    currentStationId.value = stationId;
    detailData.value.availableKeys = await fetchUsableKeys(stationName);
    detailData.value.recentUsage = await fetchUsageRecords(stationName);
    detailData.value.refillHistory = await fetchRefillHistory(stationName);
    detailDialogVisible.value = true;
};

// 关闭弹窗时的处理
const handleDialogClose = () => {
  detailDialogVisible.value = false;
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