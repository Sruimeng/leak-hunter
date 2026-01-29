// Scene census data structure from injected script
export interface SceneCensus {
  timestamp: number // Unix epoch ms
  memory: MemoryMetrics
  objects: Record<string, number> // e.g., "Mesh(Car_Wheel)": 4
}

export interface MemoryMetrics {
  heapUsed: number // Bytes
  gpuGeometries: number
  gpuTextures: number
}

export interface LeakCandidate {
  name: string
  before: number
  after: number
}

export interface LeakReport {
  event: string
  leaked_candidates: LeakCandidate[]
  analysis?: string
  recommendations?: string[]
}
