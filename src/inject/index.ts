// Inject script - runs in page's Main World
// Hijacks THREE.js constructors and tracks resource lifecycle

import type { ResourceDescriptor, ResourceType } from '../types/census'
import { inspectVueTree } from './vue-inspector'
import { getSceneCensus, startPolling } from './legacy-census'

declare global {
  interface Window {
    THREE?: typeof THREE
  }
}

namespace THREE {
  export interface Object3D {
    __leak_uuid?: string
  }
  export interface WebGLRenderer {
    __leak_uuid?: string
    dispose?(): void
  }
  export interface Texture {
    __leak_uuid?: string
    dispose?(): void
  }
  export interface BufferGeometry {
    __leak_uuid?: string
    dispose?(): void
  }
  export interface Material {
    __leak_uuid?: string
    dispose?(): void
  }

  export class WebGLRenderer {}
  export class Texture {}
  export class BufferGeometry {}
  export class Material {}
}

const registry = new Map<string, ResourceDescriptor>()

const captureStack = (depth = 3): string[] => {
  const stack = new Error().stack?.split('\n').slice(2, 2 + depth) ?? []
  return stack.map((line) => line.trim())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hijackConstructor = <T extends new (...args: any[]) => object>(
  target: T,
  type: ResourceType
): T => {
  const original = target
  return class extends original {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args)
      const uuid = crypto.randomUUID()
      Object.defineProperty(this, '__leak_uuid', {
        value: uuid,
        writable: false,
        enumerable: false,
      })
      registry.set(uuid, {
        uuid,
        type,
        timestamp: Date.now(),
        stack: captureStack(),
        disposed: false,
      })
    }
  } as T
}

const hijackDispose = <T extends { dispose?: () => void }>(obj: T): void => {
  if (!obj.dispose) return

  const original = obj.dispose
  obj.dispose = function (this: T & { __leak_uuid?: string }) {
    const uuid = this.__leak_uuid
    if (uuid) {
      const descriptor = registry.get(uuid)
      if (descriptor) descriptor.disposed = true
    }
    original.call(this)
  }
}

function installHookFor(
  constructor: unknown,
  type: ResourceType
): void {
  if (!constructor) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hijacked = hijackConstructor(constructor as new (...args: any[]) => object, type)
  hijackDispose(hijacked.prototype)
  Object.setPrototypeOf(constructor, hijacked)
}

const installHooks = (): void => {
  if (!window.THREE) return

  const targets: Array<[unknown, ResourceType]> = [
    [window.THREE.WebGLRenderer, 'WebGLRenderer'],
    [window.THREE.Texture, 'Texture'],
    [window.THREE.BufferGeometry, 'BufferGeometry'],
    [window.THREE.Material, 'Material'],
  ]

  for (const [constructor, type] of targets) {
    installHookFor(constructor, type)
  }
}

// Hijack Vue createApp
const hijackVue = (): void => {
  const originalCreateApp = (window as any).Vue?.createApp
  if (!originalCreateApp) return

  (window as any).Vue.createApp = (...args: unknown[]) => {
    const app = originalCreateApp(...args)
    const originalMount = app.mount.bind(app)

    app.mount = (container: string | Element) => {
      (window as any).__NEXUS_VUE_APP__ = app
      return originalMount(container)
    }

    return app
  }
}

// Hijack THREE.js via property setter
const hijackThreeOnLoad = (): void => {
  let _THREE: unknown = (window as any).THREE

  Object.defineProperty(window, 'THREE', {
    get: () => _THREE,
    set: (value) => {
      _THREE = value
      if (value) {
        installHooks()
      }
    },
    configurable: true
  })
}

const getSnapshotData = () => {
  const resources = Array.from(registry.values())
  const vue = inspectVueTree()

  return {
    timestamp: Date.now(),
    resources,
    vue,
  }
}

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

  if (command === 'SNAPSHOT_REQUEST') {
    performance.mark('snapshot-start')
    const data = getSnapshotData()
    window.postMessage({ type: 'SNAPSHOT_RESPONSE', data }, '*')
    performance.mark('snapshot-end')
  }
})

// Initialize: hijack before DOM loads
hijackVue()
hijackThreeOnLoad()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    installHooks()
    startPolling(1000)
  })
} else {
  installHooks()
  startPolling(1000)
}
