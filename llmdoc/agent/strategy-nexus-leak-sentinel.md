---
id: strategy-nexus-leak-sentinel
type: strategy
version: 1.0.0
related_ids: [constitution, style-hemingway, data-models]
---

# Strategy: Nexus Leak Sentinel

## 1. Analysis

### Context
Current implementation is 30-70% aligned with PRD. Missing critical components:
- Constructor/dispose hijacking for THREE.js primitives
- UUID-based resource registry
- Vue component tree traversal
- Snapshot diff algorithm with component association
- AI copilot integration with priority routing

### Constitution
**Ref:** `constitution.md`, `style-hemingway.md`

**Manifest V3 Law:**
- Service workers MUST be stateless
- Content scripts isolated from page world
- Debugger attach: ONE per tab, MUST detach on cleanup
- Stream snapshot parsing (snapshots > 100MB)

**Hemingway Law:**
- Max 30 lines per function
- Max 2 nesting levels
- Early returns > else branches
- NO `any`, NO god functions, NO deep nesting
- Type-First: Interfaces tell the story

**Performance Budget:**
- < 5% FPS impact on host app
- < 3s snapshot analysis for 50MB
- Max 200MB memory usage
- NO blocking main thread

### Style Protocol
**STRICT ADHERENCE** to `style-hemingway.md`:
- Iceberg Principle: Show structure, hide implementation
- Newspaper structure: Guards first, happy path visible
- Comment protocol: Explain WHY, not WHAT
- Forbidden: `Manager/Handler/Processor`, `Abstract/Base/Impl`, single-letter vars (except loop indices)

### Negative Constraints
- ❌ NO `new` in loops (pre-allocate or pool)
- ❌ NO global state in service worker
- ❌ NO synchronous snapshot parsing
- ❌ NO cross-world function calls (Content ↔ Page)
- ❌ NO `eval()`, `Function()`, `document.write()`
- ❌ NO `any` type usage
- ❌ NO nested ternaries
- ❌ NO floating promises

## 2. Assessment

<Assessment>
**Complexity:** Level 3 (Deep)

**Justification:**
1. Graphics engine introspection (THREE.js internals)
2. Real-time performance monitoring (FPS < 5% impact)
3. Heap snapshot streaming + diffing algorithm
4. AI integration with multi-provider fallback
5. Vue reactivity system traversal
</Assessment>

## 3. Math/Algo Specification

<MathSpec>

### 3.1 Constructor Hijacking Pattern
```
OriginalConstructor = Target.prototype.constructor
ResourceRegistry = Map<UUID, ResourceDescriptor>

HijackedConstructor(...args):
  instance = OriginalConstructor.apply(this, args)
  uuid = generateUUID()
  instance.__leak_uuid = uuid
  ResourceRegistry.set(uuid, {
    type: Constructor.name,
    timestamp: Date.now(),
    stack: captureStack(3),  // 3 frames
    disposed: false
  })
  return instance

HijackedDispose():
  if (this.__leak_uuid exists):
    ResourceRegistry.get(this.__leak_uuid).disposed = true
  OriginalDispose.call(this)
```

### 3.2 Vue Component Tree Traversal
```
VueAppRoot = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.apps[0]._instance

TraverseComponent(component, depth = 0):
  if (!component || depth > 50) return []  // Cycle guard

  descriptor = {
    uid: component.uid,
    name: component.type.name || 'Anonymous',
    props: keys(component.props),
    resources: []
  }

  // Extract THREE.js refs from setup/data
  for (key in component.setupState):
    if (isThreeObject(component.setupState[key])):
      descriptor.resources.push({
        uuid: component.setupState[key].__leak_uuid,
        field: key
      })

  children = component.subTree.children
    .filter(isComponentVNode)
    .map(vnode => TraverseComponent(vnode.component, depth + 1))

  return [descriptor, ...flatten(children)]
```

### 3.3 UUID Resource Registry
```
interface ResourceDescriptor {
  uuid: string
  type: 'Texture' | 'BufferGeometry' | 'WebGLRenderer'
  timestamp: number
  stack: string[]       // Allocation stack
  disposed: boolean
  component?: string    // Vue component UID
}

Registry Operations:
- Insert: O(1) Map.set()
- Lookup: O(1) Map.get()
- Snapshot: O(n) Array.from(Map.values())
- Filter Undisposed: O(n) filter(r => !r.disposed)
```

