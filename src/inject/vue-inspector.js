const MAX_DEPTH = 50;
const isThreeObject = (obj) => {
    if (!obj || typeof obj !== 'object')
        return false;
    return '__leak_uuid' in obj;
};
const extractResources = (component) => {
    const resources = [];
    const sources = [component.setupState, component.data, component.ctx];
    for (const source of sources) {
        if (!source)
            continue;
        for (const [field, value] of Object.entries(source)) {
            if (isThreeObject(value) && value.__leak_uuid) {
                resources.push({ uuid: value.__leak_uuid, field });
            }
        }
    }
    return resources;
};
const getComponentVNodes = (component) => {
    if (!component.subTree?.children)
        return [];
    return component.subTree.children.filter((vnode) => vnode.component);
};
const traverse = (component, depth) => {
    if (!component || depth > MAX_DEPTH)
        return null;
    const descriptor = {
        uid: String(component.uid ?? 'unknown'),
        name: component.type.name || 'Anonymous',
        props: component.props ? Object.keys(component.props) : [],
        resources: extractResources(component),
        children: [],
    };
    const vnodes = getComponentVNodes(component);
    for (const vnode of vnodes) {
        if (!vnode.component)
            continue;
        const child = traverse(vnode.component, depth + 1);
        if (child)
            descriptor.children.push(child);
    }
    return descriptor;
};
export const inspectVueTree = () => {
    // Method 1: Our hijacked global variable
    const nexusApp = window.__NEXUS_VUE_APP__;
    if (nexusApp?._instance) {
        return traverse(nexusApp._instance, 0);
    }
    // Method 2: DevTools hook
    const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
    if (hook?.apps?.[0]?._instance) {
        return traverse(hook.apps[0]._instance, 0);
    }
    // Method 3: DOM traversal to find Vue app
    const root = document.querySelector('#app');
    if (root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let node = walker.nextNode();
        while (node) {
            if (node.__vue_app__?._instance) {
                return traverse(node.__vue_app__._instance, 0);
            }
            node = walker.nextNode();
        }
    }
    return null;
};
