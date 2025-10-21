<template>
  <div class="topology-container">
    <div ref="chartRef" class="chart" />
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

// 统一颜色规范
const LINK_COLORS = {
  normal: '#10b981',    // 绿色 - 联通
  transferring: '#3b82f6', // 蓝色 - 数据流过
  fault: '#ef4444'      // 红色 - 故障
};

// 将节点数据移到外部，避免重复处理时丢失属性
let nodes = [];
let links = [];

onMounted(() => {
  myChart = echarts.init(chartRef.value, null, {
    width: 1400,
    height: 700
  });

  // 节点数据 - 优化布局，确保连接紧密
  nodes = [
    // 核心设备区域 - 左侧垂直排列
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
    
    // QKD设备 - 中间位置
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
    
    // 储能区总线 - 调整位置确保连接紧密
    { 
      id: 'distributedBus', 
      name: '储能区总线', 
      x: 600, y: 400, 
      symbolSize: [500, 8],
      symbol: 'rect', 
      itemStyle: { borderColor: '#64748b', borderWidth: 1, color: '#e2e8f0' }, 
      label: { color: '#000', position: 'top', fontSize: 12 } 
    },
    
    // 分布式储能柜 - 调整位置确保连接紧密
    ...Array(6).fill().map((_, i) => ({
      id: `distributed${i+1}`,
      name: `分布式储能柜${i+1}`,
      x: 350 + i * 100,  // 均匀分布，与总线位置对应
      y: 480,  // 调整Y坐标，与总线保持适当距离但连接紧密
      symbolSize: 50,
      itemStyle: { 
        borderColor: '#10b981', 
        borderWidth: 2, 
        color: '#d1fae5' 
      },
      label: { color: '#000', position: 'center', fontSize: 10 },
      deviceType: 'distributed', // 确保这个属性存在
      status: 'normal' // 初始状态正常
    }))
  ];

  // 连线数据 - 按注释修正信息流向，确保连接紧密
  links = [
    // 核心设备间连线
    {
      // 交换机到网关B
      source: 'switch',
      target: 'gatewayB',
      name: '光纤',
      status: 'normal',
      lineStyle: { width: 3, opacity: 0.7 }
    },
    {
      // qkd2到qkd1
      source: 'qkd2',
      target: 'qkd1',
      name: '无线',
      status: 'normal',
      lineStyle: { width: 2, type: 'dashed', opacity: 0.7 }
    },
    {
      // 安全网关到qkd1
      source: 'gatewayB',
      target: 'qkd1',
      name: 'RJ45',
      status: 'normal',
      lineStyle: { width: 2, opacity: 0.7 }
    },
    {
      // 交换机到qkd2
      source: 'switch',
      target: 'qkd2',
      name: 'RJ45',
      status: 'normal',
      lineStyle: { width: 2, opacity: 0.7 }
    },
    {
      // 交换机到串口服务器
      source: 'switch',
      target: 'serialServer',
      name: 'RJ45',
      status: 'normal',
      lineStyle: { width: 2, opacity: 0.7 }
    },
    
    // 交换机 → 储能区总线
    {
      source: 'switch',
      target: 'distributedBus',
      name: 'RJ45',
      status: 'normal',
      lineStyle: { width: 2, opacity: 0.7 }
    },
    
    // 串口服务器 → 储能区总线
    {
      source: 'serialServer',
      target: 'distributedBus',
      name: 'RS485',
      status: 'normal',
      lineStyle: { width: 2, opacity: 0.7 }
    },
    
    // 储能区总线 → 分布式储能柜（信息从总线流向储能柜）
    ...Array(6).fill().map((_, i) => ({
      source: 'distributedBus',
      target: `distributed${i+1}`,
      name: 'RS485',
      status: 'normal',
      lineStyle: { 
        width: 2, 
        opacity: 0.7
      }
    }))
  ];

  const getOption = () => {
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
              return `${params.name}`;
            }
            const nodeStatus = params.data.status || 'normal';
            const statusText = nodeStatus === 'fault' ? '故障' : 
                             nodeStatus === 'transferring' ? '接收数据中' : '正常';
            return `${params.name}<br/>状态：${statusText}`;
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
          data: nodes.map(node => {
            // 根据节点状态更新颜色，但保留原始属性
            let itemStyle = { ...node.itemStyle };
            if (node.deviceType === 'distributed') {
              if (node.status === 'fault') {
                itemStyle = { borderColor: '#ef4444', borderWidth: 2, color: '#fecaca' };
              } else if (node.status === 'transferring') {
                itemStyle = { borderColor: '#3b82f6', borderWidth: 2, color: '#dbeafe' };
              } else {
                itemStyle = { borderColor: '#10b981', borderWidth: 2, color: '#d1fae5' };
              }
            }
            return {
              ...node, // 保留所有原始属性
              itemStyle
            };
          }),
          links: links.map(link => ({
            ...link,
            lineStyle: {
              ...link.lineStyle,
              color: LINK_COLORS[link.status] || LINK_COLORS.normal,
              width: link.status === 'transferring' ? 4 : (link.lineStyle.width || 2)
            },
            // 只有数据传输状态显示箭头，但不添加动画
            symbol: link.status === 'transferring' ? ['none', 'arrow'] : ['none', 'none'],
            symbolSize: link.status === 'transferring' ? [0, 12] : [0, 0],
            // 移除动画，箭头原地显示
            animation: false
          })),
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
          onClick: (params) => {
            console.log('点击节点:', params.data); // 调试信息
            // 修复点击事件判断逻辑
            if (params.data && params.data.deviceType === 'distributed') {
              selectedDevice.value = params.data.name;
              realtimeKey.value = Math.random().toString(36).substring(2, 10).toUpperCase();
              keyDialogVisible.value = true;
            }
          },
          draggable: false,
        }
      ]
    };
  };

  myChart.setOption(getOption());

  // 三种状态模拟
  const simulateStatusChange = () => {
    let simulationCount = 0;
    
    setInterval(() => {
      simulationCount++;
      
      // 每3次循环切换一种模拟模式
      const mode = simulationCount % 3;
      
      // 重置所有状态
      links.forEach(link => {
        link.status = 'normal';
      });
      nodes.forEach(node => {
        if (node.deviceType === 'distributed') {
          node.status = 'normal';
        }
      });
      
      if (mode === 0) {
        // 模式1：正常状态 - 所有连线绿色，储能柜绿色
        console.log('模拟模式：正常状态');
      } 
      else if (mode === 1) {
        // 模式2：数据传输 - 随机选择2-3个储能柜接收数据，连线变蓝带箭头
        console.log('模拟模式：数据传输');
        const distributedNodes = nodes.filter(node => node.deviceType === 'distributed');
        const dataCount = Math.floor(Math.random() * 2) + 2; // 2-3个储能柜
        
        for (let i = 0; i < dataCount; i++) {
          if (distributedNodes.length > 0) {
            const randomNode = distributedNodes[Math.floor(Math.random() * distributedNodes.length)];
            randomNode.status = 'transferring';
            
            // 找到对应的连线也设置为数据传输状态
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
        // 模式3：故障状态 - 随机选择1-2个储能柜故障，变红色
        console.log('模拟模式：故障状态');
        const distributedNodes = nodes.filter(node => node.deviceType === 'distributed');
        const faultCount = Math.floor(Math.random() * 2) + 1; // 1-2个储能柜
        
        for (let i = 0; i < faultCount; i++) {
          if (distributedNodes.length > 0) {
            const randomNode = distributedNodes[Math.floor(Math.random() * distributedNodes.length)];
            randomNode.status = 'fault';
            
            // 找到对应的连线也设置为故障状态
            const correspondingLink = links.find(link => 
              link.target === randomNode.id && link.source === 'distributedBus'
            );
            if (correspondingLink) {
              correspondingLink.status = 'fault';
            }
          }
        }
      }
      
      myChart.setOption(getOption());
      
    }, 5000); // 每5秒切换一次状态
  };
  
  simulateStatusChange();

  window.addEventListener('resize', () => {
    myChart.resize({ width: 1400, height: 700 });
  });
});

onUnmounted(() => {
  if (myChart) {
    myChart.dispose();
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
  justify-content: center;
  align-items: center;
  overflow: auto;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 20px;
  box-sizing: border-box;
}
.chart {
  background-color: #f8fafc;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>