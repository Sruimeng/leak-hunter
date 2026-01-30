import type { UuidLeakCandidate } from '../types'
import type { AIProvider, FixResult, SourceContext } from '../types/ai'
import { getApiKey, getStoredSettings } from '../utils/storage'
import { buildFixPrompt } from './prompts'

const createGeminiNanoProvider = (): AIProvider => ({
  name: 'Gemini Nano',
  cost: 0,
  check: async () => false,
  generate: async (_prompt: string) => {
    throw new Error('Gemini Nano not available in service worker')
  },
})

const createOpenAIProvider = (): AIProvider => ({
  name: 'OpenAI',
  cost: 1,
  check: async () => {
    const key = await getApiKey()
    return key !== null
  },
  generate: async (prompt: string) => {
    const key = await getApiKey()
    if (!key) throw new Error('OpenAI API key missing')

    const settings = await getStoredSettings()
    const response = await fetch(settings.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: 'You are a THREE.js memory leak expert.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content ?? ''
  },
})

const createClaudeProvider = (): AIProvider => ({
  name: 'Claude',
  cost: 2,
  check: async () => {
    const storage = await chrome.storage.local.get('claudeApiKey')
    return storage.claudeApiKey !== undefined
  },
  generate: async (prompt: string) => {
    const storage = await chrome.storage.local.get('claudeApiKey')
    const key = storage.claudeApiKey

    if (!key) throw new Error('Claude API key missing')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text ?? ''
  },
})

const selectProvider = async (): Promise<AIProvider | null> => {
  const providers = [
    createGeminiNanoProvider(),
    createOpenAIProvider(),
    createClaudeProvider(),
  ].sort((a, b) => a.cost - b.cost)

  for (const provider of providers) {
    if (await provider.check()) {
      return provider
    }
  }

  return null
}

export const generateFix = async (
  leak: UuidLeakCandidate,
  context: SourceContext | null = null
): Promise<FixResult> => {
  const provider = await selectProvider()

  if (!provider) {
    return {
      ok: false,
      error: 'No AI provider available',
    }
  }

  const prompt = buildFixPrompt(leak, context)

  try {
    const fix = await provider.generate(prompt)
    return {
      ok: true,
      fix,
      provider: provider.name,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
