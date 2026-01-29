import { DEFAULT_SETTINGS } from '@/types';
const STORAGE_KEYS = {
    settings: 'leak_hunter_settings',
    snapshots: 'leak_hunter_snapshots',
};
export async function getStoredSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    const stored = result[STORAGE_KEYS.settings];
    return { ...DEFAULT_SETTINGS, ...stored };
}
export async function saveSettings(settings) {
    const current = await getStoredSettings();
    await chrome.storage.local.set({
        [STORAGE_KEYS.settings]: { ...current, ...settings },
    });
}
export async function getApiKey() {
    const settings = await getStoredSettings();
    return settings.apiKey;
}
export async function setApiKey(apiKey) {
    await saveSettings({ apiKey });
}
