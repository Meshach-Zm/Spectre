// Background service worker
// Owns ALL network requests — they survive popup close
// Popup is just a UI shell that reads state from storage

const BACKEND = 'https://spectre-backend-60725814455.europe-west1.run.app'
const sessionStates = {}

// ── Job state helpers ─────────────────────────────────────────────────────────
async function setJob(tabId, data) {
    await chrome.storage.local.set({ [`job_${tabId}`]: data })
}

async function getJob(tabId) {
    const result = await chrome.storage.local.get(`job_${tabId}`)
    return result[`job_${tabId}`] || { status: 'idle' }
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Screenshot
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

    // Record state during session
    if (message.type === 'RECORD_STATE') {
        const tabId = sender.tab?.id
        if (!tabId) return
        if (!sessionStates[tabId]) sessionStates[tabId] = []

        const shouldScreenshot = ['page_load', 'click', 'submit', 'navigate', 'state_change']
            .includes(message.action?.type)

        if (shouldScreenshot) {
            chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 80 }, (dataUrl) => {
                sessionStates[tabId].push({
                    action: message.action,
                    screenshot: dataUrl ? dataUrl.split(',')[1] : null,
                    dom: message.dom,
                    meta: message.meta,
                    timestamp: Date.now(),
                })
                chrome.storage.local.set({ [`session_${tabId}`]: sessionStates[tabId] })
            })
        } else {
            sessionStates[tabId].push({
                action: message.action, screenshot: null,
                dom: message.dom, meta: message.meta, timestamp: Date.now(),
            })
            chrome.storage.local.set({ [`session_${tabId}`]: sessionStates[tabId] })
        }
        return true
    }

    // Get session states
    if (message.type === 'GET_SESSION_STATES') {
        chrome.storage.local.get(`session_${message.tabId}`, (result) => {
            sendResponse({ states: result[`session_${message.tabId}`] || [] })
        })
        return true
    }

    // Clear session + job
    if (message.type === 'CLEAR_SESSION') {
        const tabId = message.tabId
        delete sessionStates[tabId]
        chrome.storage.local.remove([`session_${tabId}`, `job_${tabId}`])
        sendResponse({ success: true })
        return true
    }

    // Popup polls this on open to check if a job is running or done
    if (message.type === 'GET_JOB') {
        getJob(message.tabId).then(job => sendResponse(job))
        return true
    }

    // Clear job after popup reads the result
    if (message.type === 'CLEAR_JOB') {
        chrome.storage.local.remove(`job_${message.tabId}`)
        sendResponse({ success: true })
        return true
    }

    // ── Generate from snapshot — runs in background, survives popup close ──────
    if (message.type === 'START_GENERATE_SNAPSHOT') {
        const { tabId, payload } = message
        setJob(tabId, { status: 'running', startedAt: Date.now() })

            ; (async () => {
                try {
                    const res = await fetch(`${BACKEND}/api/generate-from-extension`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    const data = await res.json()
                    if (!data.success) throw new Error(data.error || 'Generation failed')
                    await setJob(tabId, { status: 'done', testCode: data.testCode })
                } catch (err) {
                    await setJob(tabId, { status: 'error', error: err.message })
                }
            })()

        sendResponse({ started: true })
        return true
    }

    // ── Generate from session — runs in background, survives popup close ───────
    if (message.type === 'START_GENERATE_SESSION') {
        const { tabId, payload } = message
        setJob(tabId, { status: 'running', startedAt: Date.now() })

            ; (async () => {
                try {
                    const res = await fetch(`${BACKEND}/api/generate-from-session`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    const data = await res.json()
                    if (!data.success) throw new Error(data.error || 'Generation failed')
                    await setJob(tabId, { status: 'done', testCode: data.testCode })
                } catch (err) {
                    await setJob(tabId, { status: 'error', error: err.message })
                }
            })()

        sendResponse({ started: true })
        return true
    }
})