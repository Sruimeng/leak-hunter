---
id: data-models
type: reference
related_ids: [architecture-core, type-system]
---

# Data Models

## HeapSnapshot

```typescript
interface HeapSnapshot {
  timestamp: number;        // Unix epoch ms
  size: number;             // Total heap bytes
  nodes: HeapNode[];
  edges: HeapEdge[];
  metadata: SnapshotMetadata;
}

interface HeapNode {
  id: number;
  type: NodeType;
  name: string;
  selfSize: number;
  edgeCount: number;
}

interface HeapEdge {
  type: EdgeType;
  nameOrIndex: string | number;
  toNode: number;           // Node ID reference
}

interface SnapshotMetadata {
  nodeCount: number;
  edgeCount: number;
  traceFunction?: string;
}

type NodeType =
  | 'hidden'
  | 'array'
  | 'string'
  | 'object'
  | 'code'
  | 'closure'
  | 'regexp'
  | 'number'
  | 'native'
  | 'synthetic';

type EdgeType =
  | 'context'
  | 'element'
  | 'property'
  | 'internal'
  | 'hidden'
  | 'shortcut'
  | 'weak';
```

## MemoryLeak

```typescript
interface MemoryLeak {
  type: LeakType;
  severity: Severity;
  source: LeakSource;
  retention: RetentionPath;
  detectedAt: number;       // Unix epoch ms
}

interface LeakSource {
  nodeId: number;
  objectType: string;
  allocatedSize: number;
  retainedSize: number;
}

interface RetentionPath {
  path: PathNode[];
  root: string;             // GC root identifier
  distance: number;         // Hops from GC root
}

interface PathNode {
  nodeId: number;
  edgeName: string;
  nodeType: NodeType;
}

type LeakType =
  | 'detached-dom'
  | 'event-listener'
  | 'closure'
  | 'timer'
  | 'cache'
  | 'unknown';

type Severity = 'critical' | 'high' | 'medium' | 'low';
```

## ProfileSession

```typescript
interface ProfileSession {
  id: string;
  start: number;            // Unix epoch ms
  end: number | null;       // null if active
  snapshots: HeapSnapshot[];
  config: SessionConfig;
  stats: SessionStats;
}

interface SessionConfig {
  interval: number;         // ms between snapshots
  maxSnapshots: number;
  autoDetect: boolean;
  thresholds: LeakThresholds;
}

interface SessionStats {
  peakMemory: number;
  avgMemory: number;
  growthRate: number;       // bytes/ms
  snapshotCount: number;
}

interface LeakThresholds {
  detachedDomNodes: number;
  listenerCount: number;
  retainedSizeMB: number;
}
```

## LeakReport

```typescript
interface LeakReport {
  sessionId: string;
  leaks: MemoryLeak[];
  score: LeakScore;
  recommendations: Recommendation[];
  generatedAt: number;      // Unix epoch ms
}

interface LeakScore {
  overall: number;          // 0-100 (100 = no leaks)
  breakdown: {
    detachedDom: number;
    eventListeners: number;
    closures: number;
    timers: number;
  };
}

interface Recommendation {
  priority: Severity;
  category: LeakType;
  message: string;
  codeRef?: CodeReference;
}

interface CodeReference {
  file: string;
  line: number;
  column?: number;
  snippet?: string;
}
```

## Constraints

**Negative Constraints:**
- ❌ DO NOT use class-based models (interfaces only)
- ❌ DO NOT include runtime validation logic here
- ❌ DO NOT add optional fields without explicit `?` marker
- ❌ DO NOT use `any` type
- ❌ DO NOT nest beyond 3 levels without type alias

**Positive Constraints:**
- ✅ All timestamps MUST be Unix epoch milliseconds
- ✅ All sizes MUST be in bytes
- ✅ All IDs MUST be immutable after creation
- ✅ Enums MUST use union types for tree-shaking
