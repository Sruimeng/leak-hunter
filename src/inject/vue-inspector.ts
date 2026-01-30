import type { VueComponentTree } from '../types/census'

declare global {
  interface Window {
    __VUE_DEVTOOLS_GLOBAL_HOOK__?: {
      apps: Array<{ _instance: VueComponent }>
    }
    __vue_app__?: { _instance: VueComponent }
  }
}

interface VueComponent {
  uid: string | number
  type: { name?: string }
  props?: Record<string, unknown>
  setupState?: Record<string, unknown>
  data?: Record<string, unknown>
  ctx?: Record<string, unknown>
  subTree?: VNode
}

interface VNode {
  component?: VueComponent
  children?: VNode[]
}

const MAX_DEPTH = 50

const isThreeObject = (obj: unknown): obj is { __leak_uuid?: string } => {
  if (!obj || typeof obj !== 'object') return false
  return '__leak_uuid' in obj
}

const extractResources = (
  component: VueComponent
): Array<{ uuid: string; field: string }> => {
  const resources: Array<{ uuid: string; field: string }> = []
  const sources = [component.setupState, component.data, component.ctx]

  for (const source of sources) {
    if (!source) continue

    for (const [field, value] of Object.entries(source)) {
      if (isThreeObject(value) && value.__leak_uuid) {
        resources.push({ uuid: value.__leak_uuid, field })
      }
    }
  }

  return resources
}

const getComponentVNodes = (component: VueComponent): VNode[] => {
  if (!component.subTree?.children) return []
  return (component.subTree.children as VNode[]).filter((vnode) => vnode.component)
}

const traverse = (component: VueComponent, depth: number): VueComponentTree | null => {
  if (!component || depth > MAX_DEPTH) return null

  const descriptor: VueComponentTree = {
    uid: String(component.uid ?? 'unknown'),
    name: component.type.name || 'Anonymous',
    props: component.props ? Object.keys(component.props) : [],
    resources: extractResources(component),
    children: [],
  }

  const vnodes = getComponentVNodes(component)
  for (const vnode of vnodes) {
    if (!vnode.component) continue
    const child = traverse(vnode.component, depth + 1)
    if (child) descriptor.children.push(child)
  }

  return descriptor
}

export const inspectVueTree = (): VueComponentTree | null => {
  // Method 1: Our hijacked global variable
  const nexusApp = (window as any).__NEXUS_VUE_APP__
  if (nexusApp?._instance) {
    return traverse(nexusApp._instance, 0)
  }

  // Method 2: DevTools hook
  const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__
  if (hook?.apps?.[0]?._instance) {
    return traverse(hook.apps[0]._instance, 0)
  }

  // Method 3: DOM traversal to find Vue app
  const root = document.querySelector('#app')
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let node = walker.nextNode() as Element & { __vue_app__?: any; __vnode__?: any }
    while (node) {
      if (node.__vue_app__?._instance) {
        return traverse(node.__vue_app__._instance, 0)
      }
      node = walker.nextNode() as any
    }
  }

  return null
}
