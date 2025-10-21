<template>
  <div class="topology-container">
    <div ref="chartRef" class="chart" />
    
    <!-- 储能柜选择区域 -->
    <div class="cabinet-selector">
      <div class="selector-title">储能柜管理</div>
      <div class="selector-content">
        <div class="select-wrapper">
          <el-select
            v-model="selectedCabinet"
            placeholder="请选择储能柜"
            class="cabinet-select"
            @change="handleCabinetSelect"
          >
            <el-option
              v-for="i in 6"
              :key="i"
              :label="`储能柜 ${i}`"
              :value="i"
            />
          </el-select>
          <el-button 
            type="success" 
            @click="handleCabinetClick"
            class="confirm-btn"
            :disabled="!selectedCabinet"
          >
            查看密钥
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="keyDialogVisible" title="实时量子密钥" width="300px">
      <p>设备：{{ selectedDevice }}</p>
      <p>当前密钥：{{ realtimeKey }}</p>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';

const chartRef = ref(null);
let myChart = null;
const keyDialogVisible = ref(false);
const selectedDevice = ref('');
const realtimeKey = ref('');
const selectedCabinet = ref(null);
let simulationTimer = null;

// 统一颜色规范
const LINK_COLORS = {
  normal: '#10b981',    // 绿色 - 联通
  transferring: '#3b82f6', // 蓝色 - 数据流过
  fault: '#ef4444'      // 红色 - 故障
};

// 储能柜选择处理
const handleCabinetSelect = (value) => {
  selectedCabinet.value = value;
};

// 查看密钥按钮点击
const handleCabinetClick = () => {
  if (selectedCabinet.value) {
    selectedDevice.value = `分布式储能柜${selectedCabinet.value}`;
    realtimeKey.value = Math.random().toString(36).substring(2, 10).toUpperCase();
    keyDialogVisible.value = true;
  }
};

