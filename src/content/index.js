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
// Initialize
function init() {
    injectProbe();
    window.addEventListener('message', handleInjectMessage);
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    if (document.body) {
        watchUrlChanges();
    }
    else {
        document.addEventListener('DOMContentLoaded', watchUrlChanges);
    }
    console.log('[Leak Hunter] Content script loaded');
}
init();
export {};
