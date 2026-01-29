import type { Settings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

const STORAGE_KEYS = {
  settings: 'leak_hunter_settings',
  snapshots: 'leak_hunter_snapshots',
} as const

export async function getStoredSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings)
  const stored = result[STORAGE_KEYS.settings] as Partial<Settings> | undefined
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getStoredSettings()
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: { ...current, ...settings },
  })
}

export async function getApiKey(): Promise<string | null> {
  const settings = await getStoredSettings()
  return settings.apiKey
}

export async function setApiKey(apiKey: string): Promise<void> {
  await saveSettings({ apiKey })
}
