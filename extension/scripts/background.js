// Background service worker — handles screenshot capture
// (content scripts can't access captureVisibleTab)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CAPTURE_SCREENSHOT') {
        chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 95 }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message })
            } else {
                // Strip the data:image/png;base64, prefix
                const base64 = dataUrl.split(',')[1]
                sendResponse({ base64, mimeType: 'image/png' })
            }
        })
        return true // keep channel open for async response
    }
})