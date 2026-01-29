<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
const apiKeyInput = ref('')
const saved = ref(false)

async function loadSettings(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: null })
  if (response.type === 'SETTINGS') {
    settings.value = response.payload
    apiKeyInput.value = response.payload.apiKey ?? ''
  }
}

async function saveApiKey(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'SET_API_KEY', payload: apiKeyInput.value })
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function toggleEnabled(): void {
  settings.value.enabled = !settings.value.enabled
}

onMounted(loadSettings)
</script>

<template>
  <div class="popup">
    <header class="header">
      <h1 class="title">🔍 Leak Hunter</h1>
      <span class="version">v1.0.0</span>
    </header>

    <section class="section">
      <label class="label">OpenAI API Key</label>
      <div class="input-group">
        <input
          v-model="apiKeyInput"
          type="password"
          class="input"
          placeholder="sk-..."
        />
        <button class="btn btn-primary" @click="saveApiKey">
          {{ saved ? '✓' : 'Save' }}
        </button>
      </div>
    </section>

    <section class="section">
      <label class="label">API Endpoint</label>
      <input
        v-model="settings.apiEndpoint"
        type="text"
        class="input"
        placeholder="https://api.openai.com/v1/chat/completions"
      />
    </section>

    <section class="section">
      <label class="label">Model</label>
      <select v-model="settings.model" class="input">
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4-turbo">gpt-4-turbo</option>
      </select>
    </section>

    <section class="section toggle-section">
      <span class="label">Monitoring</span>
      <button
        class="toggle"
        :class="{ active: settings.enabled }"
        @click="toggleEnabled"
      >
        {{ settings.enabled ? 'ON' : 'OFF' }}
      </button>
    </section>

    <footer class="footer">
      <p class="hint">Monitors Three.js memory leaks on page load</p>
    </footer>
  </div>
</template>

<style scoped>
.popup {
  padding: 16px;
  background: #1a1a2e;
  color: #eee;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.version {
  font-size: 12px;
  color: #666;
}

.section {
  margin-bottom: 12px;
}

.label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input {
  flex: 1;
  padding: 8px 12px;
  background: #16213e;
  border: 1px solid #333;
  border-radius: 6px;
  color: #eee;
  font-size: 14px;
}

.input:focus {
  outline: none;
  border-color: #4f46e5;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background: #4338ca;
}

.toggle-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle {
  padding: 6px 16px;
  background: #333;
  border: none;
  border-radius: 20px;
  color: #888;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle.active {
  background: #22c55e;
  color: white;
}

.footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: #666;
  text-align: center;
}
</style>
