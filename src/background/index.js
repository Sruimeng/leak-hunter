// Background Service Worker - AI API proxy and state coordination
import { getStoredSettings, saveSettings, getApiKey } from '../utils/storage';
const SYSTEM_PROMPT = `你是 Three.js 内存泄漏分析专家。根据提供的对象 Diff 数据，判断哪些对象属于'应该销毁但未销毁'的残留物。忽略 Vue 的内部对象。直接返回泄漏对象的名称列表和简短建议。

返回格式（JSON）：
{
  "leaks": ["对象名1", "对象名2"],
  "severity": "high" | "medium" | "low",
  "recommendations": ["建议1", "建议2"]
}`;
// Snapshot storage (ephemeral, lost on worker termination)
let beforeSnapshot = null;
let pendingAnalysis = false;
function computeDiff(before, after) {
    const leaked = [];
    for (const [name, count] of Object.entries(before.objects)) {
        const afterCount = after.objects[name] ?? 0;
        if (afterCount >= count && count > 0) {
            leaked.push({ name, before: count, after: afterCount });
        }
    }
    // New objects that appeared
    for (const [name, count] of Object.entries(after.objects)) {
        if (!(name in before.objects) && count > 0) {
            leaked.push({ name, before: 0, after: count });
        }
    }
    return leaked;
}
async function analyzeWithAI(before, after, event) {
    const apiKey = await getApiKey();
    if (!apiKey) {
        return {
            event,
            leaked_candidates: [],
            analysis: 'No API key configured',
            recommendations: ['Configure API key in extension popup'],
        };
    }
    const settings = await getStoredSettings();
    const diff = computeDiff(before, after);
    if (diff.length === 0) {
        return {
            event,
            leaked_candidates: [],
            analysis: 'No potential leaks detected',
            recommendations: [],
        };
    }
    const payload = { event, leaked_candidates: diff };
    try {
        const response = await fetch(settings.apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: JSON.stringify(payload) },
                ],
                response_format: { type: 'json_object' },
            }),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;
        const analysis = content ? JSON.parse(content) : {};
        return {
            event,
            leaked_candidates: diff,
            analysis: analysis.leaks?.join(', ') || 'Analysis complete',
            recommendations: analysis.recommendations || [],
        };
    }
    catch (error) {
        return {
            event,
            leaked_candidates: diff,
            analysis: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendations: ['Check API key and endpoint configuration'],
        };
    }
}
// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleMessage(msg, sendResponse);
    return true; // async response
});
async function handleMessage(msg, sendResponse) {
    switch (msg.type) {
        case 'GET_SETTINGS': {
            const settings = await getStoredSettings();
            sendResponse({ type: 'SETTINGS', payload: settings });
            break;
        }
        case 'SET_API_KEY': {
            await saveSettings({ apiKey: msg.payload });
            sendResponse({ type: 'OK', payload: null });
            break;
        }
        case 'GET_API_KEY': {
            const apiKey = await getApiKey();
            sendResponse({ type: 'API_KEY', payload: apiKey });
            break;
        }
        case 'CENSUS_UPDATE': {
            // Store latest census for comparison
            if (!beforeSnapshot) {
                beforeSnapshot = msg.payload;
            }
            sendResponse({ type: 'OK', payload: null });
            break;
        }
        case 'ANALYZE_DIFF': {
            const report = await analyzeWithAI(msg.payload.before, msg.payload.after, msg.payload.event);
            sendResponse({ type: 'ANALYSIS_RESULT', payload: report });
            break;
        }
        default:
            sendResponse({ type: 'ERROR', payload: 'Unknown message type' });
    }
}
// URL change handler - auto-trigger snapshot comparison
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === 'URL_CHANGED' && beforeSnapshot && !pendingAnalysis) {
        pendingAnalysis = true;
        // Wait 2s for page to stabilize, then request new snapshot
        setTimeout(async () => {
            if (sender.tab?.id) {
                chrome.tabs.sendMessage(sender.tab.id, { type: 'TAKE_SNAPSHOT' });
            }
        }, 2000);
    }
    if (msg.type === 'SNAPSHOT_TAKEN' && beforeSnapshot && pendingAnalysis) {
        const afterSnapshot = msg.payload;
        analyzeWithAI(beforeSnapshot, afterSnapshot, 'Route Change').then((report) => {
            if (sender.tab?.id) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'ANALYSIS_RESULT',
                    payload: report,
                });
            }
        });
        beforeSnapshot = afterSnapshot;
        pendingAnalysis = false;
    }
});
console.log('[Leak Hunter] Background service worker started');
