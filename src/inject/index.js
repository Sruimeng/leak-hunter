// Inject script - runs in page's Main World
// Hijacks THREE.js constructors and tracks resource lifecycle
import { inspectVueTree } from './vue-inspector';
import { getSceneCensus, startPolling } from './legacy-census';
var THREE;
(function (THREE) {
    class WebGLRenderer {
    }
    THREE.WebGLRenderer = WebGLRenderer;
    class Texture {
    }
    THREE.Texture = Texture;
    class BufferGeometry {
    }
    THREE.BufferGeometry = BufferGeometry;
    class Material {
    }
    THREE.Material = Material;
})(THREE || (THREE = {}));
const registry = new Map();
const captureStack = (depth = 3) => {
    const stack = new Error().stack?.split('\n').slice(2, 2 + depth) ?? [];
    return stack.map((line) => line.trim());
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hijackConstructor = (target, type) => {
    const original = target;
    return class extends original {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args) {
            super(...args);
            const uuid = crypto.randomUUID();
            Object.defineProperty(this, '__leak_uuid', {
                value: uuid,
                writable: false,
                enumerable: false,
            });
            registry.set(uuid, {
                uuid,
                type,
                timestamp: Date.now(),
                stack: captureStack(),
                disposed: false,
            });
        }
    };
};
const hijackDispose = (obj) => {
    if (!obj.dispose)
        return;
    const original = obj.dispose;
    obj.dispose = function () {
        const uuid = this.__leak_uuid;
        if (uuid) {
            const descriptor = registry.get(uuid);
            if (descriptor)
                descriptor.disposed = true;
        }
        original.call(this);
    };
};
function installHookFor(constructor, type) {
    if (!constructor)
        return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hijacked = hijackConstructor(constructor, type);
    hijackDispose(hijacked.prototype);
    Object.setPrototypeOf(constructor, hijacked);
}
const installHooks = () => {
    if (!window.THREE)
        return;
    const targets = [
        [window.THREE.WebGLRenderer, 'WebGLRenderer'],
        [window.THREE.Texture, 'Texture'],
        [window.THREE.BufferGeometry, 'BufferGeometry'],
        [window.THREE.Material, 'Material'],
    ];
    for (const [constructor, type] of targets) {
        installHookFor(constructor, type);
    }
};
// Hijack Vue createApp
const hijackVue = () => {
    const originalCreateApp = window.Vue?.createApp;
    if (!originalCreateApp)
        return;
    window.Vue.createApp = (...args) => {
        const app = originalCreateApp(...args);
        const originalMount = app.mount.bind(app);
        app.mount = (container) => {
            window.__NEXUS_VUE_APP__ = app;
            return originalMount(container);
        };
        return app;
    };
};
// Hijack THREE.js via property setter
const hijackThreeOnLoad = () => {
    let _THREE = window.THREE;
    Object.defineProperty(window, 'THREE', {
        get: () => _THREE,
        set: (value) => {
            _THREE = value;
            if (value) {
                installHooks();
            }
        },
        configurable: true
    });
};
const getSnapshotData = () => {
    const resources = Array.from(registry.values());
    const vue = inspectVueTree();
    return {
        timestamp: Date.now(),
        resources,
        vue,
    };
};
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
    if (command === 'SNAPSHOT_REQUEST') {
        performance.mark('snapshot-start');
        const data = getSnapshotData();
        window.postMessage({ type: 'SNAPSHOT_RESPONSE', data }, '*');
        performance.mark('snapshot-end');
    }
});
// Initialize: hijack before DOM loads
hijackVue();
hijackThreeOnLoad();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        installHooks();
        startPolling(1000);
    });
}
else {
    installHooks();
    startPolling(1000);
}
