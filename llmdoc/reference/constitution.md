---
id: constitution
type: reference
version: 1.0.0
related_ids: [style-hemingway]
---

# Chrome Extension Constitution

## Manifest V3 Law

```typescript
interface ManifestV3 {
  manifest_version: 3
  permissions: Permission[]
  host_permissions: string[]
  background: { service_worker: string }
}
```

**Constraints:**
- NO `manifest_version: 2`
- NO persistent background pages
- NO `<all_urls>` without justification
- Service workers MUST be stateless
- All async operations MUST use Promises (not callbacks)

## Service Worker Rules

**Prime Directive:** Stateless, Event-Driven, Terminable.

```typescript
// ✅ GOOD: Event-driven
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SNAPSHOT') return handleSnapshot()
})

// ❌ BAD: State retention
let globalCache = {} // Dies when worker terminates
```

**Storage Pattern:**
- Ephemeral: `chrome.storage.session`
- Persistent: `chrome.storage.local`
- NO global variables

## Content Script Isolation

**World Boundary:**
```typescript
// Content Script (ISOLATED)
// - Access: chrome.* APIs, DOM
// - NO access: window.app, page variables

// Page Script (MAIN WORLD)
// - Access: window.*, page globals
// - NO access: chrome.* APIs
```

**Communication Protocol:**
```typescript
// Content → Page
window.postMessage({ type: 'INJECT' }, '*')

// Page → Content
window.addEventListener('message', (e) => {
  if (e.source !== window) return
})
```

**Constraints:**
- NO direct function calls across worlds
- NO shared objects (must serialize)
- Use `world: 'MAIN'` for debugger access

## Memory API Patterns

### Debugger Protocol

```typescript
// Attach
await chrome.debugger.attach({ tabId }, '1.3')

// Heap Snapshot
const { result } = await chrome.debugger.sendCommand(
  { tabId },
  'HeapProfiler.takeHeapSnapshot'
)
```

**Rules:**
- ONE debugger per tab (attach fails if already attached)
- MUST detach on cleanup
- Version `1.3` minimum for heap APIs
- Handle `onDetach` event (user might manually detach)

### Snapshot Processing

**Strategy:** Stream, Don't Load.

```typescript
// ❌ BAD: Load entire snapshot
const snapshot = JSON.parse(allChunks.join(''))

// ✅ GOOD: Stream parse
let buffer = ''
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'HeapProfiler.addHeapSnapshotChunk') {
    processChunk(params.chunk)
  }
})
```

**Constraints:**
- Snapshots can exceed 100MB
- NO synchronous parsing
- Use Web Workers for analysis

## Detector Patterns

### Detached DOM

**Signal:**
```typescript
// Node type: Detached DOM tree
node.detachedDOMTreeNode === true
node.className.includes('Detached')
```

**Threshold:** > 100 detached nodes = leak candidate

### Event Listener Leaks

**Signal:**
- Nodes with listeners but no parent
- Listener count grows unbounded

```typescript
interface LeakPattern {
  type: 'detached' | 'listener' | 'closure'
  count: number
  retainedSize: number // bytes
}
```

## Security Constraints

### CSP (Content Security Policy)

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Rules:**
- NO `unsafe-eval`
- NO `unsafe-inline`
- NO external script loading

### Permissions

**Minimum Viable Set:**
```json
{
  "permissions": [
    "debugger",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "http://localhost/*",
    "https://localhost/*"
  ]
}
```

**Constraints:**
- Request permissions on-demand (optional_permissions)
- NO `<all_urls>` in production
- Justify each permission in docs

## File Structure

```
src/
├── background/
│   └── service-worker.ts    # Event handlers only
├── content/
│   ├── injected.ts          # MAIN world
│   └── isolated.ts          # ISOLATED world
├── devtools/
│   ├── panel.html
│   └── panel.ts
└── lib/
    ├── detector.ts          # Leak detection logic
    ├── snapshot.ts          # Heap parsing
    └── types.ts             # Shared interfaces
```

**Rules:**
- ONE responsibility per file
- NO circular dependencies
- Types in `types.ts`, not scattered

## Build Constraints

**Bundle Target:**
- ES2020 (Service Workers support)
- NO CommonJS in runtime
- Tree-shake aggressively

**Forbidden:**
- `eval()`
- `Function()` constructor
- `document.write()`

## Error Handling

**Protocol:**
```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error }

// ✅ Explicit
const result = await detectLeaks()
if (!result.ok) return handleError(result.error)

// ❌ Throw and pray
const data = await detectLeaks() // Might throw
```

**Constraints:**
- NO silent failures
- Log errors to `chrome.storage.local` (user can export)
- Surface errors in DevTools panel

## Performance Budget

**Snapshot Analysis:**
- Target: < 3s for 50MB snapshot
- Max memory: 200MB
- Use incremental parsing

**UI Responsiveness:**
- Panel render: < 100ms
- NO blocking main thread
- Use `requestIdleCallback` for non-critical work
