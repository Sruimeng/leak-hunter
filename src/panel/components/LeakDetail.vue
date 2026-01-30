<script setup lang="ts">
import type { ResourceDescriptor } from '../../types'

const props = defineProps<{
  resource: ResourceDescriptor
}>()

const emit = defineEmits<{
  generateFix: [resource: ResourceDescriptor]
}>()

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString()
}

function parseFrame(frame: string): { file: string; line: string; col: string } | null {
  const match = frame.match(/at (.+):(\d+):(\d+)/)
  if (!match) return null
  const [, file, line, col] = match
  return { file, line, col }
}
</script>

<template>
  <div class="detail-panel">
    <div class="detail-header">
      <h3 class="detail-title">Leak Details</h3>
      <span :class="`badge badge-${resource.type.toLowerCase()}`">
        {{ resource.type }}
      </span>
    </div>

    <div class="detail-section">
      <div class="detail-row">
        <span class="label">UUID</span>
        <code class="value">{{ resource.uuid }}</code>
      </div>
      <div class="detail-row">
        <span class="label">Allocated</span>
        <span class="value">{{ formatTimestamp(resource.timestamp) }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Component</span>
        <span class="value">{{ resource.component || 'Unknown' }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Disposed</span>
        <span :class="`value ${resource.disposed ? 'text-success' : 'text-danger'}`">
          {{ resource.disposed ? 'Yes' : 'No' }}
        </span>
      </div>
    </div>

    <div class="detail-section">
      <h4 class="section-title">Allocation Stack</h4>
      <div class="stack-trace">
        <div
          v-for="(frame, i) in resource.stack"
          :key="i"
          class="stack-frame"
        >
          <span class="frame-index">{{ i + 1 }}</span>
          <code class="frame-text">{{ frame }}</code>
        </div>
        <div v-if="resource.stack.length === 0" class="empty-stack">
          No stack trace available
        </div>
      </div>
    </div>

    <button class="btn-primary" @click="emit('generateFix', resource)">
      Generate Fix
    </button>
  </div>
</template>

<style scoped>
.detail-panel {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #eee;
}

.badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-texture {
  background: #f59e0b;
  color: white;
}

.badge-buffergeometry {
  background: #22c55e;
  color: white;
}

.badge-webglrenderer {
  background: #8b5cf6;
  color: white;
}

.badge-material {
  background: #06b6d4;
  color: white;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.label {
  color: #888;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.value {
  color: #eee;
  font-weight: 500;
}

code.value {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
}

.text-success {
  color: #22c55e;
}

.text-danger {
  color: #ef4444;
}

.section-title {
  margin: 0;
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stack-trace {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 8px;
  max-height: 180px;
  overflow-y: auto;
}

.stack-frame {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stack-frame:last-child {
  border-bottom: none;
}

.frame-index {
  color: #4f46e5;
  font-weight: 600;
  min-width: 16px;
}

.frame-text {
  font-family: 'Courier New', monospace;
  color: #ccc;
  word-break: break-all;
}

.empty-stack {
  text-align: center;
  color: #666;
  font-size: 11px;
  padding: 12px;
}

.btn-primary {
  padding: 8px 16px;
  background: #4f46e5;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-primary:active {
  background: #3730a3;
}
</style>
