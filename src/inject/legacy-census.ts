import type { SceneCensus, MemoryMetrics } from '../types/census'
import { inspectVueTree } from './vue-inspector'

declare global {
  interface Window {
    __THREE_RENDERER__?: THREE.WebGLRenderer
    __THREE_SCENE__?: THREE.Scene
    scene?: THREE.Scene
  }
  interface Performance {
    memory?: {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    }
  }
}

namespace THREE {
  export interface Object3D {
    type: string
    name: string
    traverse(callback: (object: Object3D) => void): void
  }
  export interface Scene extends Object3D {}
  export interface WebGLRenderer {
    info: {
      memory: {
        geometries: number
        textures: number
      }
    }
  }
}

const getRenderer = (): THREE.WebGLRenderer | null => {
  return window.__THREE_RENDERER__ ?? null
}

const getScene = (): THREE.Scene | null => {
  return window.__THREE_SCENE__ ?? window.scene ?? null
}

const getMemoryMetrics = (renderer: THREE.WebGLRenderer | null): MemoryMetrics => {
  return {
    heapUsed: performance.memory?.usedJSHeapSize ?? 0,
    gpuGeometries: renderer?.info.memory.geometries ?? 0,
    gpuTextures: renderer?.info.memory.textures ?? 0,
  }
}

const collectObjectCensus = (scene: THREE.Scene): Record<string, number> => {
  const objects: Record<string, number> = {}

  scene.traverse((obj) => {
    const name = obj.name || 'unnamed'
    const key = `${obj.type}(${name})`
    objects[key] = (objects[key] ?? 0) + 1
  })

  return objects
}

export const getSceneCensus = (): SceneCensus => {
  const renderer = getRenderer()
  const scene = getScene()
  const vue = inspectVueTree()

  return {
    timestamp: Date.now(),
    memory: getMemoryMetrics(renderer),
    objects: scene ? collectObjectCensus(scene) : {},
    vue,
  }
}

export const postCensus = (census: SceneCensus): void => {
  window.postMessage({ type: 'LEAK_HUNTER_CENSUS', payload: census }, '*')
}

export const startPolling = (intervalMs: number): void => {
  setInterval(() => {
    const census = getSceneCensus()
    postCensus(census)
  }, intervalMs)
}
