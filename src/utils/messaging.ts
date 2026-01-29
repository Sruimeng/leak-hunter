import type { RuntimeMessage, RuntimeResponse, Settings } from '@/types'

export async function sendMessage<T extends RuntimeMessage>(
  message: T
): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message)
}

export async function getSettings(): Promise<Settings> {
  const response = await sendMessage({ type: 'GET_SETTINGS', payload: null })
  if (response.type === 'SETTINGS') return response.payload
  throw new Error('Failed to get settings')
}

export async function setApiKey(apiKey: string): Promise<void> {
  const response = await sendMessage({ type: 'SET_API_KEY', payload: apiKey })
  if (response.type !== 'OK') throw new Error('Failed to set API key')
}
