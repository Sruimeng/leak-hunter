import type { SceneCensus, LeakCandidate, LeakReport } from './census'

// Message types for Inject -> Content (postMessage)
export type InjectMessage =
  | { type: 'LEAK_HUNTER_CENSUS'; payload: SceneCensus }
  | { type: 'LEAK_HUNTER_SNAPSHOT'; payload: SceneCensus }
  | { type: 'LEAK_HUNTER_ERROR'; payload: string }

// Message types for Content -> Background (chrome.runtime.sendMessage)
export type RuntimeMessage =
  | { type: 'CENSUS_UPDATE'; payload: SceneCensus }
  | { type: 'TAKE_SNAPSHOT'; payload: null }
  | { type: 'ANALYZE_DIFF'; payload: { before: SceneCensus; after: SceneCensus; event: string } }
  | { type: 'GET_API_KEY'; payload: null }
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'GET_SETTINGS'; payload: null }

// Response types from Background
export type RuntimeResponse =
  | { type: 'ANALYSIS_RESULT'; payload: LeakReport }
  | { type: 'API_KEY'; payload: string | null }
  | { type: 'SETTINGS'; payload: Settings }
  | { type: 'ERROR'; payload: string }
  | { type: 'OK'; payload: null }

export interface Settings {
  apiKey: string | null
  apiEndpoint: string
  model: string
  enabled: boolean
  pollInterval: number
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: null,
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  enabled: true,
  pollInterval: 1000,
}
