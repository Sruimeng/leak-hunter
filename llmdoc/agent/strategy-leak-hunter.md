---
id: strategy-leak-hunter
type: strategy
status: active
related_ids: [constitution, style-hemingway, tech-stack, data-models]
---

# Strategy: Leak Hunter Chrome Extension

## Mission

Vue + Three.js memory leak detector. Real-time monitoring + AI analysis.

## Project Structure

```
leak-hunter/
├── src/
│   ├── background/
│   │   └── index.ts          # Service worker, AI API proxy
│   ├── content/
│   │   └── index.ts          # Bridge: inject loader + message relay
│   ├── inject/
│   │   └── index.ts          # Main world: Three.js access
│   ├── panel/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── App.vue
│   │   └── components/
│   │       ├── Monitor.vue   # Real-time chart
│   │       └── Report.vue    # AI analysis results
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── App.vue           # Settings, API key input
│   ├── types/
│   │   ├── messages.ts       # Protocol types
│   │   ├── census.ts         # SceneCensus interface
│   │   └── result.ts         # Result<T> type
│   └── utils/
│       ├── messaging.ts      # Type-safe sendMessage
│       └── storage.ts        # chrome.storage helpers
├── manifest.json
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Implementation Phases

### Phase 1: Scaffold

**Files:** `package.json`, `vite.config.ts`, `manifest.json`, `tsconfig.json`

**Pseudo-Code:**
```
1. npm create vite@latest -- --template vue-ts
2. Install: @crxjs/vite-plugin, vue
3. Configure vite.config.ts with crx plugin
4. Create manifest.json (MV3)
   - background.service_worker -> src/background/index.ts
   - content_scripts -> src/content/index.ts
   - web_accessible_resources -> src/inject/index.ts
5. Set permissions: ["debugger", "storage", "activeTab"]
```

### Phase 2: Inject Script

**Files:** `src/inject/index.ts`

**Pseudo-Code:**
```typescript
// getSceneCensus(): SceneCensus
function getSceneCensus() {
  const renderer = window.__THREE_RENDERER__
  const scene = window.__THREE_SCENE__ || window.scene

  if (!renderer || !scene) return null

  const objects: Record<string, number> = {}

  scene.traverse((obj) => {
    const key = `${obj.type}(${obj.name || 'unnamed'})`
    objects[key] = (objects[key] || 0) + 1
  })

  return {
    timestamp: Date.now(),
    memory: {
      heapUsed: performance.memory?.usedJSHeapSize ?? 0,
      gpuGeometries: renderer.info.memory.geometries,
      gpuTextures: renderer.info.memory.textures
    },
    objects
  }
}

// 1Hz polling
setInterval(() => {
  const census = getSceneCensus()
  if (census) {
    window.postMessage({ type: 'LEAK_HUNTER_CENSUS', payload: census }, '*')
  }
}, 1000)
```

### Phase 3: Communication

**Files:** `src/content/index.ts`, `src/types/messages.ts`

**Message Protocol:**
```typescript
// Inject -> Content (postMessage)
{ type: 'LEAK_HUNTER_CENSUS', payload: SceneCensus }
{ type: 'LEAK_HUNTER_SNAPSHOT', payload: SceneCensus }

// Content -> Background (runtime.sendMessage)
{ type: 'CENSUS_UPDATE', payload: SceneCensus }
{ type: 'ANALYZE_DIFF', payload: { before: SceneCensus, after: SceneCensus } }

// Background -> Content (response)
{ type: 'ANALYSIS_RESULT', payload: LeakReport }
```

**Pseudo-Code (Content Script):**
```typescript
// 1. Inject script into page
const script = document.createElement('script')
script.src = chrome.runtime.getURL('assets/inject.js')
document.head.appendChild(script)

// 2. Listen for messages from inject
window.addEventListener('message', (e) => {
  if (e.data.type?.startsWith('LEAK_HUNTER_')) {
    chrome.runtime.sendMessage(e.data)
  }
})

// 3. Relay messages from background to panel
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ANALYSIS_RESULT') {
    window.postMessage(msg, '*')
  }
})
```

### Phase 4: UI

**Files:** `src/panel/`, `src/popup/`

**Floating Panel (Main World):**
- Inject via content script after inject.ts
- Position: fixed, draggable
- Components:
  - `Monitor.vue`: Line chart (heap, geometries, textures)
  - `Report.vue`: Leak candidates list

**Leak Detection Logic:**
```typescript
// isLeaking(samples: number[]): boolean
// Returns true if 10 consecutive samples show increase

function isLeaking(samples: number[]): boolean {
  if (samples.length < 10) return false

  const recent = samples.slice(-10)
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] <= recent[i - 1]) return false
  }
  return true
}
```

### Phase 5: AI Service

**Files:** `src/background/index.ts`

**Pseudo-Code:**
```typescript
// handleAnalyzeRequest(before, after): LeakReport

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type !== 'ANALYZE_DIFF') return

  const { before, after } = msg.payload
  const diff = computeDiff(before, after)

  const apiKey = await chrome.storage.local.get('openai_key')
  if (!apiKey) return { error: 'NO_API_KEY' }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(diff) }
      ]
    })
  })

  const result = await response.json()
  sendResponse({ type: 'ANALYSIS_RESULT', payload: result })
})

function computeDiff(before: SceneCensus, after: SceneCensus) {
  const leaked = []
  for (const [name, count] of Object.entries(before.objects)) {
    const afterCount = after.objects[name] ?? 0
    if (afterCount >= count) {
      leaked.push({ name, before: count, after: afterCount })
    }
  }
  return { event: `Route change`, leaked_candidates: leaked }
}
```

## File Responsibilities

| File | Responsibility |
|------|----------------|
| `src/inject/index.ts` | Access Three.js, collect census, 1Hz polling |
| `src/content/index.ts` | Load inject.ts, relay messages |
| `src/background/index.ts` | AI API proxy, storage access |
| `src/panel/App.vue` | Floating monitor UI |
| `src/popup/App.vue` | Settings, API key input |
| `src/types/messages.ts` | Message protocol types |
| `src/types/census.ts` | SceneCensus, MemoryMetrics |
| `src/utils/messaging.ts` | Type-safe sendMessage wrapper |

## Negative Constraints

**DO NOT:**
- Use callbacks (Promise/async only)
- Store state in service worker globals
- Use `any` type
- Nest beyond 2 levels
- Write functions > 30 lines
- Use Manager/Handler class names
- Import entire libraries (`import * as`)
- Skip Result<T> for fallible operations
- Use CommonJS syntax
- Add runtime dependencies without justification

## Style Enforcement

**Per `style-hemingway.md`:**
- Guards at function top
- Early returns > else branches
- Types document, comments explain WHY
- Cyclomatic complexity < 10
- File length < 200 lines
