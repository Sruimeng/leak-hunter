---
id: style-hemingway
type: reference
version: 1.0.0
related_ids: [constitution]
---

# Hemingway Style

## Iceberg Principle

**One-Eighth Above Water.**

```typescript
// ❌ BAD: Everything visible
function processUserClickEventAndUpdateStateAccordingly(event: MouseEvent) {
  // Extract the target element from the event
  const target = event.target
  // Update the application state
  updateState(target)
}

// ✅ GOOD: Show structure, hide details
const handleClick = (e: MouseEvent) => updateState(e.target)
```

**Rule:** Code reveals structure. Implementation hides beneath.

## Type-First Definitions

**Types Are Documentation.**

```typescript
// ✅ GOOD: Type tells the story
interface HeapSnapshot {
  nodes: Uint32Array
  edges: Uint32Array
  strings: string[]
}

const parse = (raw: string): HeapSnapshot => {
  // Implementation is obvious from signature
}

// ❌ BAD: Comments compensate for weak types
function parse(data: any) {
  // Parse heap snapshot data and return structured format
}
```

**Constraints:**
- NO `any` (use `unknown` if needed)
- NO implicit returns in functions > 1 line
- Interfaces > Classes (unless stateful)

## Naming Law

**Clarity > Brevity. Brevity > Length.**

```typescript
// ✅ GOOD
const detectDetachedNodes = (snapshot: HeapSnapshot) => {}

// ❌ BAD: Too terse
const ddn = (s: any) => {}

// ❌ BAD: Bureaucratic
const AbstractDetachedDOMNodeDetectorFactoryImpl = class {}
```

**Forbidden Patterns:**
- `Manager`, `Handler`, `Processor` suffixes (what do they manage?)
- `Abstract`, `Base`, `Impl` prefixes
- Single-letter variables (except loop indices `i`, `j`)

## Comment Protocol

**Code Explains How. Types Explain What. Comments Explain Why.**

```typescript
// ✅ GOOD: Comment explains non-obvious "why"
// Chrome debugger fails if another extension attached
await detachExisting(tabId)

// ❌ BAD: Comment repeats code
// Loop through items
for (const item of items) {}

// ❌ BAD: Apologetic comment
// TODO: This is hacky but it works
const result = weirdTrick()
```

**Rules:**
- NO "what" comments
- NO TODO without issue number
- Delete commented-out code

## Function Structure

**Newspaper Principle: Important First.**

```typescript
// ✅ GOOD: Guards at top, happy path visible
const detectLeaks = async (tabId: number): Promise<Result<Leak[]>> => {
  if (!tabId) return err('Invalid tab')
  if (!await canAttachDebugger(tabId)) return err('Debugger busy')

  const snapshot = await takeSnapshot(tabId)
  return ok(analyzeSnapshot(snapshot))
}

// ❌ BAD: Nested logic, unclear flow
const detectLeaks = async (tabId: number) => {
  if (tabId) {
    const canAttach = await canAttachDebugger(tabId)
    if (canAttach) {
      try {
        const snapshot = await takeSnapshot(tabId)
        return analyzeSnapshot(snapshot)
      } catch (e) {
        // ...
      }
    }
  }
}
```

**Constraints:**
- Max depth: 2 levels
- Max length: 30 lines (extract helpers)
- Early returns > else branches

## Forbidden Patterns

### Deep Nesting

```typescript
// ❌ BAD
if (a) {
  if (b) {
    if (c) {
      doThing()
    }
  }
}

// ✅ GOOD
if (!a) return
if (!b) return
if (!c) return
doThing()
```

### God Functions

```typescript
// ❌ BAD: Does everything
const initialize = () => {
  setupUI()
  connectDebugger()
  startPolling()
  registerListeners()
  loadConfig()
}

// ✅ GOOD: Orchestrates
const initialize = async () => {
  await loadConfig()
  await setupDebugger()
  startUI()
}
```

### Boolean Flags

```typescript
// ❌ BAD
const process = (data: Data, isDetached: boolean, shouldLog: boolean) => {}

// ✅ GOOD: Separate functions or strategy pattern
const processDetached = (data: Data) => {}
const processAttached = (data: Data) => {}
```

## File Organization

**One Concept Per File.**

```typescript
// detector.ts
export const detectDetachedNodes = () => {}
export const detectListenerLeaks = () => {}
export const detectClosureLeaks = () => {}

// ❌ Don't mix concerns
export const detectLeaks = () => {}
export const formatDate = () => {} // Wrong file
```

**Constraints:**
- Max file size: 200 lines
- Group related functions
- NO utils dumping ground

## Import Order

**Standard, External, Internal.**

```typescript
// 1. Node/Browser APIs
import { EventEmitter } from 'events'

// 2. External packages
import React from 'react'

// 3. Internal modules
import { detectLeaks } from '@/lib/detector'
import type { Leak } from '@/types'
```

**Rules:**
- Group by source
- Type imports last in each group
- NO `import *`

## Async/Await

**NO Callbacks. NO Mixing.**

```typescript
// ✅ GOOD
const snapshot = await takeSnapshot(tabId)
const leaks = await detectLeaks(snapshot)

// ❌ BAD: Callback hell
takeSnapshot(tabId, (snapshot) => {
  detectLeaks(snapshot, (leaks) => {
    // ...
  })
})

// ❌ BAD: Mixing styles
const snapshot = await takeSnapshot(tabId)
detectLeaks(snapshot).then((leaks) => {}) // Pick one
```

**Rules:**
- Prefer `async/await` over `.then()`
- Handle errors with try/catch or Result type
- NO floating promises

## Error Messages

**Actionable, Not Apologetic.**

```typescript
// ✅ GOOD
throw new Error('Debugger already attached to tab 123. Detach first.')

// ❌ BAD
throw new Error('Oops! Something went wrong. Please try again.')

// ❌ BAD
throw new Error('Error') // What error?
```

**Format:**
```
<What failed>. <Why it failed>. <How to fix>.
```

## Constants

**Group Related, Type Strictly.**

```typescript
// ✅ GOOD
const LEAK_THRESHOLD = {
  DETACHED_NODES: 100,
  LISTENERS: 50,
  RETAINED_SIZE: 10 * 1024 * 1024, // 10MB
} as const

type Threshold = typeof LEAK_THRESHOLD[keyof typeof LEAK_THRESHOLD]

// ❌ BAD: Scattered
const MAX_NODES = 100
const MAX_LISTENERS = 50
```

## Testing Naming

**Test Names Are Sentences.**

```typescript
// ✅ GOOD
test('detects detached nodes exceeding threshold', () => {})
test('ignores nodes below 100 count', () => {})

// ❌ BAD
test('detachedNodes', () => {})
test('test1', () => {})
```

## Anti-Patterns Summary

**Delete These:**
- Meta-comments ("This function does X")
- Manager/Handler/Processor classes
- Nested ternaries
- Magic numbers (use named constants)
- `var` keyword
- Semicolons (use consistent style, enforce with linter)

**Embrace These:**
- Pure functions
- Immutability
- Explicit error handling
- Type inference (but annotate public APIs)
- Destructuring
- Array methods over loops

## Metrics

**Quality Gates:**
- Cyclomatic complexity: < 10 per function
- File length: < 200 lines
- Function length: < 30 lines
- Nesting depth: < 3 levels

**Reject code violating these.**
