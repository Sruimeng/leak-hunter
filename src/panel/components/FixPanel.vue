<script setup lang="ts">
import { ref } from 'vue'
import type { FixResult } from '../../types'

const props = defineProps<{
  result: FixResult | null
  loading: boolean
}>()

const copied = ref(false)

function copyToClipboard(): void {
  if (!props.result || !props.result.ok) return

  navigator.clipboard.writeText(props.result.fix)
  copied.value = true

  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="fix-panel">
    <div class="fix-header">
      <h3 class="fix-title">AI Fix Suggestion</h3>
      <span v-if="result?.ok" :class="`badge badge-${result.provider.toLowerCase().replace(' ', '-')}`">
        {{ result.provider }}
      </span>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Generating fix...</span>
    </div>

    <div v-else-if="result?.ok" class="fix-content">
      <pre><code>{{ result.fix }}</code></pre>
      <button class="btn-copy" @click="copyToClipboard">
        {{ copied ? '✓ Copied' : 'Copy to Clipboard' }}
      </button>
    </div>

    <div v-else-if="result && !result.ok" class="error-state">
      <span class="error-icon">⚠️</span>
      <p class="error-message">{{ result.error }}</p>
    </div>

    <div v-else class="empty-state">
      Select a leaked resource and click "Generate Fix"
    </div>
  </div>
</template>

<style scoped>
.fix-panel {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fix-title {
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

.badge-gemini-nano {
  background: #4285f4;
  color: white;
}

.badge-openai {
  background: #10a37f;
  color: white;
}

.badge-claude {
  background: #d4a574;
  color: #1a1a1a;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px;
  color: #888;
  font-size: 12px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #333;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fix-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

pre {
  margin: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  padding: 10px;
  overflow-x: auto;
  max-height: 240px;
  overflow-y: auto;
}

code {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #ccc;
  white-space: pre;
}

.btn-copy {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #eee;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-end;
}

.btn-copy:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
}

.error-icon {
  font-size: 32px;
}

.error-message {
  margin: 0;
  font-size: 12px;
  color: #ef4444;
  text-align: center;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #666;
  font-size: 12px;
}
</style>
