<template>
  <div class="security-log-page p-6">
    <el-card shadow="hover">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold">🔒 安全日志管理</span>
          <div class="flex gap-2 searchLine">
            <el-input
              v-model="keyword"
              placeholder="按关键字搜索（类型 / 发起者 / 接收者）"
              clearable
              style="width: 200px"
              @clear="fetchLogs"
              @keyup.enter="handleSearch"
            />
            <el-button style="margin-left: 10px;" type="primary" @click="handleSearch">搜索</el-button>
            <el-dropdown>
              <el-button style="margin-left: 10px;" type="success">
                导出日志
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="handleExport('csv')">导出 CSV</el-dropdown-item>
                  <el-dropdown-item @click="handleExport('json')">导出 JSON</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>

      <el-table :data="logs" border stripe style="width: 100%; margin-top: 10px">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column prop="eventTime" label="时间" width="180" align="center" />
        <el-table-column prop="eventType" label="类型" align="center" />
        <el-table-column prop="initiator" label="发起者" width="200" align="center" />
        <el-table-column prop="receiver" label="接收者" width="200" align="center" />
      </el-table>
      <!-- 分页组件 -->
      <div class="pagination">
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[5, 10, 15, 20]"
          layout="prev, pager, next, jumper, ->, total"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
      <!-- <div class="mt-6">
        <log-management :logs="logs" />
      </div> -->
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getLogsByPage, searchLogs, exportLogs } from '@/api/securityLog'
import LogManagement from '@/components/LogManagement.vue'

const logs = ref([])
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const fetchLogs = async () => {
  const { data } = await getLogsByPage(currentPage.value, pageSize.value);
  logs.value = data.data
  total.value = data.total
}

// 分页相关
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  fetchLogs()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  fetchLogs()
}

// 搜索日志
const handleSearch = async () => {
  currentPage.value = 1
  if (!keyword.value.trim()) {
    fetchLogs()
    return
  }
  const { data } = await searchLogs(keyword.value)
  logs.value = data
}

// 导出日志
const handleExport = async (format) => {
  const { data } = await exportLogs('', format)
  const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `security_logs.${format}`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  ElMessage.success(`日志已导出为 ${format.toUpperCase()} 文件`)
}

onMounted(fetchLogs)
</script>

<style scoped>
.security-log-page {
  background-color: #f8fafc;
  min-height: 100vh;
}
.searchLine {
  margin-top: 20px;
}
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
