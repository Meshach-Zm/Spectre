const BACKEND = 'https://spectre-backend-60725814455.europe-west1.run.app'

let generatedCode = null
let currentMode = 'snapshot'
let isRecording = false
let recordingInterval = null

// ── Mode switch ───────────────────────────────────────────────────────────────
window.switchMode = function (mode) {
    currentMode = mode
    document.getElementById('tab-snapshot').classList.toggle('active', mode === 'snapshot')
    document.getElementById('tab-record').classList.toggle('active', mode === 'record')
    document.getElementById('panel-snapshot').classList.toggle('active', mode === 'snapshot')
    document.getElementById('panel-record').classList.toggle('active', mode === 'record')
    resetSharedUI()
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id)?.classList.add('visible') }
function hide(id) { document.getElementById(id)?.classList.remove('visible') }
function showStep(n, text) {
    const el = document.getElementById(`step-${n}`)
    el?.classList.add('visible')
    const textEl = document.getElementById(`step-${n}-text`)
    if (textEl && text) textEl.textContent = text
}

function setError(msg) {
    const box = document.getElementById('error-box')
    box.textContent = '⚠ ' + msg
    show('error-box')
}

function resetSharedUI() {
    hide('loading-box')
    hide('result-box')
    hide('error-box')
    generatedCode = null
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`step-${i}`)?.classList.remove('visible')
    }
}

// ── SNAPSHOT FLOW ─────────────────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', async () => {
    resetSharedUI()
    document.getElementById('btn-generate').disabled = true
    show('loading-box')

    try {
        showStep(1, 'Capturing screenshot...')
        const screenshot = await captureScreenshot()
        if (screenshot.error) throw new Error('Screenshot failed: ' + screenshot.error)

        showStep(2, 'Scraping DOM tree...')
        const domData = await scrapeDom()
        if (domData) document.getElementById('badge-dom').classList.add('active')

        showStep(3, 'Reading network requests...')
        const networkData = await getNetworkLog()
        if (networkData?.length > 0) document.getElementById('badge-network').classList.add('active')

        showStep(4, 'Sending to Gemini...')
        const config = {
            baseUrl: document.getElementById('snap-url').value || 'http://localhost:3000',
            focus: document.getElementById('snap-focus').value || '',
            notes: document.getElementById('snap-notes').value || '',
        }

        showStep(5)
        const result = await generateFromSnapshot({ screenshot, dom: domData, network: networkData, config })

        generatedCode = result.testCode
        document.getElementById('result-lines').textContent = `${generatedCode.split('\n').length} lines`
        hide('loading-box')
        show('result-box')

    } catch (err) {
        hide('loading-box')
        setError(err.message)
    } finally {
        document.getElementById('btn-generate').disabled = false
    }
})

// ── RECORD FLOW ───────────────────────────────────────────────────────────────
document.getElementById('btn-start-record').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Clear previous session
    chrome.runtime.sendMessage({ type: 'CLEAR_SESSION', tabId: tab.id })
    hide('session-summary')
    resetSharedUI()

    // Tell content script to start recording
    chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
            setError('Could not start recording. Try refreshing the page.')
            return
        }

        isRecording = true
        document.getElementById('btn-start-record').style.display = 'none'
        document.getElementById('btn-stop-record').style.display = 'block'
        document.getElementById('btn-discard').style.display = 'block'
        show('recording-status')

        // Poll interaction count every second
        recordingInterval = setInterval(async () => {
            const states = await getSessionStates(tab.id)
            const count = states.length
            document.getElementById('rec-count').textContent = `${count} / 10`

            // Auto-stop at limit
            if (count >= 10) stopRecording(tab)
        }, 1000)
    })
})

document.getElementById('btn-stop-record').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    stopRecording(tab)
})

document.getElementById('btn-discard').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    clearInterval(recordingInterval)
    isRecording = false

    chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' })
    chrome.runtime.sendMessage({ type: 'CLEAR_SESSION', tabId: tab.id })

    document.getElementById('btn-start-record').style.display = 'block'
    document.getElementById('btn-stop-record').style.display = 'none'
    document.getElementById('btn-discard').style.display = 'none'
    hide('recording-status')
    hide('session-summary')
    resetSharedUI()
})

