// Background Service Worker - AI API proxy and state coordination

import type {
  RuntimeMessage,
  RuntimeResponse,
  SceneCensus,
  LeakReport,
  Settings,
  ResourceDescriptor,
  LeakWarning,
  UuidLeakCandidate,
} from '../types'
import { getStoredSettings, saveSettings, getApiKey } from '../utils/storage'
import { saveSnapshot, getLastSnapshot } from './snapshot-store'
import { computeDiff as computeResourceDiff } from './diff-engine'
import { generateFix } from './ai-copilot'
import { ANALYSIS_SYSTEM_PROMPT } from './prompts'


let beforeSnapshot: SceneCensus | null = null
let pendingAnalysis = false

type LegacyDiff = { name: string; before: number; after: number }

function computeLegacyDiff(
  before: SceneCensus,
  after: SceneCensus
): LegacyDiff[] {
  const leaked: LegacyDiff[] = []

  for (const [name, count] of Object.entries(before.objects)) {
    const afterCount = after.objects[name] ?? 0
    if (afterCount >= count && count > 0) {
      leaked.push({ name, before: count, after: afterCount })
    }
  }

  for (const [name, count] of Object.entries(after.objects)) {
    if (!(name in before.objects) && count > 0) {
      leaked.push({ name, before: 0, after: count })
    }
  }

  return leaked
}

async function callOpenAI(
  settings: Settings,
  apiKey: string,
  payload: unknown
): Promise<string> {
  const response = await fetch(settings.apiEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const result = await response.json()
  return result.choices?.[0]?.message?.content ?? ''
}

function parseAnalysis(content: string): { leaks?: string[]; recommendations?: string[] } {
  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function analyzeWithAI(
  before: SceneCensus,
  after: SceneCensus,
  event: string
): Promise<LeakReport> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    return {
      event,
      leaked_candidates: [],
      analysis: 'No API key configured',
      recommendations: ['Configure API key in extension popup'],
    }
  }

  const diff = computeLegacyDiff(before, after)
  if (diff.length === 0) {
    return {
      event,
      leaked_candidates: [],
      analysis: 'No potential leaks detected',
      recommendations: [],
    }
  }

  const payload = { event, leaked_candidates: diff }

  try {
    const settings = await getStoredSettings()
    const content = await callOpenAI(settings, apiKey, payload)
    const analysis = parseAnalysis(content)

    return {
      event,
      leaked_candidates: diff,
      analysis: analysis.leaks?.join(', ') || 'Analysis complete',
      recommendations: analysis.recommendations || [],
    }
  } catch (error) {
    return {
      event,
      leaked_candidates: diff,
      analysis: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendations: ['Check API key and endpoint configuration'],
    }
  }
}

async function handleSnapshotResponse(
  resources: ResourceDescriptor[],
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  const previous = await getLastSnapshot()
  await saveSnapshot(resources)

  chrome.runtime.sendMessage({ type: 'RESOURCES_UPDATE', payload: resources })

  if (!previous) {
    sendResponse({ type: 'OK', payload: null })
    return
  }

  const diff = computeResourceDiff(previous.resources, resources)
  if (diff.leaked.length === 0) {
    sendResponse({ type: 'OK', payload: null })
    return
  }

  const warning: LeakWarning = {
    type: 'LEAK_DETECTED',
    timestamp: Date.now(),
    leaks: diff.leaked,
  }

  chrome.runtime.sendMessage({ type: 'LEAKS_DETECTED', payload: diff.leaked })
  await chrome.storage.local.set({ latestLeakWarning: warning })
  sendResponse({ type: 'OK', payload: null })
}

async function handleGetSettings(
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  const settings = await getStoredSettings()
  sendResponse({ type: 'SETTINGS', payload: settings })
}

async function handleSetApiKey(
  apiKey: string,
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  await saveSettings({ apiKey })
  sendResponse({ type: 'OK', payload: null })
}

async function handleGetApiKey(
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  const apiKey = await getApiKey()
  sendResponse({ type: 'API_KEY', payload: apiKey })
}

function handleCensusUpdate(
  payload: SceneCensus,
  sendResponse: (response: RuntimeResponse) => void
): void {
  if (!beforeSnapshot) {
    beforeSnapshot = payload
  }
  chrome.runtime.sendMessage({ type: 'CENSUS_UPDATE', payload })
  sendResponse({ type: 'OK', payload: null })
}

async function handleAnalyzeDiff(
  payload: { before: SceneCensus; after: SceneCensus; event: string },
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  const report = await analyzeWithAI(payload.before, payload.after, payload.event)
  chrome.runtime.sendMessage({ type: 'ANALYSIS_RESULT', payload: report })
  sendResponse({ type: 'ANALYSIS_RESULT', payload: report })
}

async function handleGenerateFix(
  payload: { leak: UuidLeakCandidate },
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  const result = await generateFix(payload.leak)
  chrome.runtime.sendMessage({ type: 'FIX_RESULT', payload: result })
  sendResponse({ type: 'FIX_RESULT', payload: result })
}

chrome.runtime.onMessage.addListener(
  (msg: RuntimeMessage, sender, sendResponse: (response: RuntimeResponse) => void) => {
    handleMessage(msg, sendResponse)
    return true
  }
)

async function handleMessage(
  msg: RuntimeMessage,
  sendResponse: (response: RuntimeResponse) => void
): Promise<void> {
  switch (msg.type) {
    case 'GET_SETTINGS':
      await handleGetSettings(sendResponse)
      break

    case 'SET_API_KEY':
      await handleSetApiKey(msg.payload, sendResponse)
      break

    case 'GET_API_KEY':
      await handleGetApiKey(sendResponse)
      break

    case 'CENSUS_UPDATE':
      handleCensusUpdate(msg.payload, sendResponse)
      break

    case 'SNAPSHOT_RESPONSE':
      await handleSnapshotResponse(msg.payload, sendResponse)
      break

    case 'ANALYZE_DIFF':
      await handleAnalyzeDiff(msg.payload, sendResponse)
      break

    case 'GENERATE_FIX':
      await handleGenerateFix(msg.payload, sendResponse)
      break

    default:
      sendResponse({ type: 'ERROR', payload: 'Unknown message type' })
  }
}

// URL change handler - auto-trigger snapshot comparison
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'URL_CHANGED' && beforeSnapshot && !pendingAnalysis) {
    pendingAnalysis = true

    // Wait 2s for page to stabilize, then request new snapshot
    setTimeout(async () => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'TAKE_SNAPSHOT' })
      }
    }, 2000)
  }

  if (msg.type === 'SNAPSHOT_TAKEN' && beforeSnapshot && pendingAnalysis) {
    const afterSnapshot = msg.payload as SceneCensus

    analyzeWithAI(beforeSnapshot, afterSnapshot, 'Route Change').then((report) => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'ANALYSIS_RESULT',
          payload: report,
        })
      }
    })

    beforeSnapshot = afterSnapshot
    pendingAnalysis = false
  }
})
