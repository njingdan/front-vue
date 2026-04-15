<template>
  <div class="communication-page p-6">
    <el-card shadow="hover">
      <template #header>
        <div class="header-row">
          <span class="title">通信数据包上报与展示</span>
          <div class="actions">
            <el-tag :type="connected ? 'success' : 'danger'">
              {{ connected ? 'SSE 已连接' : 'SSE 未连接' }}
            </el-tag>
            <el-button type="primary" plain @click="fetchPackets">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="packetRows" border stripe table-layout="auto">
        <el-table-column prop="senderId" label="senderId" min-width="120"/>
        <el-table-column prop="senderName" label="senderName" min-width="140"/>
        <el-table-column prop="receiverId" label="receiverId" min-width="120"/>
        <el-table-column prop="receiverName" label="receiverName" min-width="140"/>
        <el-table-column prop="keyMaterial" label="keyMaterial" min-width="120"/>
        <el-table-column prop="traceId" label="traceId" min-width="220"/>
        <el-table-column prop="bizType" label="bizType" min-width="90"/>
        <el-table-column label="fileName" min-width="170">
          <template #default="scope">
            <el-link
              v-if="scope.row.id"
              type="primary"
              :underline="false"
              @click="openPlainPreview(scope.row)"
            >
              {{ displayPlainName(scope.row) }}
            </el-link>
            <span v-else>{{ displayPlainName(scope.row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="contentType" label="contentType" min-width="170"/>
        <el-table-column prop="algorithm" label="algorithm" min-width="120"/>
        <el-table-column prop="plainSize" label="plainSize" min-width="100"/>
        <el-table-column prop="cipherSize" label="cipherSize" min-width="100"/>
        <el-table-column label="密文摘要" min-width="180">
          <template #default="scope">
            <span class="cipher-preview">{{ scope.row.ciphertextPreview || scope.row.ciphertext || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="scope">
            {{ formatTime(scope.row.createdAt || scope.row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="120">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="45%" title="通信记录详情">
      <div v-if="detailLoading" class="state-text">加载中...</div>
      <div v-else-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="senderId">{{ detailData.senderId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="senderName">{{ detailData.senderName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="receiverId">{{ detailData.receiverId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="receiverName">{{ detailData.receiverName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="keyMaterial">{{ detailData.keyMaterial || '-' }}</el-descriptions-item>
          <el-descriptions-item label="traceId">{{ detailData.traceId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="version">{{ detailData.version || '-' }}</el-descriptions-item>
          <el-descriptions-item label="bizType">{{ detailData.bizType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="fileName">{{ detailData.fileName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="contentType">{{ detailData.contentType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="algorithm">{{ detailData.algorithm || '-' }}</el-descriptions-item>
          <el-descriptions-item label="keyId">{{ detailData.keyId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="plainSize">{{ detailData.plainSize ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="cipherSize">{{ detailData.cipherSize ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="密文文件名">{{ detailData.ciphertextName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="密文大小">{{ formatBytes(detailData.ciphertextFileSize) }}</el-descriptions-item>
          <el-descriptions-item label="密文摘要" :span="2">
            <span class="cipher-preview">{{ detailData.ciphertextPreview || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="原文文件名" :span="2">
            <el-link
              v-if="detailData.id"
              type="primary"
              :underline="false"
              @click="openPlainPreview(detailData)"
            >
              {{ detailData.plainFileName || detailData.fileName || '-' }}
            </el-link>
            <span v-else>{{ detailData.plainFileName || detailData.fileName || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="原文大小">{{ formatBytes(detailData.plainFileSize) }}</el-descriptions-item>
          <el-descriptions-item label="原文MIME">{{ detailData.plainFileContentType || detailData.contentType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="previewType">{{ detailData.previewType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="可预览">{{ detailData.plainFileAvailable ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(detailData.createdAt || detailData.timestamp) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(detailData.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <div v-else class="state-text">暂无详情</div>
    </el-drawer>

    <el-dialog v-model="previewVisible" width="72%" title="原文文件预览">
      <div v-if="previewLoading" class="state-text">加载中...</div>
      <div v-else-if="previewData">
        <el-descriptions :column="2" border class="mb-3">
          <el-descriptions-item label="文件名">{{ previewData.fileName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ previewData.previewType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="contentType">{{ previewData.contentType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatBytes(previewData.fileSize) }}</el-descriptions-item>
          <el-descriptions-item label="后缀">{{ previewData.fileExt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="存储路径">{{ previewData.filePath || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="previewData.message"
          :title="previewData.message"
          type="info"
          show-icon
          :closable="false"
          class="mb-3"
        />

        <pre
          v-if="previewData.previewType === 'text' || previewData.previewType === 'json'"
          class="preview-text"
        >{{ previewData.content || '(空内容)' }}</pre>

        <div v-else-if="previewData.previewType === 'image'" class="image-preview-wrap">
          <img :src="previewData.fileUrl" alt="plain image" class="image-preview"/>
          <el-link :href="previewData.fileUrl" target="_blank" type="primary">新窗口打开图片</el-link>
        </div>

        <div v-else class="binary-preview">
          <div>二进制文件不做内容渲染。</div>
          <el-link :href="previewData.fileUrl" target="_blank" type="primary">下载原文文件</el-link>
        </div>
      </div>
      <div v-else class="state-text">暂无可预览内容</div>
    </el-dialog>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getServerUrl } from '@/axios/request';
import {
  getCommunicationDetail,
  getDataPackets,
  getPlainFileUrl,
  getPlainPreview
} from '@/api/communication';

const packetRows = ref([]);
const loading = ref(false);
const connected = ref(false);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref(null);
const previewVisible = ref(false);
const previewLoading = ref(false);
const previewData = ref(null);
let eventSource = null;
const serverBaseUrl = getServerUrl().replace(/\/+$/, '');

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function formatBytes(size) {
  if (size === null || size === undefined || Number.isNaN(Number(size))) return '-';
  const num = Number(size);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(2)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function displayPlainName(row) {
  return row?.plainFileName || row?.fileName || '-';
}

function normalizeFileUrl(rawUrl, id) {
  const fallback = getPlainFileUrl(id);
  if (!rawUrl) return fallback;

  const url = String(rawUrl).trim();
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/api/')) {
        return `${serverBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return url;
    } catch (e) {
      return fallback;
    }
  }
  if (url.startsWith('/')) return `${serverBaseUrl}${url}`;
  if (url.startsWith('api/')) return `${serverBaseUrl}/${url}`;
  return fallback;
}

function normalizePacket(packet) {
  const row = packet || {};
  if (!row.previewType) {
    row.previewType = inferPreviewType(row.contentType || row.plainFileContentType, row.fileName || row.plainFileName);
  }
  if (!row.ciphertextPreview && row.ciphertext) {
    const text = String(row.ciphertext);
    row.ciphertextPreview = text.length > 128 ? `${text.slice(0, 128)}...` : text;
  }
  return row;
}

function inferPreviewType(contentType, fileName) {
  const type = (contentType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();
  if (type === 'application/json' || lowerName.endsWith('.json')) return 'json';
  if (type.startsWith('text/')) return 'text';
  if (type.startsWith('image/')) return 'image';
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/.test(lowerName)) return 'image';
  if (/\.(txt|log|csv|xml|md)$/.test(lowerName)) return 'text';
  return 'binary';
}

function mergeIncomingRows(incomingRows) {
  const map = new Map();
  packetRows.value.forEach((item) => {
    if (item && item.id !== undefined && item.id !== null) {
      map.set(item.id, item);
    }
  });

  incomingRows.forEach((item) => {
    const row = normalizePacket(item);
    if (row && row.id !== undefined && row.id !== null) {
      map.set(row.id, row);
    }
  });

  packetRows.value = Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || a.timestamp || 0).getTime();
    const tb = new Date(b.createdAt || b.timestamp || 0).getTime();
    if (tb !== ta) return tb - ta;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

async function fetchPackets() {
  loading.value = true;
  try {
    const resp = await getDataPackets();
    const payload = resp?.data?.data;

    let rows = [];
    if (Array.isArray(payload)) {
      rows = payload;
    } else if (Array.isArray(payload?.all)) {
      rows = payload.all;
    } else if (Array.isArray(payload?.preview)) {
      rows = payload.preview;
    }

    packetRows.value = rows.map((item) => normalizePacket(item));
  } catch (error) {
    ElMessage.error('获取通信记录失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function openDetail(row) {
  if (!row?.id) {
    ElMessage.warning('记录缺少ID，无法查看详情');
    return;
  }

  detailVisible.value = true;
  detailLoading.value = true;
  detailData.value = null;
  try {
    const resp = await getCommunicationDetail(row.id);
    detailData.value = resp?.data?.data || null;
  } catch (error) {
    ElMessage.error('获取详情失败');
    console.error(error);
  } finally {
    detailLoading.value = false;
  }
}

async function openPlainPreview(row) {
  if (!row?.id) {
    ElMessage.warning('记录缺少ID，无法预览原文');
    return;
  }

  previewVisible.value = true;
  previewLoading.value = true;
  previewData.value = null;

  try {
    const resp = await getPlainPreview(row.id);
    const data = resp?.data?.data || {};
    previewData.value = {
      ...data,
      id: row.id,
      fileName: data.fileName || displayPlainName(row),
      contentType: data.contentType || row.plainFileContentType || row.contentType,
      previewType: data.previewType || row.previewType || inferPreviewType(row.contentType, displayPlainName(row)),
      fileSize: data.fileSize ?? row.plainFileSize ?? row.plainSize,
      fileExt: data.fileExt || row.plainFileExt,
      filePath: data.filePath || row.plainFilePath,
      fileUrl: normalizeFileUrl(data.fileUrl, row.id)
    };
  } catch (error) {
    ElMessage.error('加载原文预览失败');
    console.error(error);
  } finally {
    previewLoading.value = false;
  }
}

function connectSSE() {
  const base = getServerUrl().replace(/\/+$/, '');
  const url = `${base}/api/communication/data-packets/stream`;

  eventSource = new EventSource(url, { withCredentials: true });

  const onPayload = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (Array.isArray(data)) {
        mergeIncomingRows(data);
      }
    } catch (error) {
      console.error('SSE 解析失败:', error);
    }
  };

  eventSource.onopen = () => {
    connected.value = true;
  };

  eventSource.onerror = () => {
    connected.value = false;
  };

  eventSource.addEventListener('data-packets', onPayload);
  eventSource.onmessage = onPayload;
}

onMounted(async () => {
  await fetchPackets();
  connectSSE();
});

onBeforeUnmount(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<style scoped>
.communication-page {
  width: 100%;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.state-text {
  color: #666;
}

.cipher-preview {
  font-family: 'Courier New', monospace;
  color: #5f6368;
  word-break: break-all;
}

.preview-text {
  margin: 0;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
}

.image-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image-preview {
  max-width: 100%;
  max-height: 520px;
  object-fit: contain;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.binary-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #475569;
}

.mb-3 {
  margin-bottom: 12px;
}
</style>