async function stopRecording(tab) {
    clearInterval(recordingInterval)
    isRecording = false

    // Stop recording in content script
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' })

    document.getElementById('btn-stop-record').style.display = 'none'
    hide('recording-status')

    // Get the full session
    const states = await getSessionStates(tab.id)

    if (states.length === 0) {
        setError('No interactions recorded. Try clicking around the page first.')
        document.getElementById('btn-start-record').style.display = 'block'
        document.getElementById('btn-discard').style.display = 'none'
        return
    }

    // Show session summary
    showSessionSummary(states)

    // Start generating
    await generateFromSession(tab, states)
}

function showSessionSummary(states) {
    const list = document.getElementById('session-actions-list')
    list.innerHTML = ''

    states.slice(0, 6).forEach(state => {
        const div = document.createElement('div')
        div.className = 'session-action'

        const type = document.createElement('span')
        type.className = 'action-type'
        type.textContent = state.action?.type || 'unknown'

        const detail = document.createElement('span')
        detail.textContent = state.action?.text || state.action?.url?.replace(/^https?:\/\/[^/]+/, '') || '—'
        detail.style.overflow = 'hidden'
        detail.style.textOverflow = 'ellipsis'
        detail.style.whiteSpace = 'nowrap'
        detail.style.maxWidth = '180px'

        div.appendChild(type)
        div.appendChild(detail)
        list.appendChild(div)
    })

    if (states.length > 6) {
        const more = document.createElement('div')
        more.className = 'session-action'
        more.style.color = '#444'
        more.textContent = `+ ${states.length - 6} more interactions`
        list.appendChild(more)
    }

    show('session-summary')
}

async function generateFromSession(tab, states) {
    resetSharedUI()
    show('loading-box')

    try {
        showStep(1, `Processing ${states.length} recorded states...`)
        showStep(2, 'Analysing DOM snapshots...')

        const networkData = await getNetworkLog(tab.id)

        showStep(3, 'Reading captured network requests...')
        showStep(4, 'Sending session to Gemini...')

        const config = {
            baseUrl: document.getElementById('rec-url').value || 'http://localhost:3000',
            notes: document.getElementById('rec-notes').value || '',
        }

        showStep(5)
        const result = await generateFromSessionAPI({ states, network: networkData, config })

        generatedCode = result.testCode
        document.getElementById('result-lines').textContent = `${generatedCode.split('\n').length} lines`
        hide('loading-box')
        show('result-box')

        // Reset record UI
        document.getElementById('btn-start-record').style.display = 'block'
        document.getElementById('btn-discard').style.display = 'none'

    } catch (err) {
        hide('loading-box')
        setError(err.message)
        document.getElementById('btn-start-record').style.display = 'block'
        document.getElementById('btn-discard').style.display = 'none'
    }
}

// ── API calls ─────────────────────────────────────────────────────────────────
function captureScreenshot() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
            resolve(response || { error: 'No response from background' })
        })
    })
}

async function scrapeDom() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_DOM' })
        return response || null
    } catch { return null }
}

async function getNetworkLog(tabId) {
    try {
        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            tabId = tab.id
        }
        const key = `network_${tabId}`
        const result = await chrome.storage.local.get(key)
        return result[key] || []
    } catch { return [] }
}

async function getSessionStates(tabId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_SESSION_STATES', tabId }, (response) => {
            resolve(response?.states || [])
        })
    })
}

async function generateFromSnapshot({ screenshot, dom, network, config }) {
    const res = await fetch(`${BACKEND}/api/generate-from-extension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: screenshot.base64,
            mimeType: screenshot.mimeType,
            dom: dom?.dom || null,
            meta: dom?.meta || null,
            network: network || [],
            config,
        })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Generation failed')
    return data
}

async function generateFromSessionAPI({ states, network, config }) {
    const res = await fetch(`${BACKEND}/api/generate-from-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ states, network, config })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Generation failed')
    return data
}

// ── Copy & Download ───────────────────────────────────────────────────────────
document.getElementById('btn-copy').addEventListener('click', () => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode).then(() => {
        const btn = document.getElementById('btn-copy')
        btn.textContent = '✓ copied'
        btn.classList.add('copied')
        setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied') }, 2000)
    })
})

document.getElementById('btn-download').addEventListener('click', () => {
    if (!generatedCode) return
    const blob = new Blob([generatedCode], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'spectre.cy.js' }).click()
    URL.revokeObjectURL(url)
})