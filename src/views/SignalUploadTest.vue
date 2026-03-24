<template>
  <div class="upload-test-container">
    <h1>信号文件上传测试</h1>
    
    <!-- 文件选择区域 -->
    <div class="file-selection">
      <h2>1. 选择文件</h2>
      <input type="file" ref="fileInput" @change="handleFileSelect" />
      <div v-if="selectedFile" class="file-info">
        <p>文件名: {{ selectedFile.name }}</p>
        <p>文件大小: {{ formatFileSize(selectedFile.size) }}</p>
      </div>
    </div>
    
    <!-- 上传控制区域 -->
    <div class="upload-controls">
      <h2>2. 上传选项</h2>
      <div class="button-group">
        <button 
          @click="uploadCompleteFile" 
          :disabled="!selectedFile || isUploading"
          class="btn btn-primary"
        >
          完整上传
        </button>
        <button 
          @click="uploadChunkedFile" 
          :disabled="!selectedFile || isUploading"
          class="btn btn-success"
        >
          分片上传
        </button>
        <button 
          @click="checkUploadProgress" 
          :disabled="!uploadId"
          class="btn btn-info"
        >
          检查进度
        </button>
        <button 
          @click="completeUpload" 
          :disabled="!uploadId"
          class="btn btn-warning"
        >
          完成上传
        </button>
      </div>
    </div>
    
    <!-- 上传进度区域 -->
    <div class="upload-progress" v-if="isUploading || uploadProgress > 0">
      <h2>3. 上传进度</h2>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: uploadProgress + '%' }"
        ></div>
      </div>
      <p class="progress-text">{{ uploadStatus }}</p>
    </div>
    
    <!-- 实时数据展示区域 -->
    <div class="realtime-data">
      <h2>4. 实时波形数据</h2>
      <div class="waveform-container">
        <canvas ref="waveformCanvas" width="800" height="300"></canvas>
      </div>
      <p class="data-status" v-if="waveformData">
        接收数据点: {{ waveformData.magnitude?.length || 0 }}
      </p>
    </div>
    
    <!-- 操作日志区域 -->
    <div class="operation-log">
      <h2>5. 操作日志</h2>
      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'SignalUploadTest',
  data() {
    return {
      selectedFile: null,
      isUploading: false,
      uploadProgress: 0,
      uploadStatus: '',
      uploadId: localStorage.getItem('uploadId') || null,
      chunkSize: 2 * 50 * 1024 * 1024, // 2MB 分片
      logs: [],
      waveformData: null,
      eventSource: null
    };
  },
  mounted() {
    this.initSSE();
    this.log('页面已加载');
  },
  beforeUnmount() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  },
  methods: {
    // 处理文件选择
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        this.log(`文件选择: ${file.name} (${this.formatFileSize(file.size)})`);
      }
    },
    
    // 格式化文件大小
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // 完整上传
    async uploadCompleteFile() {
      if (!this.selectedFile) return;
      
      this.isUploading = true;
      this.uploadProgress = 0;
      this.uploadStatus = '开始上传...';
      this.log('开始完整上传');
      
      try {
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        
        const response = await axios.post('http://localhost:8000/api/signal/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            this.uploadProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            this.uploadStatus = `上传中: ${this.uploadProgress}%`;
          }
        });
        
        this.uploadStatus = '上传成功!';
        this.log(`完整上传成功: ${response.data.message}`);
      } catch (error) {
        this.uploadStatus = '上传失败!';
        this.log(`完整上传失败: ${error.message}`);
      } finally {
        this.isUploading = false;
      }
    },
    
    // 分片上传
    async uploadChunkedFile() {
      if (!this.selectedFile) return;
      
      this.isUploading = true;
      this.uploadProgress = 0;
      this.uploadStatus = '准备分片上传...';
      
      // 生成或使用现有 uploadId
      if (!this.uploadId) {
        this.uploadId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('uploadId', this.uploadId);
      }
      
      const fileSize = this.selectedFile.size;
      const totalChunks = Math.ceil(fileSize / this.chunkSize);
      
      this.log(`开始分片上传: ${totalChunks} 个分片`);
      
      try {
        // 检查上传进度
        await this.checkUploadProgress();
        
        // 上传分片
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * this.chunkSize;
          const end = Math.min(start + this.chunkSize, fileSize);
          const chunk = this.selectedFile.slice(start, end);
          
          this.uploadStatus = `上传分片 ${chunkIndex + 1}/${totalChunks}`;
          this.uploadProgress = Math.round((start / fileSize) * 100);
          
          const formData = new FormData();
          formData.append('uploadId', this.uploadId);
          formData.append('chunkIndex', chunkIndex);
          formData.append('totalChunks', totalChunks);
          formData.append('offset', start);
          formData.append('file', chunk);
          
          const response = await axios.post('http://localhost:8000/api/signal/upload/chunk', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          this.log(`分片 ${chunkIndex} 上传成功: ${response.data.message}`);
        }
        
        // 完成上传
        await this.completeUpload();
        
        this.uploadStatus = '分片上传成功!';
        this.uploadProgress = 100;
        this.log('分片上传完成');
      } catch (error) {
        this.uploadStatus = '分片上传失败!';
        this.log(`分片上传失败: ${error.message}`);
      } finally {
        this.isUploading = false;
      }
    },
    
    // 检查上传进度
    async checkUploadProgress() {
      if (!this.uploadId) return;
      
      try {
        const response = await axios.get(`http://localhost:8000/api/signal/upload/progress?uploadId=${this.uploadId}`);
        const progress = response.data.data;
        
        this.log(`上传进度: ${progress.receivedChunks.size} 个分片已上传, 当前偏移: ${progress.currentOffset}`);
        return progress;
      } catch (error) {
        this.log(`检查进度失败: ${error.message}`);
        return null;
      }
    },
    
    // 完成上传
    async completeUpload() {
      if (!this.uploadId) return;
      
      try {
        const response = await axios.post(`http://localhost:8000/api/signal/upload/complete?uploadId=${this.uploadId}`);
        this.log(`上传完成: ${response.data.message}`);
        
        // 清除 uploadId
        this.uploadId = null;
        localStorage.removeItem('uploadId');
      } catch (error) {
        this.log(`完成上传失败: ${error.message}`);
      }
    },
    
    // 初始化 SSE 连接
    initSSE() {
      try {
        this.eventSource = new EventSource('http://localhost:8000/api/signal/stream');
        
        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.waveformData = data;
            this.drawWaveform();
          } catch (error) {
            this.log(`解析 SSE 数据失败: ${error.message}`);
          }
        };
        
        this.eventSource.onerror = (error) => {
          this.log(`SSE 连接错误: ${error}`);
          // 尝试重连
          setTimeout(() => this.initSSE(), 5000);
        };
        
        this.log('SSE 连接已建立');
      } catch (error) {
        this.log(`SSE 连接失败: ${error.message}`);
      }
    },
    
    // 绘制波形
    drawWaveform() {
      const canvas = this.$refs.waveformCanvas;
      if (!canvas || !this.waveformData || !this.waveformData.magnitude) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const data = this.waveformData.magnitude;
      
      // 清空画布
      ctx.clearRect(0, 0, width, height);
      
      // 绘制波形
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * width;
        const y = height / 2 - (data[i] * height / 4); // 缩放数据
        ctx.lineTo(x, y);
      }
      
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    
    // 记录日志
    log(message) {
      const time = new Date().toLocaleTimeString();
      this.logs.unshift({ time, message });
      // 限制日志数量
      if (this.logs.length > 50) {
        this.logs.pop();
      }
    }
  }
};
</script>

<style scoped>
.upload-test-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

h2 {
  color: #555;
  margin-top: 30px;
  margin-bottom: 15px;
}

.file-selection {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.file-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #e8f5e8;
  border-radius: 4px;
}

.upload-controls {
  margin-bottom: 20px;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #2196F3;
  color: white;
}

.btn-success {
  background-color: #4CAF50;
  color: white;
}

.btn-info {
  background-color: #00BCD4;
  color: white;
}

.btn-warning {
  background-color: #FF9800;
  color: white;
}

.upload-progress {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-weight: bold;
  color: #333;
}

.realtime-data {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.waveform-container {
  text-align: center;
  margin: 20px 0;
}

.data-status {
  text-align: center;
  color: #666;
}

.operation-log {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background-color: #2c3e50;
  color: #ecf0f1;
  padding: 10px;
  border-radius: 4px;
}

.log-item {
  margin-bottom: 5px;
  padding: 5px;
  border-bottom: 1px solid #34495e;
}

.log-time {
  color: #3498db;
  margin-right: 10px;
  font-size: 12px;
}

.log-message {
  font-size: 14px;
}

@media (max-width: 768px) {
  .button-group {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
  
  .waveform-container canvas {
    width: 100%;
    height: auto;
  }
}
</style>