### 3.4 Snapshot Diff Algorithm
```
SnapshotA = { timestamp: t1, resources: Map<UUID, Descriptor> }
SnapshotB = { timestamp: t2, resources: Map<UUID, Descriptor> }

Diff(A, B):
  added = []
  removed = []
  leaked = []

  for (uuid in B.resources):
    if (!A.resources.has(uuid)):
      added.push(B.resources.get(uuid))

  for (uuid in A.resources):
    if (!B.resources.has(uuid)):
      if (B.resources.get(uuid).disposed):
        removed.push(uuid)
      else:
        leaked.push({
          uuid: uuid,
          age: t2 - A.resources.get(uuid).timestamp,
          descriptor: A.resources.get(uuid)
        })

  return { added, removed, leaked }

LeakWarning(leaked):
  for (item in leaked):
    if (item.age > 5000):  // 5s threshold
      emit({ type: 'LEAK_WARNING', data: item })
```

### 3.5 AI Priority Routing
```
AIProviders = [
  { name: 'Gemini Nano', check: () => 'ai' in window, cost: 0 },
  { name: 'OpenAI', check: () => hasApiKey('openai'), cost: 1 },
  { name: 'Claude', check: () => hasApiKey('claude'), cost: 2 }
]

SelectProvider():
  for (provider in AIProviders):
    if (provider.check()):
      return provider
  return null

GenerateFix(leak: LeakDescriptor):
  provider = SelectProvider()
  if (!provider):
    return { ok: false, error: 'No AI provider available' }

  context = ExtractSourceContext(leak.stack)
  prompt = BuildPrompt(leak, context)

  try:
    fix = await provider.generate(prompt)
    return { ok: true, value: fix }
  catch (e):
    return { ok: false, error: e.message }
```

### 3.6 Source Context Extraction
```
ExtractSourceContext(stack: string[]):
  frame = stack[0]  // Top frame is allocation site
  match = frame.match(/at (.+):(\d+):(\d+)/)

  if (!match):
    return null

  [file, line, col] = match.slice(1)

  // Request source via debugger protocol
  source = await chrome.debugger.sendCommand(
    'Debugger.getScriptSource',
    { scriptId: resolveScriptId(file) }
  )

  lines = source.split('\n')
  start = max(0, line - 5)
  end = min(lines.length, line + 5)

  return {
    file: file,
    line: line,
    snippet: lines.slice(start, end).join('\n'),
    highlight: line - start
  }
```

</MathSpec>

## 4. The Plan

<ExecutionPlan>

### Phase 1: Shadow Inspector (inject/index.ts)

**Objective:** Hijack THREE.js primitives + Vue traversal

**Block 1.1: Constructor Hijacking**
Files: `inject/index.ts`, `types/census.ts`

1. Create `ResourceRegistry` Map in MAIN world
2. Target constructors: `THREE.WebGLRenderer`, `THREE.Texture`, `THREE.BufferGeometry`
3. Implement hijack pattern:
   ```typescript
   const hijackConstructor = <T extends new (...args: any[]) => any>(
     target: T,
     type: ResourceType
   ): T => {
     const original = target
     return class extends original {
       constructor(...args: any[]) {
         super(...args)
         const uuid = crypto.randomUUID()
         Object.defineProperty(this, '__leak_uuid', {
           value: uuid,
           writable: false,
           enumerable: false
         })
         registry.set(uuid, {
           uuid,
           type,
           timestamp: Date.now(),
           stack: captureStack(),
           disposed: false
         })
       }
     } as T
   }
   ```
4. Hijack `dispose()` methods to mark `disposed: true`
5. Add type definitions in `types/census.ts`:
   ```typescript
   interface ResourceDescriptor {
     uuid: string
     type: 'Texture' | 'BufferGeometry' | 'WebGLRenderer'
     timestamp: number
     stack: string[]
     disposed: boolean
     component?: string
   }
   ```

**Block 1.2: Vue Component Traversal**
Files: `inject/index.ts`, `inject/vue-inspector.ts` (new)

1. Create `vue-inspector.ts` with traversal logic
2. Access Vue app via `window.__VUE_DEVTOOLS_GLOBAL_HOOK__`
3. Guard against circular refs (max depth 50)
4. Extract THREE.js refs from `setupState`, `data`, `ctx`
5. Associate resource UUIDs with component UIDs
6. Update `ResourceRegistry` with `component` field

**Block 1.3: Message Bridge**
Files: `inject/index.ts`

1. Listen for `SNAPSHOT_REQUEST` from content script
2. Serialize `ResourceRegistry` to plain object (no Map)
3. Post message back via `window.postMessage`
4. Add performance mark: `performance.mark('snapshot-start')`

**Type Definitions:**
```typescript
interface SnapshotMessage {
  type: 'SNAPSHOT_RESPONSE'
  data: {
    timestamp: number
    resources: ResourceDescriptor[]
    vue: VueComponentTree
  }
}

interface VueComponentTree {
  uid: string
  name: string
  props: string[]
  resources: Array<{ uuid: string; field: string }>
  children: VueComponentTree[]
}
```

---

### Phase 2: Snapshot Diff Engine (background/index.ts)

