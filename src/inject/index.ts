// Inject script - runs in page's Main World
// Access Three.js renderer and scene

import type { SceneCensus, MemoryMetrics } from '../types/census'

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

// Three.js types (minimal)
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

function getRenderer(): THREE.WebGLRenderer | null {
  return window.__THREE_RENDERER__ ?? null
}

function getScene(): THREE.Scene | null {
  return window.__THREE_SCENE__ ?? window.scene ?? null
}

function getMemoryMetrics(renderer: THREE.WebGLRenderer | null): MemoryMetrics {
  return {
    heapUsed: performance.memory?.usedJSHeapSize ?? 0,
    gpuGeometries: renderer?.info.memory.geometries ?? 0,
    gpuTextures: renderer?.info.memory.textures ?? 0,
  }
}

function collectObjectCensus(scene: THREE.Scene): Record<string, number> {
  const objects: Record<string, number> = {}

  scene.traverse((obj) => {
    const name = obj.name || 'unnamed'
    const key = `${obj.type}(${name})`
    objects[key] = (objects[key] ?? 0) + 1
  })

  return objects
}

export function getSceneCensus(): SceneCensus | null {
  const renderer = getRenderer()
  const scene = getScene()

  if (!scene) return null

  return {
    timestamp: Date.now(),
    memory: getMemoryMetrics(renderer),
    objects: collectObjectCensus(scene),
  }
}

function postCensus(census: SceneCensus): void {
  window.postMessage({ type: 'LEAK_HUNTER_CENSUS', payload: census }, '*')
}

function startPolling(intervalMs: number): void {
  setInterval(() => {
    const census = getSceneCensus()
    if (census) postCensus(census)
  }, intervalMs)
}

// Listen for commands from content script
window.addEventListener('message', (e) => {
  if (e.source !== window) return
  if (e.data?.type !== 'LEAK_HUNTER_COMMAND') return

  const command = e.data.command as string

  if (command === 'TAKE_SNAPSHOT') {
    const census = getSceneCensus()
    if (census) {
      window.postMessage({ type: 'LEAK_HUNTER_SNAPSHOT', payload: census }, '*')
    }
  }
})

// Start 1Hz polling
startPolling(1000)

console.log('[Leak Hunter] Inject script loaded')
