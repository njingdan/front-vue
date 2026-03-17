<template>
  <div class="p-6">
    <!-- SSE 实时数据展示 -->
    <el-card shadow="hover">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold">🔄 实时通信数据</span>
          <div>
            <el-tag :type="connected ? 'success' : 'danger'" style="margin-top: 10px;">
              {{ connected ? 'SSE已连接' : 'SSE未连接' }}
            </el-tag>
          </div>
        </div>
      </template>

      <div v-if="latestPackets.length > 0">
        <div class="mb-3 text-sm text-gray-500" style="margin-bottom: 10px;">
          实时推送最新 {{ latestPackets.length }} 条数据
        </div>
        <el-table
        :data="latestPackets"
        border
        stripe
        style="width: 100%; background-color: #f9fafb;"
        table-layout="auto"
        >
        <!-- 发送 → 接收 -->
        <el-table-column
            prop="senderName"
            label="发送 → 接收"
            min-width="200"
        >
            <template #default="scope">
            <span class="font-semibold text-blue-700">{{ scope.row.senderName }}</span>
            <span class="mx-1">→</span>
            <span class="font-semibold text-green-600">{{ scope.row.receiverName }}</span>
            </template>
        </el-table-column>

        <!-- 时间 -->
        <el-table-column
            prop="timestamp"
            label="时间"
            min-width="160"
        >
            <template #default="scope">
            {{ formatTime(scope.row.timestamp) }}
            </template>
        </el-table-column>

        <!-- 明文 -->
        <el-table-column
            prop="plaintext"
            label="明文"
            min-width="200"
        >
            <template #default="scope">
            <span class="text-gray-700">{{ scope.row.plaintext }}</span>
            </template>
        </el-table-column>

        <!-- 密钥 -->
        <el-table-column
            prop="keyMaterial"
            label="密钥"
            min-width="120"
        >
        <template #default="scope">
          <el-tag type="info" effect="plain">{{ scope.row.keyMaterial }}</el-tag>
        </template>
      </el-table-column>

      <!-- 密文 -->
      <el-table-column
            prop="ciphertext"
            label="密文"
            min-width="150"
        >
        <template #default="scope">
          <el-tooltip content="点击复制密文">
            <span class="cursor-pointer text-blue-600" @click="copy(scope.row.ciphertext)">
              {{ scope.row.ciphertext }}
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </div>
    <div v-else class="text-gray-400 text-center py-3">
        等待新数据中...
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { getServerUrl } from '@/axios/request.js';
import { ElMessage } from 'element-plus';

const latestPackets = ref([]);   // 实时SSE推送的最新20条数据
const connected = ref(false);     // SSE连接状态
let eventSource = null;

// 连接 SSE 实时流
function connectSSE() {
  const base = getServerUrl().replace(/\/+$/, ''); // 去掉末尾 /
  const url = `${base}/api/communication/data-packets/stream`;

  console.log('正在连接SSE:', url);

  // 标准 EventSource：第二个参数在现代浏览器支持（withCredentials）
  eventSource = new EventSource(url, { withCredentials: true });

  const handlePayload = (event) => {
    try {
      const data = JSON.parse(event.data);

      // 后端现在推送的是 “List<DataPacketEntity>”
      // 所以大多数情况下 data 就是数组
      let packetsData = [];
      if (Array.isArray(data)) {
        packetsData = data;
      } else if (data.preview && Array.isArray(data.preview)) {
        packetsData = data.preview;
      } else if (data.all && Array.isArray(data.all)) {
        packetsData = data.all.slice(0, 20);
      } else if (data.messages && Array.isArray(data.messages)) {
        packetsData = data.messages;
      }

      latestPackets.value = packetsData;
      console.log(`收到SSE(${event.type})推送数据:`, latestPackets.value.length, '条');
    } catch (e) {
      console.error('SSE 数据解析失败', e, 'raw=', event.data);
    }
  };

  // 连接成功/失败状态
  eventSource.onopen = () => {
    connected.value = true;
    console.log('✅ SSE 连接成功');
  };

  eventSource.onerror = (error) => {
    connected.value = false;
    console.warn('❌ SSE 连接错误:', error);
    // 不要在这里 close()，让浏览器自动重连；除非你想手动重连
  };

  // 监听后端命名事件：data-packets
  eventSource.addEventListener('data-packets', handlePayload);

  // 兜底：如果后端没命名事件，仍可走默认 message
  eventSource.onmessage = handlePayload;
}

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function copy(text) {
  navigator.clipboard.writeText(text);
  ElMessage.success('密文已复制');
}

onMounted(() => {
  connectSSE();
});

onBeforeUnmount(() => {
  if (eventSource) eventSource.close();
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
