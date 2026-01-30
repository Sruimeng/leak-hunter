<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceDescriptor } from '../../types'

const props = defineProps<{
  resources: ResourceDescriptor[]
}>()

const emit = defineEmits<{
  select: [resource: ResourceDescriptor]
}>()

interface GroupedResource {
  component: string
  items: ResourceDescriptor[]
  leakCount: number
}

const grouped = computed(() => {
  const groups = new Map<string, ResourceDescriptor[]>()

  for (const r of props.resources) {
    const key = r.component || 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  return Array.from(groups.entries()).map(([component, items]) => ({
    component,
    items,
    leakCount: items.filter(i => !i.disposed && age(i) > 5000).length
  }))
})

function age(r: ResourceDescriptor): number {
  return Date.now() - r.timestamp
}

function status(r: ResourceDescriptor): 'active' | 'disposed' | 'leaked' {
  if (r.disposed) return 'disposed'
  return age(r) > 5000 ? 'leaked' : 'active'
}

function truncate(uuid: string): string {
  return uuid.slice(0, 8)
}

function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}
</script>

<template>
  <div class="table-container">
    <div v-for="group in grouped" :key="group.component" class="group">
      <div class="group-header">
        <span class="group-name">{{ group.component }}</span>
        <span v-if="group.leakCount > 0" class="badge badge-leak">
          {{ group.leakCount }} leaked
        </span>
      </div>

      <table class="resource-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>UUID</th>
            <th>Age</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in group.items"
            :key="r.uuid"
            :class="`status-${status(r)}`"
            @click="emit('select', r)"
          >
            <td class="type">{{ r.type }}</td>
            <td class="uuid">{{ truncate(r.uuid) }}</td>
            <td class="age">{{ formatAge(age(r)) }}</td>
            <td class="status">
              <span :class="`badge badge-${status(r)}`">
                {{ status(r) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="grouped.length === 0" class="empty">
      No resources tracked yet
    </div>
  </div>
</template>

<style scoped>
.table-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #333;
}

.group-name {
  font-size: 12px;
  font-weight: 600;
  color: #4f46e5;
}

.resource-table {
  width: 100%;
  border-collapse: collapse;
}

.resource-table thead th {
  padding: 6px 8px;
  text-align: left;
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(0, 0, 0, 0.2);
}

.resource-table tbody tr {
  cursor: pointer;
  transition: background 0.2s;
}

.resource-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

.resource-table tbody tr.status-leaked {
  background: rgba(239, 68, 68, 0.1);
}

.resource-table tbody td {
  padding: 6px 8px;
  font-size: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.type {
  color: #22c55e;
  font-weight: 500;
}

.uuid {
  font-family: 'Courier New', monospace;
  color: #888;
}

.age {
  font-variant-numeric: tabular-nums;
}

.badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-leak {
  background: #ef4444;
  color: white;
  animation: pulse-leak 1s infinite;
}

.badge-active {
  background: #22c55e;
  color: white;
}

.badge-disposed {
  background: #6b7280;
  color: white;
}

.badge-leaked {
  background: #ef4444;
  color: white;
}

@keyframes pulse-leak {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.empty {
  padding: 24px;
  text-align: center;
  color: #666;
  font-size: 12px;
}
</style>
