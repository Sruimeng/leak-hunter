// Content Script - Message relay between Inject and Background
// Inject the probe script into page context
function injectProbe() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('assets/inject.js');
    script.type = 'module';
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}
// Relay messages from Inject -> Background
function handleInjectMessage(e) {
    if (e.source !== window)
        return;
    if (!e.data?.type?.startsWith('LEAK_HUNTER_'))
        return;
    const msg = e.data;
    if (msg.type === 'LEAK_HUNTER_CENSUS') {
        chrome.runtime.sendMessage({ type: 'CENSUS_UPDATE', payload: msg.payload });
    }
    if (msg.type === 'LEAK_HUNTER_SNAPSHOT') {
        chrome.runtime.sendMessage({ type: 'SNAPSHOT_TAKEN', payload: msg.payload });
    }
    if (msg.type === 'LEAK_HUNTER_SNAPSHOT_RESPONSE') {
        chrome.runtime.sendMessage({ type: 'SNAPSHOT_RESPONSE', payload: msg.payload });
    }
}
// Relay commands from Background -> Inject
function handleBackgroundMessage(msg, _sender, sendResponse) {
    if (msg.type === 'TAKE_SNAPSHOT') {
        window.postMessage({ type: 'LEAK_HUNTER_COMMAND', command: 'TAKE_SNAPSHOT' }, '*');
        sendResponse({ ok: true });
        return true;
    }
    if (msg.type === 'ANALYSIS_RESULT') {
        window.postMessage(msg, '*');
        sendResponse({ ok: true });
        return true;
    }
    return false;
}
// URL change detection for auto-snapshot
let lastUrl = location.href;
function watchUrlChanges() {
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            const previousUrl = lastUrl;
            lastUrl = location.href;
            chrome.runtime.sendMessage({
                type: 'URL_CHANGED',
                payload: { from: previousUrl, to: lastUrl },
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
// Inject panel into page as iframe (most reliable approach)
function injectPanel() {
    if (document.getElementById('leak-hunter-panel-root'))
        return;
    const iframe = document.createElement('iframe');
    iframe.id = 'leak-hunter-panel-root';
    iframe.src = chrome.runtime.getURL('src/panel/index.html');
    iframe.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 380px;
    height: 520px;
    border: none;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 2147483647;
    background: #1a1a2e;
  `;
    document.body.appendChild(iframe);
    // Store iframe position at drag start
    let iframeRect = { left: 0, top: 0 };
    window.addEventListener('message', (e) => {
        if (e.source !== iframe.contentWindow)
            return;
        if (e.data?.type === 'LEAK_HUNTER_DRAG_START') {
            const rect = iframe.getBoundingClientRect();
            iframeRect = { left: rect.left, top: rect.top };
        }
        if (e.data?.type === 'LEAK_HUNTER_DRAG_MOVE') {
            const { dx, dy } = e.data;
            iframe.style.left = `${iframeRect.left + dx}px`;
            iframe.style.top = `${iframeRect.top + dy}px`;
            iframe.style.right = 'auto';
            iframe.style.bottom = 'auto';
        }
        if (e.data?.type === 'LEAK_HUNTER_MINIMIZE') {
            iframe.style.width = '200px';
            iframe.style.height = '40px';
        }
        if (e.data?.type === 'LEAK_HUNTER_RESTORE') {
            iframe.style.width = '380px';
            iframe.style.height = '520px';
        }
    });
}
// Initialize
function init() {
    injectProbe();
    window.addEventListener('message', handleInjectMessage);
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    if (document.body) {
        injectPanel();
        watchUrlChanges();
    }
    else {
        document.addEventListener('DOMContentLoaded', () => {
            injectPanel();
            watchUrlChanges();
        });
    }
}
init();
export {};