**Objective:** UUID-based comparison + leak detection

**Block 2.1: Snapshot Storage**
Files: `background/index.ts`, `background/snapshot-store.ts` (new)

1. Create `snapshot-store.ts` with session storage
2. Use `chrome.storage.session` for ephemeral data
3. Store max 10 snapshots (FIFO eviction)
4. Schema:
   ```typescript
   interface StoredSnapshot {
     id: string
     timestamp: number
     resources: Map<string, ResourceDescriptor>
   }
   ```

**Block 2.2: Diff Algorithm**
Files: `background/diff-engine.ts` (new)

1. Implement `computeDiff(prev, curr)` per MathSpec 3.4
2. Filter leaked resources: `age > 5000ms` AND `!disposed`
3. Enrich with component association from Vue tree
4. Return structured diff:
   ```typescript
   interface SnapshotDiff {
     added: ResourceDescriptor[]
     removed: string[]  // UUIDs
     leaked: LeakCandidate[]
   }

   interface LeakCandidate {
     uuid: string
     age: number
     descriptor: ResourceDescriptor
     component?: string
   }
   ```

**Block 2.3: Leak Warning**
Files: `background/index.ts`

1. Listen for diff results
2. If `leaked.length > 0`, emit warning to panel
3. Store leaks in `chrome.storage.local` for history
4. Message format:
   ```typescript
   interface LeakWarning {
     type: 'LEAK_DETECTED'
     timestamp: number
     leaks: LeakCandidate[]
   }
   ```

---

### Phase 3: AI Copilot (background/ai-copilot.ts)

**Objective:** Multi-provider fix generation

**Block 3.1: Provider Registry**
Files: `background/ai-copilot.ts`, `types/ai.ts` (new)

1. Define provider interface:
   ```typescript
   interface AIProvider {
     name: string
     check: () => Promise<boolean>
     generate: (prompt: string) => Promise<string>
     cost: number
   }
   ```
2. Implement Gemini Nano provider:
   ```typescript
   const geminiNano: AIProvider = {
     name: 'Gemini Nano',
     check: async () => 'ai' in window,
     generate: async (prompt) => {
       const session = await window.ai.createTextSession()
       return session.prompt(prompt)
     },
     cost: 0
   }
   ```
3. Implement OpenAI fallback (requires API key)
4. Implement Claude fallback (requires API key)

**Block 3.2: Source Context Extraction**
Files: `background/source-extractor.ts` (new)

1. Parse stack trace from `ResourceDescriptor.stack`
2. Use `chrome.debugger.sendCommand` to fetch source:
   ```typescript
   const extractContext = async (
     tabId: number,
     stack: string[]
   ): Promise<SourceContext | null> => {
     if (!stack[0]) return null

     const match = stack[0].match(/at (.+):(\d+):(\d+)/)
     if (!match) return null

     const [, file, line, col] = match
     const { result } = await chrome.debugger.sendCommand(
       { tabId },
       'Debugger.getScriptSource',
       { scriptId: await resolveScriptId(tabId, file) }
     )

     const lines = result.scriptSource.split('\n')
     const start = Math.max(0, Number(line) - 5)
     const end = Math.min(lines.length, Number(line) + 5)

     return {
       file,
       line: Number(line),
       snippet: lines.slice(start, end).join('\n'),
       highlight: Number(line) - start
     }
   }
   ```

**Block 3.3: Fix Generation**
Files: `background/ai-copilot.ts`

1. Implement `generateFix(leak: LeakCandidate)`
2. Select provider via priority routing (MathSpec 3.5)
3. Build prompt with leak context + source snippet
4. Call provider's `generate()` method
5. Return Result type:
   ```typescript
   type FixResult =
     | { ok: true; fix: string; provider: string }
     | { ok: false; error: string }
   ```

**Block 3.4: Prompt Engineering**
Files: `background/prompts.ts` (new)

1. Template for leak fix:
   ```typescript
   const buildFixPrompt = (leak: LeakCandidate, context: SourceContext): string => {
     return `
   THREE.js ${leak.descriptor.type} leak detected.

   Allocation stack:
   ${leak.descriptor.stack.join('\n')}

   Source context (${context.file}:${context.line}):
   ${context.snippet}

   Component: ${leak.component || 'Unknown'}
   Age: ${leak.age}ms

   Generate fix code that:
   1. Disposes resource properly
   2. Removes references
   3. Follows Hemingway style (max 30 lines, early returns)
   `.trim()
   }
   ```

---

### Phase 4: Panel UI (panel/App.vue)

**Objective:** Component-resource association view

**Block 4.1: Data Models**
Files: `panel/App.vue`