onMounted(() => {
  myChart = echarts.init(chartRef.value, null, {
    width: 1400,
    height: 700
  });

  // 创建基础节点数据 - 优化布局，减少距离
  const createNodes = () => {
    const baseNodes = [
      { 
        id: 'gatewayB', 
        name: '安全网关B', 
        x: 100, y: 100, 
        symbolSize: 60, 
        itemStyle: { borderColor: '#4895ef', borderWidth: 2, color: '#4895ef' }, 
        label: { color: '#000', position: 'center', fontSize: 12 } 
      },
      { 
        id: 'switch', 
        name: '交换机', 
        x: 100, y: 220, 
        symbolSize: 60, 
        itemStyle: { borderColor: '#64748b', borderWidth: 2, color: '#64748b' }, 
        label: { color: '#000', position: 'center', fontSize: 12 } 
      },
      { 
        id: 'serialServer', 
        name: '串口服务器', 
        x: 100, y: 340, 
        symbolSize: 50, 
        itemStyle: { borderColor: '#94a3b8', borderWidth: 2, color: '#94a3b8' }, 
        label: { color: '#000', position: 'center', fontSize: 12 } 
      },
      {
        id: 'qkd1',
        name: '量子密钥分配终端\n（上层）',
        x: 300, y: 100,
        symbolSize: [80, 40],
        symbol: 'rect',
        itemStyle: { borderColor: '#f59e0b', borderWidth: 2, color: '#f59e0b' },
        label: { color: '#000', position: 'center', fontSize: 10 }
      },
      {
        id: 'qkd2',
        name: '量子密钥分配终端\n（储能区）',
        x: 300, y: 220,
        symbolSize: [80, 40],
        symbol: 'rect',
        itemStyle: { borderColor: '#f59e0b', borderWidth: 2, color: '#f59e0b' },
        label: { color: '#000', position: 'center', fontSize: 10 }
      },
      { 
        id: 'distributedBus', 
        name: '储能区总线', 
        x: 450, y: 400,
        symbolSize: [400, 8],
        symbol: 'rect', 
        itemStyle: { borderColor: '#64748b', borderWidth: 1, color: '#e2e8f0' }, 
        label: { color: '#000', position: 'top', fontSize: 12 } 
      }
    ];

    // 储能柜布局优化 - 两行排列，更紧凑
    const distributedNodes = [
      // 第一行
      { id: 'distributed1', name: '储能柜1', x: 300, y: 480, symbolSize: 45, itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 }, deviceType: 'distributed', status: 'normal' },
      { id: 'distributed2', name: '储能柜2', x: 380, y: 480, symbolSize: 45, itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 }, deviceType: 'distributed', status: 'normal' },
      { id: 'distributed3', name: '储能柜3', x: 460, y: 480, symbolSize: 45, itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 }, deviceType: 'distributed', status: 'normal' },
      // 第二行
      { id: 'distributed4', name: '储能柜4', x: 340, y: 540, symbolSize: 45, itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 }, deviceType: 'distributed', status: 'normal' },
      { id: 'distributed5', name: '储能柜5', x: 420, y: 540, symbolSize: 45, itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 }, deviceType: 'distributed', status: 'normal' },
      { id: 'distributed6', name: '储能柜6', x: 500, y: 540, symbolSize: 45, itemStyle: { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' }, label: { color: '#000', position: 'center', fontSize: 10 }, deviceType: 'distributed', status: 'normal' }
    ];

    return [...baseNodes, ...distributedNodes];
  };

  // 创建连线数据
  const createLinks = () => {
    const baseLinks = [
      {
        source: 'switch',
        target: 'gatewayB',
        name: '光纤',
        status: 'normal',
        lineStyle: { width: 3, opacity: 0.7 }
      },
      {
        source: 'qkd2',
        target: 'qkd1',
        name: '无线',
        status: 'normal',
        lineStyle: { width: 2, type: 'dashed', opacity: 0.7 }
      },
      {
        source: 'gatewayB',
        target: 'qkd1',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'switch',
        target: 'qkd2',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'switch',
        target: 'serialServer',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'switch',
        target: 'distributedBus',
        name: 'RJ45',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      },
      {
        source: 'serialServer',
        target: 'distributedBus',
        name: 'RS485',
        status: 'normal',
        lineStyle: { width: 2, opacity: 0.7 }
      }
    ];

    const distributedLinks = [
      { source: 'distributedBus', target: 'distributed1', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributedBus', target: 'distributed2', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributedBus', target: 'distributed3', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributedBus', target: 'distributed4', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributedBus', target: 'distributed5', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } },
      { source: 'distributedBus', target: 'distributed6', name: 'RS485', status: 'normal', lineStyle: { width: 2, opacity: 0.7 } }
    ];

    return [...baseLinks, ...distributedLinks];
  };

  // 初始化数据
  const nodes = createNodes();
  const links = createLinks();

  const getOption = (currentNodes = nodes, currentLinks = links) => {
    const processedNodes = currentNodes.map(node => {
      const newNode = { ...node };
      
      if (newNode.deviceType === 'distributed') {
        if (newNode.status === 'fault') {
          newNode.itemStyle = { ...newNode.itemStyle, borderColor: '#ef4444', color: '#fecaca' };
        } else if (newNode.status === 'transferring') {
          newNode.itemStyle = { ...newNode.itemStyle, borderColor: '#3b82f6', color: '#dbeafe' };
        } else {
          newNode.itemStyle = { ...newNode.itemStyle, borderColor: '#10b981', color: '#d1fae5' };
        }
      }
      
      return newNode;
    });

    const processedLinks = currentLinks.map(link => ({
      ...link,
      lineStyle: {
        ...link.lineStyle,
        color: LINK_COLORS[link.status] || LINK_COLORS.normal,
        width: link.status === 'transferring' ? 4 : (link.lineStyle.width || 2)
      },
      symbol: link.status === 'transferring' ? ['none', 'arrow'] : ['none', 'none'],
      symbolSize: link.status === 'transferring' ? [0, 12] : [0, 0],
      animation: false
    }));

    return {
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      roam: true,
      grid: {
        left: 10, right: 10, top: 10, bottom: 10,
        containLabel: true
      },
      tooltip: { 
        trigger: 'item', 
        formatter: (params) => {
          if (params.dataType === 'node') {
            if (params.data.id.includes('Bus')) {
              return `${params.data.name}`;
            }
            const nodeStatus = params.data.status || 'normal';
            const statusText = nodeStatus === 'fault' ? '故障' : 
                             nodeStatus === 'transferring' ? '接收数据中' : '正常';
            return `${params.data.name}<br/>状态：${statusText}`;
          } else {
            const statusText = params.data.status === 'fault' ? '故障' : 
                             params.data.status === 'transferring' ? '数据传输中' : '正常联通';
            return `连接类型：${params.data.name}<br/>状态：${statusText}`;
          }
        }
      },
      series: [
        {
          type: 'graph',
          layout: 'none',
          data: processedNodes,
          links: processedLinks,
          label: {
            show: true,
            color: '#000',
            fontSize: 10,
            formatter: params => params.name,
            position: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: [3, 5],
            borderRadius: 3,
            borderColor: 'rgba(0,0,0,0.1)',
            borderWidth: 1
          },
          itemStyle: {
            borderWidth: 2
          },
          emphasis: {
            itemStyle: { 
              borderColor: '#facc15',
              shadowBlur: 10,
              shadowColor: 'rgba(250, 204, 21, 0.5)'
            },
            lineStyle: { 
              width: 4,
              color: '#facc15'
            }
          },
          draggable: false,
        }
      ]
    };
  };

  // 初始渲染
  myChart.setOption(getOption());

  // 三种状态模拟
  const simulateStatusChange = () => {
    let simulationCount = 0;
    
    simulationTimer = setInterval(() => {
      if (!myChart || myChart.isDisposed()) {
        clearInterval(simulationTimer);
        return;
      }
      
      simulationCount++;
      const mode = simulationCount % 3;
      
      // 重置所有状态
      nodes.forEach(node => {
        if (node.deviceType === 'distributed') {
          node.status = 'normal';
        }
      });
      links.forEach(link => {
        link.status = 'normal';
      });
      
      if (mode === 0) {
        console.log('模拟模式：正常状态');
      } 
      else if (mode === 1) {
        console.log('模拟模式：数据传输');
        const distributedNodes = nodes.filter(node => node.deviceType === 'distributed');
        const dataCount = Math.floor(Math.random() * 2) + 2;
        
        for (let i = 0; i < dataCount; i++) {
          if (distributedNodes.length > 0) {
            const randomNode = distributedNodes[Math.floor(Math.random() * distributedNodes.length)];
            randomNode.status = 'transferring';
            
            const correspondingLink = links.find(link => 
              link.target === randomNode.id && link.source === 'distributedBus'
            );
            if (correspondingLink) {
              correspondingLink.status = 'transferring';
            }
          }
        }
      } 
      else if (mode === 2) {
        console.log('模拟模式：故障状态');
        const distributedNodes = nodes.filter(node => node.deviceType === 'distributed');
        const faultCount = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < faultCount; i++) {
          if (distributedNodes.length > 0) {
            const randomNode = distributedNodes[Math.floor(Math.random() * distributedNodes.length)];
            randomNode.status = 'fault';
            
            const correspondingLink = links.find(link => 
              link.target === randomNode.id && link.source === 'distributedBus'
            );
            if (correspondingLink) {
              correspondingLink.status = 'fault';
            }
          }
        }
      }
      
      myChart.setOption(getOption(nodes, links));
      
    }, 5000);
  };
  
  simulateStatusChange();

  window.addEventListener('resize', () => {
    if (myChart && !myChart.isDisposed()) {
      myChart.resize({ width: 1400, height: 700 });
    }
  });
});

onUnmounted(() => {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
  
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
  
  window.removeEventListener('resize', () => {});
});
</script>

<style scoped>
.topology-container {
  width: 100%;
  height: 100%;
  min-height: 700px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: auto;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 20px;
  box-sizing: border-box;
  gap: 20px;
}

.chart {
  background-color: #f8fafc;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.cabinet-selector {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 1400px;
  border: 1px solid #e2e8f0;
}

.selector-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1f2937;
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 2px solid #10b981;
}

.selector-content {
  display: flex;
  justify-content: center;
}

.select-wrapper {
  display: flex;
  gap: 15px;
  align-items: center;
  width: 400px;
}

.cabinet-select {
  flex: 1;
}

.cabinet-select :deep(.el-input__inner) {
  height: 44px;
  border-radius: 8px;
  border: 2px solid #e2e8f0;
  font-size: 14px;
}

.cabinet-select :deep(.el-input__inner:focus) {
  border-color: #10b981;
}

.confirm-btn {
  height: 44px;
  padding: 0 25px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
  transition: all 0.3s ease;
  white-space: nowrap;
}

.confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
  background: linear-gradient(135deg, #059669, #047857);
}

.confirm-btn:active:not(:disabled) {
  transform: translateY(0);
}

.confirm-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>