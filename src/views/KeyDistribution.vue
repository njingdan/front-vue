<template>
    <div class="key-distribution-container">
        <!-- 主要内容区 -->
        <div class="main-content">
            <!-- 进度概览卡片 -->
            <el-card class="stat-card progress-overview">
                <div class="card-header">
                    <h2>分发进度</h2>

                    <div>
                        
                        当前步骤:
                        <el-tag effect="dark">
                            {{ getCurrentStage() }}
                        </el-tag>
                    </div>
                </div>

                <div class="progress-content">
                    <div class="stage-indicators">
                        <div v-for="(stage, index) in stages" :key="index" class="stage-indicator" :class="{
                            completed: progressData.progress >= stage.threshold,
                            active: isStageActive(stage, index)
                        }">
                            <div class="stage-icon">
                                <el-icon v-if="progressData.progress >= stage.threshold">
                                    <Check />
                                </el-icon>
                                <el-icon v-else>
                                    <Loading />
                                </el-icon>
                            </div>
                            <div class="stage-name">{{ stage.name }}</div>
                        </div>
                    </div>
                </div>
            </el-card>

            <!-- 主要数据展示区 -->
            <div class="data-grid">
                <!-- 信道状态卡片 -->
                <el-card class="stat-card channel-status-card">
                    <div class="card-header">
                        <h2>量子信道状态</h2>
                        <el-tag :type="getChannelStatusType()" size="small">
                            {{ getChannelStatusText() }}
                        </el-tag>
                    </div>

                    <div class="channel-metrics">
                        <div class="metric-item">
                            <div class="metric-label">光功率</div>
                            <div class="metric-value">{{ channelStatus.metrics?.opticalPower || 'N/A' }} dBm</div>
                            <div class="metric-trend" :class="getTrendClass('opticalPower')">
                                <el-icon :size="16">
                                    <ArrowUp v-if="channelTrends.opticalPower === 'up'" />
                                    <ArrowDown v-if="channelTrends.opticalPower === 'down'" />
                                    <Minus v-if="channelTrends.opticalPower === 'stable'" />
                                </el-icon>
                            </div>
                        </div>

                        <div class="metric-item">
                            <div class="metric-label">误码率</div>
                            <div class="metric-value">{{ channelStatus.metrics?.errorRate ?
                                (channelStatus.metrics.errorRate * 100) + '%' : 'N/A' }}</div>
                            <div class="metric-trend" :class="getTrendClass('errorRate')">
                                <el-icon :size="16">
                                    <ArrowUp v-if="channelTrends.errorRate === 'up'" />
                                    <ArrowDown v-if="channelTrends.errorRate === 'down'" />
                                    <Minus v-if="channelTrends.errorRate === 'stable'" />
                                </el-icon>
                            </div>
                        </div>

                        <div class="metric-item">
                            <div class="metric-label">偏振度</div>
                            <div class="metric-value">{{ channelStatus.metrics?.polarization || 'N/A' }}</div>
                            <div class="metric-trend" :class="getTrendClass('polarization')">
                                <el-icon :size="16">
                                    <ArrowUp v-if="channelTrends.polarization === 'up'" />
                                    <ArrowDown v-if="channelTrends.polarization === 'down'" />
                                    <Minus v-if="channelTrends.polarization === 'stable'" />
                                </el-icon>
                            </div>
                        </div>

                        <div class="metric-item">
                            <div class="metric-label">信道温度</div>
                            <div class="metric-value">{{ channelStatus.metrics?.temperature || 'N/A' }} °C</div>
                            <div class="metric-trend" :class="getTrendClass('temperature')">
                                <el-icon :size="16">
                                    <ArrowUp v-if="channelTrends.temperature === 'up'" />
                                    <ArrowDown v-if="channelTrends.temperature === 'down'" />
                                    <Minus v-if="channelTrends.temperature === 'stable'" />
                                </el-icon>
                            </div>
                        </div>
                    </div>

                    <div class="channel-chart">
                        <el-divider content-position="left">信道状态趋势</el-divider>
                        <div class="chart-container">

                            <div class="chart-placeholder">
                                <el-skeleton active :rows="3" class="chart-skeleton" />
                            </div>
                        </div>
                    </div>
                </el-card>

                <!-- 流程日志卡片 -->
                <el-card class="stat-card process-log-card">
                    <div class="card-header">
                        <h2>分发流程日志</h2>
                        <el-select v-model="logFilter" placeholder="筛选阶段" size="small" @change="filterLogs"
                            style="width: 200px;">
                            <el-option label="全部阶段" value="" />
                            <el-option v-for="stage in stages" :key="stage.name" :label="stage.name"
                                :value="stage.name" />
                        </el-select>
                    </div>

                    <div class="log-container">
                        <el-scrollbar height="400px" class="log-scrollbar">
                            <div v-for="(log, index) in filteredLogs" :key="index" class="log-item"
                                :class="{ 'error-log': log.status === 'ERROR' }">
                                <div class="log-time">{{ formatTime(log.timestamp) }}</div>
                                <div class="log-stage">{{ log.step }}</div>
                                <div class="log-message">{{ log.description }}</div>
                                <div class="log-status">
                                    <el-tag :type="log.status === 'COMPLETED' ? 'success' :
                                        log.status === 'ERROR' ? 'danger' :
                                            log.status === 'WARNING' ? 'warning' : 'info'" size="mini">
                                        {{ log.status === 'COMPLETED' ? '成功' :
                                            log.status === 'ERROR' ? '错误' :
                                                log.status === 'WARNING' ? '警告' : '进行中' }}
                                    </el-tag>
                                </div>
                            </div>

                            <div v-if="filteredLogs.length === 0" class="no-logs">
                                <el-empty description="暂无日志记录" />
                            </div>
                        </el-scrollbar>
                    </div>
                </el-card>
            </div>

            <!-- 完整快照卡片 -->
            <el-card class="stat-card snapshot-card">
                <div class="card-header">
                    <h2>完整快照信息</h2>
                    <el-button type="info" size="small" @click="showSnapshotDetails" :icon="View">
                        查看详情
                    </el-button>
                </div>

                <div class="snapshot-summary">
                    <div class="snapshot-item">
                        <div class="snapshot-label">当前阶段</div>
                        <div class="snapshot-value">{{ getCurrentStage() }}</div>
                    </div>
                    <div class="snapshot-item">
                        <div class="snapshot-label">已生成密钥量</div>
                        <div class="snapshot-value">{{ snapshotData.generatedKeyAmount || '0' }} KB</div>
                    </div>
                    <div class="snapshot-item">
                        <div class="snapshot-label">密钥生成速率</div>
                        <div class="snapshot-value">{{ snapshotData.keyGenerationRate || '0' }} KB/s</div>
                    </div>
                    <div class="snapshot-item">
                        <div class="snapshot-label">运行时长</div>
                        <div class="snapshot-value">{{ formatDuration(snapshotData.runningTime || 0) }}</div>
                    </div>
                </div>
            </el-card>
        </div>

        <!-- 快照详情对话框 -->
        <el-dialog title="密钥分发完整快照" v-model="snapshotDialogVisible" width="70%" :close-on-click-modal="false">
            <pre class="snapshot-details">{{ JSON.stringify(snapshotData, null, 2) }}</pre>
        </el-dialog>

        <!-- 加载中状态 -->
        <el-loading v-if="loading" target=".main-content" text="加载数据中..." background="rgba(255, 255, 255, 0.8)" />
    </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import {
    ArrowUp, ArrowDown, Minus, Check, CircleCheck,
    View, Loading, Bell
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import keyDistributionApi from '@/api/key-distribute.js';

// 状态变量
const loading = ref(true);
const progressData = ref({
    progress: 0,
    status: '',
    estimatedCompletion: null
});
const channelStatus = ref({});
const processLogs = ref([]);
const filteredLogs = ref([]);
const snapshotData = ref({});
const logFilter = ref('');
const snapshotDialogVisible = ref(false);
const channelHistory = reactive({
    opticalPower: [],
    errorRate: [],
    polarization: [],
    temperature: []
});
const channelTrends = reactive({
    opticalPower: 'stable',
    errorRate: 'stable',
    polarization: 'stable',
    temperature: 'stable'
});

// 密钥分发阶段定义
const stages = [
    { name: '量子态传输', threshold: 25 },
    { name: '基矢协商', threshold: 50 },
    { name: '误码率测试', threshold: 75 },
    { name: '密钥提纯', threshold: 100 }
];

// 页面加载时获取数据
onMounted(() => {
    fetchAllData();

    // 定时刷新数据（每10秒）
    setInterval(() => {
        fetchAllData();
    }, 10000);
});

// 获取所有数据
const fetchAllData = async () => {
    try {
        loading.value = true;

        // 并行请求所有数据
        const [
            progressRes,
            channelRes,
            logsRes,
            snapshotRes
        ] = await Promise.all([
            keyDistributionApi.getDistributionProgress(),
            keyDistributionApi.getChannelStatus(),
            keyDistributionApi.getProcessLogs(),
            keyDistributionApi.getDistributionSnapshot()
        ]);

        // 注意：根据后端结构，需要通过response.data.data获取实际数据
        progressData.value = progressRes.data.data || { progress: 0, status: '', estimatedCompletion: null };
        const newChannelData = channelRes.data.data || {};
        updateChannelData(newChannelData);
        processLogs.value = logsRes.data.data || [];
        snapshotData.value = snapshotRes.data.data || {};

        // 初始化日志筛选
        filterLogs();
    } catch (error) {
        console.error('获取密钥分发数据失败:', error);
        ElMessage.error('获取数据失败，请稍后重试');
    } finally {
        loading.value = false;
    }
};

// 更新信道数据并计算趋势
const updateChannelData = (newData) => {
    channelStatus.value = newData;

    // 保存历史数据用于趋势计算
    if (newData.metrics) {
        Object.keys(newData.metrics).forEach(key => {
            if (channelHistory[key]) {
                // 只保留最近10条数据
                if (channelHistory[key].length >= 10) {
                    channelHistory[key].shift();
                }
                channelHistory[key].push(newData.metrics[key]);

                // 计算趋势
                if (channelHistory[key].length >= 2) {
                    const prev = channelHistory[key][channelHistory[key].length - 2];
                    const current = channelHistory[key][channelHistory[key].length - 1];

                    if (key === 'errorRate') {
                        // 误码率越低越好，所以趋势判断相反
                        channelTrends[key] = current > prev ? 'up' : current < prev ? 'down' : 'stable';
                    } else {
                        channelTrends[key] = current > prev ? 'up' : current < prev ? 'down' : 'stable';
                    }
                }
            }
        });
    }
};

// 刷新所有数据
const refreshAllData = () => {
    fetchAllData();
    ElMessage.success('数据已刷新');
};

// 筛选日志
const filterLogs = () => {
    if (!logFilter.value) {
        filteredLogs.value = [...processLogs.value].reverse(); // 最新的在前面
    } else {
        filteredLogs.value = processLogs.value
            .filter(log => log.step === logFilter.value)
            .reverse();
    }
};

// 显示快照详情
const showSnapshotDetails = () => {
    snapshotDialogVisible.value = true;
};

// 返回上一页
const handleBack = () => {
    // 实际项目中这里应该使用路由返回
    history.back();
};

// 格式化时间
const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// 格式化时长（秒 -> HH:MM:SS）
const formatDuration = (seconds) => {
    if (seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
        h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0')
    ].join(':');
};

// 获取当前阶段
const getCurrentStage = () => {
    const progress = progressData.value.progress || 0;

    if (progress >= 100) return '已完成';
    if (progress >= 75) return '密钥提纯';
    if (progress >= 50) return '误码率测试';
    if (progress >= 25) return '基矢协商';
    if (progress > 0) return '量子态传输';
    return '未开始';
};

// 获取信道状态文本
const getChannelStatusText = () => {
    // 根据实际业务逻辑判断信道状态
    if (!channelStatus.value.metrics) return '未知';

    const errorRate = channelStatus.value.metrics.errorRate || 0;
    const temperature = channelStatus.value.metrics.temperature || 0;

    if (errorRate > 0.01 || temperature > 35) return '错误';
    if (errorRate > 0.005 || temperature > 30) return '警告';
    return '正常';
};

// 获取信道状态标签类型
const getChannelStatusType = () => {
    const statusText = getChannelStatusText();
    switch (statusText) {
        case '正常':
            return 'success';
        case '警告':
            return 'warning';
        case '错误':
            return 'danger';
        default:
            return 'info';
    }
};

// 获取趋势样式类
const getTrendClass = (metric) => {
    switch (channelTrends[metric]) {
        case 'up':
            return 'trend-up';
        case 'down':
            return 'trend-down';
        case 'stable':
            return 'trend-stable';
        default:
            return '';
    }
};

// 判断阶段是否为当前活动阶段
const isStageActive = (stage, index) => {
    const currentPercent = progressData.value.progress || 0;
    const isCurrent = currentPercent >= (stages[index - 1]?.threshold || 0) &&
        currentPercent < stage.threshold;
    const isLast = index === stages.length - 1 && currentPercent >= stage.threshold;
    return isCurrent || (isLast && currentPercent < 100);
};
</script>

<style scoped>
/* 样式部分保持不变 */
.key-distribution-container {
    padding: 20px;
    background-color: #f5f7fa;
    min-height: 100vh;
}

.page-header {
    margin-bottom: 20px;
}

.main-content {
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

/* 进度概览样式 */
.progress-overview {
    padding-bottom: 20px;
}

.progress-content {
    padding: 20px;
}

.stage-indicators {
    display: flex;
    justify-content: space-between;
    position: relative;
    margin: 0 10px;
}

.stage-indicators::before {
    content: '';
    position: absolute;
    top: 15px;
    left: 30px;
    right: 30px;
    height: 2px;
    background-color: #e5e7eb;
    z-index: 1;
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
}

.stage-indicator.completed .stage-name,
.stage-indicator.active .stage-name {
    color: #333;
    font-weight: 500;
}

/* 数据网格布局 */
.data-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

@media (max-width: 1200px) {
    .data-grid {
        grid-template-columns: 1fr;
    }
}

/* 信道状态样式 */
.channel-status-card {
    display: flex;
    flex-direction: column;
}

.channel-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 20px;
}

@media (max-width: 768px) {
    .channel-metrics {
        grid-template-columns: 1fr;
    }
}

.metric-item {
    display: flex;
    align-items: center;
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
}

.metric-label {
    flex: 1;
    color: #666;
    font-size: 14px;
}

.metric-value {
    flex: 2;
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.metric-trend {
    width: 30px;
    text-align: center;
}

.trend-up {
    color: #f5222d;
}

.trend-down {
    color: #52c41a;
}

.trend-stable {
    color: #409eff;
}

.channel-chart {
    padding: 0 20px 20px;
}

.chart-container {
    height: 200px;
    margin-top: 10px;
}

.chart-skeleton {
    height: 100%;
}

/* 流程日志样式 */
.process-log-card {
    display: flex;
    flex-direction: column;
}

.log-container {
    padding: 20px;
}

.log-scrollbar {
    border: 1px solid #f0f0f0;
    border-radius: 6px;
}

.log-item {
    padding: 12px 5px;
    border-bottom: 1px solid #f0f0f0;
    display: grid;
    grid-template-columns: 180px 120px 1fr 80px;
    gap: 0px;
    align-items: center;
}

.log-item:last-child {
    border-bottom: none;
}

.log-item.error-log {
    background-color: rgba(245, 34, 45, 0.04);
}

.log-time {
    font-size: 13px;
    color: #999;
}

.log-stage {
    font-size: 14px;
    font-weight: 500;
}

.log-message {
    font-size: 14px;
    color: #333;
    word-break: break-all;
}

.log-status {
    text-align: right;
}

.no-logs {
    padding: 40px 0;
    text-align: center;
}

/* 快照信息样式 */
.snapshot-card {
    margin-top: 20px;
}

.snapshot-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    padding: 20px;
}

@media (max-width: 992px) {
    .snapshot-summary {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 576px) {
    .snapshot-summary {
        grid-template-columns: 1fr;
    }
}

.snapshot-item {
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
}

.snapshot-label {
    font-size: 14px;
    color: #666;
    margin-bottom: 5px;
}

.snapshot-value {
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.snapshot-details {
    max-height: 500px;
    overflow-y: auto;
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 6px;
    font-family: monospace;
}
</style>