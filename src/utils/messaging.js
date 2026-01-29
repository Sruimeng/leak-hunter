export async function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
}
export async function getSettings() {
    const response = await sendMessage({ type: 'GET_SETTINGS', payload: null });
    if (response.type === 'SETTINGS')
        return response.payload;
    throw new Error('Failed to get settings');
}
export async function setApiKey(apiKey) {
    const response = await sendMessage({ type: 'SET_API_KEY', payload: apiKey });
    if (response.type !== 'OK')
        throw new Error('Failed to set API key');
}
