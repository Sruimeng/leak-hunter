---
id: shared-utilities
type: reference
status: canonical
created: 2026-01-29
related_ids: []
---

# Shared Utilities

**Constraint:** Do NOT implement duplicate logic. Reuse these utilities.

## utils/memory.ts

Memory profiling and heap analysis.

```typescript
interface HeapSnapshot {
  timestamp: number;
  nodes: HeapNode[];
  edges: HeapEdge[];
  totalSize: number;
}

interface HeapNode {
  id: number;
  name: string;
  type: string;
  size: number;
  retainedSize: number;
}

interface HeapEdge {
  from: number;
  to: number;
  type: string;
  name: string;
}

interface HeapDiff {
  added: HeapNode[];
  removed: HeapNode[];
  grown: Array<{ node: HeapNode; delta: number }>;
  totalDelta: number;
}

// Parse raw Chrome heap snapshot JSON
function parseSnapshot(raw: string): HeapSnapshot;

// Calculate diff between two snapshots
function diffSnapshots(before: HeapSnapshot, after: HeapSnapshot): HeapDiff;

// Extract detached DOM nodes from snapshot
function findDetachedNodes(snapshot: HeapSnapshot): HeapNode[];

// Calculate retained size for node
function calculateRetainedSize(snapshot: HeapSnapshot, nodeId: number): number;

// Find retention path from GC root to node
function getRetentionPath(snapshot: HeapSnapshot, nodeId: number): HeapNode[];
```

## utils/chrome-api.ts

Type-safe wrappers for Chrome debugging APIs.

```typescript
interface DebugTarget {
  tabId: number;
  attached: boolean;
}

interface MemoryProfile {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Attach debugger to tab
function attachDebugger(tabId: number): Promise<DebugTarget>;

// Detach debugger from tab
function detachDebugger(tabId: number): Promise<void>;

// Send debugger command with typed response
function sendCommand<T = unknown>(
  tabId: number,
  method: string,
  params?: Record<string, unknown>
): Promise<T>;

// Take heap snapshot via debugger protocol
function takeHeapSnapshot(tabId: number): Promise<HeapSnapshot>;

// Get current memory usage
function getMemoryUsage(tabId: number): Promise<MemoryProfile>;

// Force garbage collection (requires --enable-precise-memory-info)
function forceGC(tabId: number): Promise<void>;
```

## utils/detection.ts

Leak detection algorithms and heuristics.

```typescript
interface LeakSignal {
  type: 'detached-dom' | 'event-listener' | 'closure' | 'timer' | 'memory-growth';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  nodeId?: number;
  details: Record<string, unknown>;
}

interface DetectionConfig {
  growthThreshold: number; // bytes
  sampleInterval: number; // ms
  detachedDomThreshold: number; // count
  confidenceThreshold: number; // 0-1
}

// Detect detached DOM nodes in snapshot
function detectDetachedDOM(snapshot: HeapSnapshot): LeakSignal[];

// Detect orphaned event listeners
function detectOrphanedListeners(snapshot: HeapSnapshot): LeakSignal[];

// Detect memory growth pattern over time
function detectMemoryGrowth(
  snapshots: HeapSnapshot[],
  config: DetectionConfig
): LeakSignal[];

// Detect timer leaks (setInterval/setTimeout)
function detectTimerLeaks(snapshot: HeapSnapshot): LeakSignal[];

// Detect closure retention issues
function detectClosureLeaks(snapshot: HeapSnapshot): LeakSignal[];

// Aggregate signals into overall leak score
function aggregateSignals(signals: LeakSignal[]): {
  score: number; // 0-100
  priority: LeakSignal[];
};
```

## utils/storage.ts

Chrome storage helpers with type safety.

```typescript
interface StorageSchema {
  snapshots: HeapSnapshot[];
  config: DetectionConfig;
  history: LeakSignal[];
  lastScan: number;
}

// Get typed value from chrome.storage.local
function getStorage<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | undefined>;

// Set typed value in chrome.storage.local
function setStorage<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void>;

// Remove key from storage
function removeStorage(key: keyof StorageSchema): Promise<void>;

// Clear all storage
function clearStorage(): Promise<void>;

// Watch storage changes for key
function watchStorage<K extends keyof StorageSchema>(
  key: K,
  callback: (value: StorageSchema[K]) => void
): () => void; // returns unsubscribe function
```

## utils/messaging.ts

Type-safe runtime messaging between extension components.

```typescript
interface MessageMap {
  'scan:start': { tabId: number };
  'scan:complete': { signals: LeakSignal[] };
  'snapshot:take': { tabId: number };
  'snapshot:ready': { snapshot: HeapSnapshot };
  'config:update': { config: Partial<DetectionConfig> };
  'debugger:attach': { tabId: number };
  'debugger:detach': { tabId: number };
}

// Send typed message and wait for response
function sendMessage<K extends keyof MessageMap>(
  type: K,
  payload: MessageMap[K]
): Promise<void>;

// Listen for typed messages
function onMessage<K extends keyof MessageMap>(
  type: K,
  handler: (payload: MessageMap[K]) => void | Promise<void>
): () => void; // returns unsubscribe function

// Broadcast to all extension contexts
function broadcast<K extends keyof MessageMap>(
  type: K,
  payload: MessageMap[K]
): Promise<void>;
```

## Negative Constraints

🚫 **DO NOT** implement fetch/axios wrappers. Use native fetch.
🚫 **DO NOT** create generic "helpers.ts" files. Keep utilities focused.
🚫 **DO NOT** add utilities without updating this reference.
🚫 **DO NOT** duplicate Chrome API types. Import from `@types/chrome`.
🚫 **DO NOT** use classes for utilities. Pure functions only.
🚫 **DO NOT** add runtime validation unless critical. Trust TypeScript.
