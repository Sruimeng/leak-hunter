<script setup lang="ts">
import { ref, computed } from 'vue'
import Monitor from './components/Monitor.vue'
import Report from './components/Report.vue'
import ResourceTable from './components/ResourceTable.vue'
import LeakDetail from './components/LeakDetail.vue'
import FixPanel from './components/FixPanel.vue'
import type { SceneCensus, LeakReport, ResourceDescriptor, UuidLeakCandidate, FixResult } from '../types'

const isMinimized = ref(false)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const iframePos = ref({ x: 0, y: 0 })
const activeTab = ref<'monitor' | 'resources' | 'leaks'>('monitor')
const isRecording = ref(false)
const aiInterceptEnabled = ref(false)
const snapshotProgress = ref(false)

const censusHistory = ref<SceneCensus[]>([])
const latestReport = ref<LeakReport | null>(null)
const resources = ref<ResourceDescriptor[]>([])
const leaks = ref<UuidLeakCandidate[]>([])
const selectedLeak = ref<ResourceDescriptor | null>(null)
const fixResult = ref<FixResult | null>(null)
const fixLoading = ref(false)

const isLeaking = computed(() => {
  if (censusHistory.value.length < 10) return false
  const recent = censusHistory.value.slice(-10)
  for (let i = 1; i < recent.length; i++) {
    if (recent[i]!.memory.heapUsed <= recent[i - 1]!.memory.heapUsed) return false
  }
  return true
})

const leakCount = computed(() => leaks.value.length)

const vramUsageMB = computed(() => {
  if (!censusHistory.value.length) return 0
  const latest = censusHistory.value.at(-1)!
  return ((latest.memory.gpuGeometries + latest.memory.gpuTextures) * 1024) / 1024
})

const showWarning = computed(() => {
  return leakCount.value > 50 || vramUsageMB.value > 500
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

function handleResources(newResources: ResourceDescriptor[]): void {
  resources.value = newResources
}

function handleLeaks(newLeaks: UuidLeakCandidate[]): void {
  leaks.value = newLeaks
}

function startDrag(e: MouseEvent): void {
  isDragging.value = true
  dragStart.value = { x: e.screenX, y: e.screenY }
  window.parent.postMessage({ type: 'LEAK_HUNTER_DRAG_START' }, '*')
}

function onDrag(e: MouseEvent): void {
  if (!isDragging.value) return
  const dx = e.screenX - dragStart.value.x
  const dy = e.screenY - dragStart.value.y
  window.parent.postMessage({ type: 'LEAK_HUNTER_DRAG_MOVE', dx, dy }, '*')
}

function endDrag(): void {
  isDragging.value = false
}

function toggleMinimize(): void {
  isMinimized.value = !isMinimized.value
  window.parent.postMessage({
    type: isMinimized.value ? 'LEAK_HUNTER_MINIMIZE' : 'LEAK_HUNTER_RESTORE'
  }, '*')
}

function toggleRecording(): void {
  isRecording.value = !isRecording.value
  chrome.runtime.sendMessage({ type: isRecording.value ? 'START_RECORDING' : 'STOP_RECORDING' })
}

function takeSnapshot(): void {
  snapshotProgress.value = true
  chrome.runtime.sendMessage({ type: 'TAKE_SNAPSHOT' })

  setTimeout(() => {
    snapshotProgress.value = false
  }, 3000)
}

function selectResource(resource: ResourceDescriptor): void {
  selectedLeak.value = resource
  activeTab.value = 'leaks'
}

async function generateFix(resource: ResourceDescriptor): Promise<void> {
  fixLoading.value = true
  fixResult.value = null

  const leak: UuidLeakCandidate = {
    uuid: resource.uuid,
    age: Date.now() - resource.timestamp,
    descriptor: resource,
    component: resource.component
  }

  chrome.runtime.sendMessage({ type: 'GENERATE_FIX', payload: { leak } })
}

function handleFixResult(result: FixResult): void {
  fixResult.value = result
  fixLoading.value = false
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CENSUS_UPDATE') {
    handleCensus(msg.payload)
  }
  if (msg.type === 'ANALYSIS_RESULT') {
    handleReport(msg.payload)
  }
  if (msg.type === 'RESOURCES_UPDATE') {
    handleResources(msg.payload)
  }
  if (msg.type === 'LEAKS_DETECTED') {
    handleLeaks(msg.payload)
  }
  if (msg.type === 'FIX_RESULT') {
    handleFixResult(msg.payload)
  }
})
</script>

