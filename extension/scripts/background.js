// Background service worker
// Handles screenshots for both single capture and session recording

const sessionStates = {} // tabId → array of { action, screenshot, dom, meta }

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Single screenshot capture (existing flow)
    if (message.type === 'CAPTURE_SCREENSHOT') {
        chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 90 }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message })
            } else {
                sendResponse({ base64: dataUrl.split(',')[1], mimeType: 'image/png' })
            }
        })
        return true
    }

    // Record a state during session recording — screenshot + DOM + action
    if (message.type === 'RECORD_STATE') {
        const tabId = sender.tab?.id
        if (!tabId) return

        if (!sessionStates[tabId]) sessionStates[tabId] = []

        // Only take screenshot for significant state changes (not every keystroke)
        const shouldScreenshot = [
            'page_load', 'click', 'submit', 'navigate', 'state_change'
        ].includes(message.action?.type)

        if (shouldScreenshot) {
            chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 80 }, (dataUrl) => {
                const screenshot = dataUrl ? dataUrl.split(',')[1] : null

                sessionStates[tabId].push({
                    action: message.action,
                    screenshot,
                    dom: message.dom,
                    meta: message.meta,
                    timestamp: Date.now(),
                })

                // Store in local storage so popup can read it
                chrome.storage.local.set({ [`session_${tabId}`]: sessionStates[tabId] })
            })
        } else {
            // No screenshot for type actions — just store DOM + action
            sessionStates[tabId].push({
                action: message.action,
                screenshot: null,
                dom: message.dom,
                meta: message.meta,
                timestamp: Date.now(),
            })
            chrome.storage.local.set({ [`session_${tabId}`]: sessionStates[tabId] })
        }

        return true
    }

    // Get the full session for a tab
    if (message.type === 'GET_SESSION_STATES') {
        const tabId = message.tabId
        chrome.storage.local.get(`session_${tabId}`, (result) => {
            sendResponse({ states: result[`session_${tabId}`] || [] })
        })
        return true
    }

    // Clear session for a tab
    if (message.type === 'CLEAR_SESSION') {
        const tabId = message.tabId
        delete sessionStates[tabId]
        chrome.storage.local.remove(`session_${tabId}`)
        sendResponse({ success: true })
        return true
    }
})