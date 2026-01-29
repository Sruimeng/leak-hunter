// Inject script - runs in page's Main World
// Access Three.js renderer and scene
function getRenderer() {
    return window.__THREE_RENDERER__ ?? null;
}
function getScene() {
    return window.__THREE_SCENE__ ?? window.scene ?? null;
}
function getMemoryMetrics(renderer) {
    return {
        heapUsed: performance.memory?.usedJSHeapSize ?? 0,
        gpuGeometries: renderer?.info.memory.geometries ?? 0,
        gpuTextures: renderer?.info.memory.textures ?? 0,
    };
}
function collectObjectCensus(scene) {
    const objects = {};
    scene.traverse((obj) => {
        const name = obj.name || 'unnamed';
        const key = `${obj.type}(${name})`;
        objects[key] = (objects[key] ?? 0) + 1;
    });
    return objects;
}
export function getSceneCensus() {
    const renderer = getRenderer();
    const scene = getScene();
    if (!scene)
        return null;
    return {
        timestamp: Date.now(),
        memory: getMemoryMetrics(renderer),
        objects: collectObjectCensus(scene),
    };
}
function postCensus(census) {
    window.postMessage({ type: 'LEAK_HUNTER_CENSUS', payload: census }, '*');
}
function startPolling(intervalMs) {
    setInterval(() => {
        const census = getSceneCensus();
        if (census)
            postCensus(census);
    }, intervalMs);
}
// Listen for commands from content script
window.addEventListener('message', (e) => {
    if (e.source !== window)
        return;
    if (e.data?.type !== 'LEAK_HUNTER_COMMAND')
        return;
    const command = e.data.command;
    if (command === 'TAKE_SNAPSHOT') {
        const census = getSceneCensus();
        if (census) {
            window.postMessage({ type: 'LEAK_HUNTER_SNAPSHOT', payload: census }, '*');
        }
    }
});
// Start 1Hz polling
startPolling(1000);
console.log('[Leak Hunter] Inject script loaded');
