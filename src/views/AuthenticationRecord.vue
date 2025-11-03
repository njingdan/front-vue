<template>
  <div class="auth-record-currentPage p-6">
    <!-- 标题栏 -->
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-lg font-semibold" style="margin-bottom: 10px;">📡 设备认证记录管理</h1>
    </div>

    <!-- 数据统计 -->
    <el-card shadow="hover" class="mb-4">
      <AuthenticationStatistics />
    </el-card>

    <!-- 表格部分 -->
    <el-card shadow="hover">
      <template #header>
        <div class="flex justify-between items-center">
          <span>📋 认证记录列表</span>
        </div>
      </template>

      <el-table :data="records" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="deviceId" label="设备ID" />
        <el-table-column prop="result" label="认证结果">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="similarity" label="相似度（%）" />
        <el-table-column prop="timestamp" label="认证时间" />
      </el-table>
        <!-- 分页组件 -->
      <div class="pagination" style="margin-top: 10px;">
        <el-pagination
          :current-currentPage="currentPage"
          :currentPage-size="pageSize"
          :currentPage-sizes="[5, 10, 15, 20]"
          layout="prev, pager, next, jumper, ->, total"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAuthRecords } from '@/api/authenticationRecord'
import AuthenticationStatistics from '@/components/AuthenticationStatistics.vue'

// ======== 表格与分页 ========
const records = ref([])

// 分页变量
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const loadRecords = async () => {
  const res = await getAuthRecords(currentPage.value, pageSize.value)

  records.value = res.data.records || []
  total.value = res.data.total || 0
}

// 分页相关
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadRecords()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  loadRecords()
}

// ======== 页面加载 ========
onMounted(() => {
  loadRecords()
})
</script>

<style scoped>
.auth-record-currentPage {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
