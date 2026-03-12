// Runs in the DevTools context — captures network requests per tab
const networkLog = {}

chrome.devtools.network.onRequestFinished.addListener((request) => {
    const tabId = chrome.devtools.inspectedWindow.tabId
    if (!networkLog[tabId]) networkLog[tabId] = []

    // Only capture XHR/fetch — skip images, fonts, CSS, JS files
    const type = request._resourceType
    if (!['xhr', 'fetch'].includes(type)) return

    const entry = {
        method: request.request.method,
        url: request.request.url,
        status: request.response.status,
        requestBody: null,
        responseBody: null,
        requestHeaders: {},
    }

    // Capture content-type header
    const contentType = request.request.headers.find(h => h.name.toLowerCase() === 'content-type')
    if (contentType) entry.requestHeaders['content-type'] = contentType.value

    // Capture request body
    if (request.request.postData) {
        entry.requestBody = request.request.postData.text || null
    }

    // Capture response body (async)
    request.getContent((content) => {
        entry.responseBody = content ? content.slice(0, 500) : null // cap at 500 chars to save tokens
        networkLog[tabId].push(entry)

        // Keep only last 50 requests per tab
        if (networkLog[tabId].length > 50) {
            networkLog[tabId] = networkLog[tabId].slice(-50)
        }

        // Store in extension storage so popup can read it
        chrome.storage.local.set({ [`network_${tabId}`]: networkLog[tabId] })
    })
})

// Clean up when tab is removed
chrome.tabs.onRemoved?.addListener?.((tabId) => {
    delete networkLog[tabId]
    chrome.storage.local.remove(`network_${tabId}`)
})