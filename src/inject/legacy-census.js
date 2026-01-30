import { inspectVueTree } from './vue-inspector';
const getRenderer = () => {
    return window.__THREE_RENDERER__ ?? null;
};
const getScene = () => {
    return window.__THREE_SCENE__ ?? window.scene ?? null;
};
const getMemoryMetrics = (renderer) => {
    return {
        heapUsed: performance.memory?.usedJSHeapSize ?? 0,
        gpuGeometries: renderer?.info.memory.geometries ?? 0,
        gpuTextures: renderer?.info.memory.textures ?? 0,
    };
};
const collectObjectCensus = (scene) => {
    const objects = {};
    scene.traverse((obj) => {
        const name = obj.name || 'unnamed';
        const key = `${obj.type}(${name})`;
        objects[key] = (objects[key] ?? 0) + 1;
    });
    return objects;
};
export const getSceneCensus = () => {
    const renderer = getRenderer();
    const scene = getScene();
    const vue = inspectVueTree();
    return {
        timestamp: Date.now(),
        memory: getMemoryMetrics(renderer),
        objects: scene ? collectObjectCensus(scene) : {},
        vue,
    };
};
export const postCensus = (census) => {
    window.postMessage({ type: 'LEAK_HUNTER_CENSUS', payload: census }, '*');
};
export const startPolling = (intervalMs) => {
    setInterval(() => {
        const census = getSceneCensus();
        postCensus(census);
    }, intervalMs);
};
