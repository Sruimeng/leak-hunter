<script setup lang="ts">
import { computed } from 'vue'
import type { SceneCensus } from '../../types'

const props = defineProps<{
  history: SceneCensus[]
}>()

const latest = computed(() => props.history[props.history.length - 1])

const heapData = computed(() => props.history.map(c => c.memory.heapUsed / 1024 / 1024))
const geoData = computed(() => props.history.map(c => c.memory.gpuGeometries))
const texData = computed(() => props.history.map(c => c.memory.gpuTextures))

const maxHeap = computed(() => Math.max(...heapData.value, 1))
const maxGeo = computed(() => Math.max(...geoData.value, 1))
const maxTex = computed(() => Math.max(...texData.value, 1))

function toPath(data: number[], max: number): string {
  if (data.length === 0) return ''
  const width = 280
  const height = 40
  const step = width / Math.max(data.length - 1, 1)

  return data
    .map((v, i) => {
      const x = i * step
      const y = height - (v / max) * height
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="monitor">
    <div class="metric">
      <div class="metric-header">
        <span class="metric-label">JS Heap</span>
        <span class="metric-value">{{ latest ? formatBytes(latest.memory.heapUsed) : '-' }}</span>
      </div>
      <svg class="chart" viewBox="0 0 280 40">
        <path :d="toPath(heapData, maxHeap)" class="line line-heap" />
      </svg>
    </div>

    <div class="metric">
      <div class="metric-header">
        <span class="metric-label">Geometries</span>
        <span class="metric-value">{{ latest?.memory.gpuGeometries ?? '-' }}</span>
      </div>
      <svg class="chart" viewBox="0 0 280 40">
        <path :d="toPath(geoData, maxGeo)" class="line line-geo" />
      </svg>
    </div>

    <div class="metric">
      <div class="metric-header">
        <span class="metric-label">Textures</span>
        <span class="metric-value">{{ latest?.memory.gpuTextures ?? '-' }}</span>
      </div>
      <svg class="chart" viewBox="0 0 280 40">
        <path :d="toPath(texData, maxTex)" class="line line-tex" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.monitor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.metric-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.chart {
  width: 100%;
  height: 40px;
}

.line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.line-heap {
  stroke: #8b5cf6;
}

.line-geo {
  stroke: #22c55e;
}

.line-tex {
  stroke: #f59e0b;
}
</style>
