import type { ResourceDescriptor, UuidLeakCandidate, SnapshotDiff } from '../types'

const LEAK_THRESHOLD_MS = 5000

export function computeDiff(
  prev: ResourceDescriptor[],
  curr: ResourceDescriptor[],
  currentTime: number = Date.now()
): SnapshotDiff {
  const prevMap = new Map(prev.map(r => [r.uuid, r]))
  const currMap = new Map(curr.map(r => [r.uuid, r]))

  const added = curr.filter(r => !prevMap.has(r.uuid))
  const removed = prev
    .filter(r => !currMap.has(r.uuid))
    .map(r => r.uuid)

  const leaked = findLeaks(prev, currMap, currentTime)

  return { added, removed, leaked }
}

function findLeaks(
  prev: ResourceDescriptor[],
  currMap: Map<string, ResourceDescriptor>,
  currentTime: number
): UuidLeakCandidate[] {
  const candidates: UuidLeakCandidate[] = []

  for (const resource of prev) {
    if (!shouldCheckLeak(resource, currMap)) continue

    const age = currentTime - resource.timestamp
    if (age < LEAK_THRESHOLD_MS) continue

    const current = currMap.get(resource.uuid)
    candidates.push({
      uuid: resource.uuid,
      age,
      descriptor: current ?? resource,
      component: current?.component ?? resource.component,
    })
  }

  return candidates
}

function shouldCheckLeak(
  resource: ResourceDescriptor,
  currMap: Map<string, ResourceDescriptor>
): boolean {
  const current = currMap.get(resource.uuid)
  if (!current) return false
  if (current.disposed) return false
  return true
}
