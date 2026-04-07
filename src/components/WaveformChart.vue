<template>
  <div class="waveform-chart">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  waveform: {
    type: Object,
    required: true
  },
  playbackState: {
    type: String,
    default: 'idle'
  }
})

const canvasRef = ref(null)
let ctx = null
let resizeObserver = null
let mouseMoveHandler = null
let mouseLeaveHandler = null

let renderedBuffer = []
let hoverIndex = -1

const parseSeries = (series) => {
  if (!Array.isArray(series)) {
    return []
  }
  return series.map((value) => Number(value)).filter((value) => Number.isFinite(value))
}

const getEmptyText = () => {
  switch (props.playbackState) {
    case 'queued':
      return 'Waiting in parser queue...'
    case 'playing':
      return 'Streaming waveform...'
    case 'completed':
      return 'Current file parsed'
    case 'error':
      return 'Stream error'
    default:
      return 'Waiting for waveform data'
  }
}

const ensureCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) {
    return false
  }

  const dpr = window.devicePixelRatio || 1
  const width = Math.max(300, Math.floor(canvas.clientWidth))
  const height = Math.max(180, Math.floor(canvas.clientHeight))
  const expectedWidth = Math.floor(width * dpr)
  const expectedHeight = Math.floor(height * dpr)

  if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
    canvas.width = expectedWidth
    canvas.height = expectedHeight
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
  }
  return true
}

const drawGrid = (width, height) => {
  if (!ctx) {
    return
  }

  ctx.strokeStyle = 'rgba(100, 121, 135, 0.16)'
  ctx.lineWidth = 1
  const lines = 4
  for (let i = 1; i <= lines; i += 1) {
    const y = (height / (lines + 1)) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

const drawRoundedRect = (x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const drawWaveform = () => {
  const canvas = canvasRef.value
  if (!canvas || !ctx || !ensureCanvasSize()) {
    return
  }

  const width = canvas.clientWidth
  const height = canvas.clientHeight

  ctx.clearRect(0, 0, width, height)
  drawGrid(width, height)

  if (!renderedBuffer.length) {
    hoverIndex = -1
    ctx.fillStyle = '#7a909f'
    ctx.font = '15px "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(getEmptyText(), width / 2, height / 2)
    return
  }

  let min = renderedBuffer[0]
  let max = renderedBuffer[0]
  for (let i = 1; i < renderedBuffer.length; i += 1) {
    const value = renderedBuffer[i]
    if (value < min) min = value
    if (value > max) max = value
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  const range = max - min
  const count = renderedBuffer.length
  if (hoverIndex >= count) {
    hoverIndex = count - 1
  }
  const xStep = count > 1 ? width / (count - 1) : width

  const strokeColor = props.playbackState === 'error' ? '#dc2626' : '#0f766e'
  const fillStart = props.playbackState === 'error' ? 'rgba(220, 38, 38, 0.20)' : 'rgba(15, 118, 110, 0.20)'
  const fillEnd = props.playbackState === 'error' ? 'rgba(220, 38, 38, 0.00)' : 'rgba(15, 118, 110, 0.00)'

  ctx.beginPath()
  for (let i = 0; i < count; i += 1) {
    const x = i * xStep
    const normalized = (renderedBuffer[i] - min) / range
    const y = height - normalized * height
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, fillStart)
  gradient.addColorStop(1, fillEnd)

  ctx.lineWidth = 2
  ctx.strokeStyle = strokeColor
  ctx.stroke()

  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  if (hoverIndex >= 0 && hoverIndex < count) {
    const value = renderedBuffer[hoverIndex]
    const x = count > 1 ? hoverIndex * xStep : width / 2
    const normalized = (value - min) / range
    const y = height - normalized * height

    ctx.save()

    ctx.strokeStyle = 'rgba(24, 58, 76, 0.35)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    const label = `${value.toFixed(4)}`
    ctx.font = '12px "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
    const paddingX = 8
    const textWidth = ctx.measureText(label).width
    const boxWidth = textWidth + paddingX * 2
    const boxHeight = 24

    let boxX = x + 10
    if (boxX + boxWidth > width - 6) {
      boxX = x - boxWidth - 10
    }
    if (boxX < 6) {
      boxX = 6
    }

    let boxY = y - boxHeight - 10
    if (boxY < 6) {
      boxY = y + 10
    }
    if (boxY + boxHeight > height - 6) {
      boxY = height - boxHeight - 6
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
    ctx.lineWidth = 1
    drawRoundedRect(boxX, boxY, boxWidth, boxHeight, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#eff7fb'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, boxX + paddingX, boxY + boxHeight / 2)

    ctx.restore()
  }
}

const updateHoverIndexByEvent = (event) => {
  const canvas = canvasRef.value
  if (!canvas || !renderedBuffer.length) {
    hoverIndex = -1
    drawWaveform()
    return
  }

  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0) {
    hoverIndex = -1
    drawWaveform()
    return
  }
  const localX = Math.min(Math.max(0, event.clientX - rect.left), rect.width)
  const count = renderedBuffer.length
  hoverIndex = count <= 1 ? 0 : Math.round((localX / rect.width) * (count - 1))
  drawWaveform()
}

const syncFromWaveform = (waveform) => {
  renderedBuffer = parseSeries(waveform?.amplitudes)
  drawWaveform()
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  ensureCanvasSize()
  resizeObserver = new ResizeObserver(() => drawWaveform())
  resizeObserver.observe(canvas.parentElement || canvas)

  mouseMoveHandler = (event) => updateHoverIndexByEvent(event)
  mouseLeaveHandler = () => {
    hoverIndex = -1
    drawWaveform()
  }
  canvas.addEventListener('mousemove', mouseMoveHandler)
  canvas.addEventListener('mouseleave', mouseLeaveHandler)

  syncFromWaveform(props.waveform)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  const canvas = canvasRef.value
  if (canvas && mouseMoveHandler) {
    canvas.removeEventListener('mousemove', mouseMoveHandler)
  }
  if (canvas && mouseLeaveHandler) {
    canvas.removeEventListener('mouseleave', mouseLeaveHandler)
  }
  mouseMoveHandler = null
  mouseLeaveHandler = null
})

watch(
  () => props.waveform,
  (nextWaveform) => {
    syncFromWaveform(nextWaveform)
  },
  { deep: true }
)

watch(
  () => props.playbackState,
  () => drawWaveform()
)
</script>

<style scoped>
.waveform-chart {
  width: 100%;
  height: 100%;
  min-height: 320px;
  border: 1px solid rgba(210, 223, 229, 0.9);
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbfc 100%);
  overflow: hidden;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
