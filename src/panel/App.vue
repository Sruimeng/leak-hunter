<script setup lang="ts">
import { ref, computed } from 'vue'
import Monitor from './components/Monitor.vue'
import Report from './components/Report.vue'
import type { SceneCensus, LeakReport } from '../types'

const isMinimized = ref(false)
const isDragging = ref(false)
const position = ref({ x: 20, y: 20 })
const dragOffset = ref({ x: 0, y: 0 })

const censusHistory = ref<SceneCensus[]>([])
const latestReport = ref<LeakReport | null>(null)

const isLeaking = computed(() => {
  if (censusHistory.value.length < 10) return false
  const recent = censusHistory.value.slice(-10)
  for (let i = 1; i < recent.length; i++) {
    if (recent[i]!.memory.heapUsed <= recent[i - 1]!.memory.heapUsed) return false
  }
  return true
})

function handleCensus(census: SceneCensus): void {
  censusHistory.value.push(census)
  if (censusHistory.value.length > 60) {
    censusHistory.value.shift()
  }
}

function handleReport(report: LeakReport): void {
  latestReport.value = report
}

function startDrag(e: MouseEvent): void {
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  }
}

function onDrag(e: MouseEvent): void {
  if (!isDragging.value) return
  position.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y,
  }
}

function endDrag(): void {
  isDragging.value = false
}

function toggleMinimize(): void {
  isMinimized.value = !isMinimized.value
}

// Listen for messages from content script
window.addEventListener('message', (e) => {
  if (e.data?.type === 'LEAK_HUNTER_CENSUS') {
    handleCensus(e.data.payload)
  }
  if (e.data?.type === 'ANALYSIS_RESULT') {
    handleReport(e.data.payload)
  }
})
</script>

<template>
  <div
    class="panel"
    :class="{ minimized: isMinimized, leaking: isLeaking }"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @mousemove="onDrag"
    @mouseup="endDrag"
    @mouseleave="endDrag"
  >
    <header class="header" @mousedown="startDrag">
      <span class="title">
        <span class="icon">🔍</span>
        Leak Hunter
      </span>
      <div class="controls">
        <span v-if="isLeaking" class="badge badge-danger">LEAKING</span>
        <button class="btn-icon" @click.stop="toggleMinimize">
          {{ isMinimized ? '▼' : '▲' }}
        </button>
      </div>
    </header>

    <div v-if="!isMinimized" class="content">
      <Monitor :history="censusHistory" />
      <Report v-if="latestReport" :report="latestReport" />
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  width: 320px;
  background: rgba(26, 26, 46, 0.95);
  border: 1px solid #333;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  color: #eee;
  font-size: 13px;
  z-index: 999999;
  backdrop-filter: blur(8px);
  transition: border-color 0.3s;
}

.panel.leaking {
  border-color: #ef4444;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #333;
  border-radius: 8px 8px 0 0;
  cursor: move;
  user-select: none;
}

.minimized .header {
  border-radius: 8px;
  border-bottom: none;
}

.title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.icon {
  font-size: 14px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-danger {
  background: #ef4444;
  color: white;
}

.btn-icon {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #eee;
}

.content {
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
