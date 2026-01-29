---
id: arch-system-overview
type: architecture
status: target
related_ids: []
---

# System Overview

## Component Graph

```
Background Service Worker <---> Content Script <---> DOM
         |                            |
         v                            v
    chrome.storage.local         Heap Monitor
         ^                            |
         |                            v
    DevTools Page <----------> Message Bus
         ^
         |
    Popup UI
```

## Type Definitions

```typescript
// Core Data Structures
interface HeapSnapshot {
  timestamp: number;
  totalSize: number;
  nodes: NodeMap;
  edges: EdgeMap;
}

interface MemoryMetrics {
  jsHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  delta: number;
}

interface LeakCandidate {
  nodeId: number;
  retainedSize: number;
  retainerChain: string[];
  detectionTimestamp: number;
}

// Message Protocol
type MessageType =
  | 'CAPTURE_SNAPSHOT'
  | 'GET_METRICS'
  | 'DETECT_LEAKS'
  | 'CLEAR_STORAGE';

interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

interface Response<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Component Responsibilities

### Background Service Worker
**Lifecycle:** Persistent monitoring controller.

**Functions:**
- Schedule periodic heap snapshots (configurable interval)
- Receive snapshot requests from popup/devtools
- Execute diff algorithm on consecutive snapshots
- Flag nodes with monotonic growth
- Write snapshots to chrome.storage.local (compression required)
- Broadcast metrics to connected clients

**Constraints:**
- NO DOM access
- NO window object
- Storage quota: 10MB limit (enforce rotation)

### Content Script
**Lifecycle:** Per-tab injection.

**Functions:**
- Inject memory profiler shim into page context
- Expose `performance.memory` API wrapper
- Listen for `window.addEventListener('error')` for OOM signals
- Forward metrics to background worker

**Constraints:**
- Isolated context (cannot access page's JS heap directly)
- Use `window.postMessage` for cross-context communication

### Popup UI
**Lifecycle:** Transient view.

**Functions:**
- Display real-time metrics (heap size, trend chart)
- Trigger manual snapshot capture
- Show top 5 leak candidates (sorted by retained size)
- Link to DevTools page for deep analysis

**Technology:** React + Chart.js

### DevTools Page
**Lifecycle:** Active when DevTools open.

**Functions:**
- Render full snapshot diff (before/after comparison)
- Visualize retainer tree (D3.js graph)
- Export snapshots as `.heapsnapshot` (Chrome format)
- Filter nodes by type (Array, Object, Closure)

**Technology:** React + D3.js

## Critical Flows

### Snapshot Capture (Manual)
```
1. User clicks "Capture" in Popup
   ↓
2. Popup → runtime.sendMessage({type: 'CAPTURE_SNAPSHOT'})
   ↓
3. Background Worker:
   a. Query active tab
   b. Inject content script if not present
   c. Content Script → performance.memory
   d. Serialize heap data
   e. Write to chrome.storage.local
   f. Return snapshot ID
   ↓
4. Popup receives Response
   ↓
5. Update UI with latest metrics
```

### Leak Detection (Automatic)
```
Background Worker (every N seconds):
  snapshots = getLastN(2) from storage
  if snapshots.length < 2:
    return

  diff = computeDiff(snapshots[0], snapshots[1])

  leakCandidates = []
  for node in diff.nodes:
    if node.retainedSize.delta > THRESHOLD:
      leakCandidates.push({
        nodeId: node.id,
        retainedSize: node.retainedSize.current,
        retainerChain: buildChain(node)
      })

  if leakCandidates.length > 0:
    chrome.storage.local.set({leaks: leakCandidates})
    chrome.action.setBadgeText({text: String(leakCandidates.length)})
```

### Message Protocol
```
// Sender (Popup/DevTools)
const response = await chrome.runtime.sendMessage({
  type: 'GET_METRICS'
});

// Receiver (Background Worker)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'GET_METRICS':
      getMetrics().then(sendResponse);
      return true; // async response
    case 'CAPTURE_SNAPSHOT':
      captureSnapshot().then(sendResponse);
      return true;
  }
});
```

## Storage Strategy

### Schema
```typescript
interface StorageSchema {
  snapshots: HeapSnapshot[]; // Max 10 entries (FIFO rotation)
  leaks: LeakCandidate[];
  config: {
    captureInterval: number; // milliseconds
    retentionCount: number;
    leakThreshold: number; // bytes
  };
}
```

### Rotation Policy
```
When snapshots.length > config.retentionCount:
  snapshots.shift() // Remove oldest
  snapshots.push(newSnapshot)
```

## Negative Constraints
- NO synchronous storage operations (use async chrome.storage API)
- NO uncompressed snapshot storage (use LZ4 or similar)
- NO unbounded arrays in storage (enforce limits)
- NO direct DOM manipulation from background worker
- NO `eval()` or `new Function()` in content script
- NO sensitive data logging (heap may contain credentials)