<template>
  <div
    class="panel"
    :class="{ minimized: isMinimized, leaking: isLeaking, warning: showWarning }"
    @mousemove="onDrag"
    @mouseup="endDrag"
    @mouseleave="endDrag"
  >
    <header class="header" @mousedown="startDrag">
      <span class="title">
        <span class="icon">🔍</span>
        Leak Hunter
        <span v-if="leakCount > 0" class="badge badge-leak-count">
          {{ leakCount }}
        </span>
      </span>
      <div class="controls">
        <span v-if="isLeaking" class="badge badge-danger">LEAKING</span>
        <button class="btn-icon" @click.stop="toggleMinimize">
          {{ isMinimized ? '▼' : '▲' }}
        </button>
      </div>
    </header>

    <div v-if="!isMinimized" class="content">
      <div v-if="showWarning" class="warning-banner">
        ⚠️ Critical: {{ leakCount > 50 ? `${leakCount} objects leaked` : `${vramUsageMB.toFixed(0)}MB VRAM used` }}
      </div>

      <div class="toolbar">
        <button
          :class="['btn-toolbar', { active: isRecording }]"
          @click="toggleRecording"
        >
          {{ isRecording ? '⏹ Stop' : '⏺ Record' }}
        </button>
        <button
          class="btn-toolbar"
          :disabled="snapshotProgress"
          @click="takeSnapshot"
        >
          {{ snapshotProgress ? '⏳' : '📸' }} Snapshot
        </button>
        <label class="switch">
          <input
            v-model="aiInterceptEnabled"
            type="checkbox"
          >
          <span class="slider"></span>
          <span class="switch-label">AI 拦截</span>
        </label>
      </div>

      <nav class="tabs">
        <button
          :class="['tab', { active: activeTab === 'monitor' }]"
          @click="activeTab = 'monitor'"
        >
          Monitor
        </button>
        <button
          :class="['tab', { active: activeTab === 'resources' }]"
          @click="activeTab = 'resources'"
        >
          Resources
        </button>
        <button
          :class="['tab', { active: activeTab === 'leaks' }]"
          @click="activeTab = 'leaks'"
        >
          Leaks
        </button>
      </nav>

      <div class="tab-content">
        <div v-show="activeTab === 'monitor'">
          <Monitor :history="censusHistory" />
          <Report v-if="latestReport" :report="latestReport" />
        </div>

        <div v-show="activeTab === 'resources'">
          <ResourceTable
            :resources="resources"
            @select="selectResource"
          />
        </div>

        <div v-show="activeTab === 'leaks'" class="leak-view">
          <LeakDetail
            v-if="selectedLeak"
            :resource="selectedLeak"
            @generate-fix="generateFix"
          />
          <FixPanel
            :result="fixResult"
            :loading="fixLoading"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(26, 26, 46, 0.98);
  border-radius: 8px;
  color: #eee;
  font-size: 13px;
  transition: border-color 0.3s;
  overflow: hidden;
}

.panel.leaking {
  border-color: #ef4444;
  animation: pulse 1s infinite;
}

.panel.warning {
  border-color: #f59e0b;
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

.badge-leak-count {
  background: #ef4444;
  color: white;
  animation: pulse-badge 1s infinite;
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
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
  max-height: 500px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warning-banner {
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  border-radius: 6px;
  font-size: 12px;
  color: #fbbf24;
  font-weight: 600;
  text-align: center;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.btn-toolbar {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #eee;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-toolbar:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-toolbar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-toolbar.active {
  background: #ef4444;
  border-color: #ef4444;
}

.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  cursor: pointer;
}

.switch input {
  position: absolute;
  opacity: 0;
}

.slider {
  position: relative;
  width: 32px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  transition: background 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  left: 2px;
  top: 2px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch input:checked + .slider {
  background: #4f46e5;
}

.switch input:checked + .slider::before {
  transform: translateX(16px);
}

.switch-label {
  font-size: 11px;
  color: #eee;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 6px;
}

.tab {
  flex: 1;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #888;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #eee;
}

.tab.active {
  background: #4f46e5;
  color: white;
}

.tab-content {
  min-height: 200px;
}

.leak-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
