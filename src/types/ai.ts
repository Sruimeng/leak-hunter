export interface AIProvider {
  name: string
  check: () => Promise<boolean>
  generate: (prompt: string) => Promise<string>
  cost: number
}

export interface SourceContext {
  file: string
  line: number
  snippet: string
  highlight: number
}

export type FixResult =
  | { ok: true; fix: string; provider: string }
  | { ok: false; error: string }

export interface GeminiNanoSession {
  prompt: (text: string) => Promise<string>
  destroy: () => void
}

export interface WindowAI {
  createTextSession: () => Promise<GeminiNanoSession>
}

declare global {
  interface Window {
    ai?: WindowAI
  }
}
