<template>
  <div class="p-6">
    <!-- 🟡 第一部分：SSE 实时刷新行 -->
    <el-card class="mb-6" shadow="hover">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold">🔄 实时通信更新</span>
          <el-tag style="margin-left: 10px;" :type="connected ? 'success' : 'danger'">
            {{ connected ? 'SSE已连接' : 'SSE未连接' }}
          </el-tag>
        </div>
      </template>

      <div class="p-6" v-if="latestPacket">
        <el-table
        v-if="latestPacket"
        :data="[latestPacket]"
        border
        stripe
        style="width: 100%; background-color: #f9fafb;"
        >
        <!-- 发送 → 接收 -->
        <el-table-column
            prop="senderName"
            label="发送 → 接收"
            width="250"
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
            width="180"
        >
            <template #default="scope">
            {{ formatTime(scope.row.timestamp) }}
            </template>
        </el-table-column>

        <!-- 明文 -->
        <el-table-column
            prop="plaintext"
            label="明文"
        >
            <template #default="scope">
            <span class="text-gray-700">{{ scope.row.plaintext }}</span>
            </template>
        </el-table-column>

        <!-- 密钥 -->
        <el-table-column
            prop="keyMaterial"
            label="密钥"
            width="180"
        >
        <template #default="scope">
          <el-tag type="info" effect="plain">{{ scope.row.keyMaterial }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
    <div v-else class="text-gray-400 text-center py-3">
        等待新数据中...
      </div>
    </el-card>

    <!-- 🔵 第二部分：历史通信数据 -->
    <el-card shadow="hover">
      <template #header>
        <span class="text-lg font-semibold" style="margin-right: 10px;">📦 近期通信历史</span>
          <el-button type="primary" size="small" @click="loadPackets">刷新</el-button>

      </template>

      <el-table :data="packets" border style="width: 100%">
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column prop="senderName" label="发送方" width="180" />
        <el-table-column prop="receiverName" label="接收方" width="180" />
        <el-table-column prop="keyMaterial" label="密钥 ID" width="160" />
        <el-table-column prop="plaintext" label="明文" />
        <el-table-column prop="ciphertext" label="密文">
          <template #default="{ row }">
            <el-tooltip content="点击复制密文">
              <span class="cursor-pointer text-blue-600" @click="copy(row.ciphertext)">
                <!-- {{ row.ciphertext.slice(0, 12) + '...' }} -->
                  {{ row.ciphertext }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { getSnapshot, getRecentPackets } from '@/api/communication.js';
import { getServerUrl } from '@/axios/request.js';
import { ElMessage } from 'element-plus';

const packets = ref([]);          // 历史记录
const latestPacket = ref(null);   // 实时SSE消息
const connected = ref(false);     // SSE连接状态
let eventSource = null;


// 加载近期历史数据
async function loadPackets() {
  try {
    const res = await getRecentPackets();
    packets.value = res.data.data;
  } catch (e) {
    console.error(e);
  }
}

// 连接 SSE 实时流
function connectSSE() {
  const url = `${getServerUrl()}api/communication/packets/stream`;
  eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener('open', () => {
    connected.value = true;
    console.log('✅ SSE 连接成功');
  });

  eventSource.addEventListener('packets', (event) => {
    try {
      const data = JSON.parse(event.data);
      latestPacket.value = data.messages?.[0]; // 实时行刷新
      console.log(latestPacket.value);
      
    } catch (e) {
      console.error('SSE 数据解析失败', e);
    }
  });

  eventSource.addEventListener('error', () => {
    connected.value = false;
    console.warn('❌ SSE 连接断开');
  });
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
  loadPackets();
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