1. Add reactive state:
   ```typescript
   const snapshots = ref<StoredSnapshot[]>([])
   const currentDiff = ref<SnapshotDiff | null>(null)
   const leaks = ref<LeakCandidate[]>([])
   const selectedLeak = ref<LeakCandidate | null>(null)
   const fixSuggestion = ref<FixResult | null>(null)
   ```

**Block 4.2: Resource Table**
Files: `panel/components/ResourceTable.vue` (new)

1. Display resources with columns:
   - Type (Texture/Geometry/Renderer)
   - UUID (truncated)
   - Component (clickable)
   - Age
   - Status (Active/Disposed/Leaked)
2. Group by component
3. Highlight leaked resources

**Block 4.3: Leak Detail View**
Files: `panel/components/LeakDetail.vue` (new)

1. Show selected leak's full context
2. Display allocation stack trace
3. Render source code snippet with syntax highlighting
4. Show component hierarchy
5. Button: "Generate Fix" (triggers AI copilot)

**Block 4.4: AI Fix Panel**
Files: `panel/components/FixPanel.vue` (new)

1. Display fix suggestion with code block
2. Show provider used (Gemini Nano/OpenAI/Claude)
3. Copy to clipboard button
4. Diff view (before/after)

---

### Phase 5: Integration & Testing

**Block 5.1: E2E Test Scenario**
Files: `tests/e2e/leak-detection.spec.ts`

1. Create test Vue app with THREE.js scene
2. Intentionally leak texture:
   ```typescript
   const leakTexture = () => {
     const texture = new THREE.TextureLoader().load('/test.jpg')
     // NO dispose() call
   }
   ```
3. Take 2 snapshots (5s apart)
4. Assert: `diff.leaked.length > 0`
5. Assert: Leak age > 5000ms
6. Assert: Component association exists

**Block 5.2: Performance Validation**
Files: `tests/performance/fps-impact.spec.ts`

1. Measure baseline FPS (60 FPS target)
2. Enable Leak Hunter
3. Measure FPS with monitoring active
4. Assert: Impact < 5% (> 57 FPS)

**Block 5.3: AI Fallback Test**
Files: `tests/unit/ai-copilot.spec.ts`

1. Mock `window.ai` unavailable
2. Mock OpenAI API key present
3. Call `generateFix()`
4. Assert: Provider is OpenAI
5. Mock all providers unavailable
6. Assert: Returns error result

</ExecutionPlan>

## 5. Test Points

### Functional Verification
1. **Constructor Hijacking:**
   - ✅ All THREE.js instances have `__leak_uuid`
   - ✅ Registry captures allocation stack
   - ✅ Dispose marks `disposed: true`

2. **Vue Traversal:**
   - ✅ Component tree depth limited to 50
   - ✅ THREE.js refs extracted from `setupState`
   - ✅ UUID-component association stored

3. **Snapshot Diff:**
   - ✅ Added resources detected
   - ✅ Removed resources filtered
   - ✅ Leaked resources flagged (age > 5s)

4. **AI Copilot:**
   - ✅ Gemini Nano prioritized if available
   - ✅ Fallback to OpenAI/Claude
   - ✅ Source context extracted with 5-line window
   - ✅ Fix code follows Hemingway style

### Performance Gates
1. **FPS Impact:** < 5% (measure with Chrome DevTools FPS meter)
2. **Snapshot Time:** < 3s for 50MB heap
3. **Memory Overhead:** < 200MB for registry + snapshots
4. **Panel Render:** < 100ms initial load

### Style Compliance
1. **Cyclomatic Complexity:** < 10 per function
2. **File Length:** < 200 lines
3. **Function Length:** < 30 lines
4. **Nesting Depth:** < 3 levels
5. **NO Forbidden Patterns:** Manager/Handler, deep nesting, `any` type

**Audit Command:** Run `/sr:audit` against all modified files before commit.

## 6. Risk Mitigation

### Risk 1: Vue Devtools Hook Unavailable
**Mitigation:** Fallback to manual component registration API
```typescript
const registerComponent = (component: Component, threeRefs: object) => {
  // Manual registration if __VUE_DEVTOOLS_GLOBAL_HOOK__ missing
}
```

### Risk 2: Snapshot Size > 100MB
**Mitigation:** Implement chunk streaming per `constitution.md` line 99-112

### Risk 3: Proxy Performance Impact
**Mitigation:** Use `Proxy` only for dispose, not property access

### Risk 4: AI Provider API Limits
**Mitigation:** Implement rate limiting + user notification

---

**Next Step:** Dispatch Worker agent with this strategy. Files to modify: `inject/index.ts`, `background/index.ts`, `types/census.ts`, `panel/App.vue`. Create files: `inject/vue-inspector.ts`, `background/snapshot-store.ts`, `background/diff-engine.ts`, `background/ai-copilot.ts`, `background/source-extractor.ts`, `background/prompts.ts`.
