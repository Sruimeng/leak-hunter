import type { ResourceDescriptor } from '../types'

interface StoredSnapshot {
  id: string
  timestamp: number
  resources: ResourceDescriptor[]
}

const MAX_SNAPSHOTS = 10
const STORAGE_KEY = 'snapshots'

export async function saveSnapshot(resources: ResourceDescriptor[]): Promise<string> {
  const id = crypto.randomUUID()
  const snapshot: StoredSnapshot = {
    id,
    timestamp: Date.now(),
    resources,
  }

  const stored = await getSnapshots()
  const updated = [...stored, snapshot]

  if (updated.length > MAX_SNAPSHOTS) {
    updated.shift()
  }

  await chrome.storage.session.set({ [STORAGE_KEY]: updated })
  return id
}

export async function getSnapshots(): Promise<StoredSnapshot[]> {
  const result = await chrome.storage.session.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? []
}

export async function getSnapshot(id: string): Promise<StoredSnapshot | null> {
  const snapshots = await getSnapshots()
  return snapshots.find(s => s.id === id) ?? null
}

export async function getLastSnapshot(): Promise<StoredSnapshot | null> {
  const snapshots = await getSnapshots()
  return snapshots[snapshots.length - 1] ?? null
}

export async function clearSnapshots(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY)
}
