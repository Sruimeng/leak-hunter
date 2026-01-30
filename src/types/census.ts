// Scene census data structure from injected script
export interface SceneCensus {
  timestamp: number // Unix epoch ms
  memory: MemoryMetrics
  objects: Record<string, number> // e.g., "Mesh(Car_Wheel)": 4
  vue?: VueComponentTree | null
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

export type ResourceType = 'Texture' | 'BufferGeometry' | 'WebGLRenderer' | 'Material'

export interface ResourceDescriptor {
  uuid: string
  type: ResourceType
  timestamp: number
  stack: string[]
  disposed: boolean
  component?: string
}

export interface VueComponentTree {
  uid: string
  name: string
  props: string[]
  resources: Array<{ uuid: string; field: string }>
  children: VueComponentTree[]
}

export interface SnapshotMessage {
  type: 'SNAPSHOT_RESPONSE'
  data: {
    timestamp: number
    resources: ResourceDescriptor[]
    vue: VueComponentTree | null
  }
}

export interface UuidLeakCandidate {
  uuid: string
  age: number
  descriptor: ResourceDescriptor
  component?: string
}

export interface LeakWarning {
  type: 'LEAK_DETECTED'
  timestamp: number
  leaks: UuidLeakCandidate[]
}

export interface SnapshotDiff {
  added: ResourceDescriptor[]
  removed: string[]
  leaked: UuidLeakCandidate[]
}
