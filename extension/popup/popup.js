// Popup is a pure UI shell — all API calls live in background.js
// Popup polls job status on open and while running

const BACKEND = 'https://spectre-backend-60725814455.europe-west1.run.app'

let generatedCode = null
let currentMode = 'snapshot'
let isRecording = false
let recordingInterval = null
let pollInterval = null
let currentTabId = null

    // ── Init — check for in-progress or completed jobs on open ───────────────────
    ; (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        currentTabId = tab.id
        const job = await getJob(tab.id)

        // Check if recording was in progress when popup closed
        const recResult = await chrome.storage.local.get('recording_tab')
        const recordingTabId = recResult.recording_tab

        if (recordingTabId === tab.id) {
            // Restore recording UI
            isRecording = true
            switchMode('record')
            document.getElementById('btn-start-record').style.display = 'none'
            document.getElementById('btn-stop-record').style.display = 'block'
            document.getElementById('btn-discard').style.display = 'block'
            show('recording-status')

            // Show current count
            const states = await getSessionStates(tab.id)
            document.getElementById('rec-count').textContent = `${states.length} / 10`

            // Resume polling count
            recordingInterval = setInterval(async () => {
                const s = await getSessionStates(tab.id)
                document.getElementById('rec-count').textContent = `${s.length} / 10`
                if (s.length >= 10) stopAndGenerate(tab)
            }, 1000)
        } else if (job.status === 'running') {
            // Job was running when popup was closed — show loading and resume polling
            show('loading-box')
            setAllStepsVisible()
            startPolling(tab.id)
        } else if (job.status === 'done' && job.testCode) {
            // Job finished while popup was closed — show result immediately
            showResult(job.testCode)
            chrome.runtime.sendMessage({ type: 'CLEAR_JOB', tabId: tab.id })
        } else if (job.status === 'error') {
            setError(job.error)
            chrome.runtime.sendMessage({ type: 'CLEAR_JOB', tabId: tab.id })
        }
    })()

// ── Mode switch ───────────────────────────────────────────────────────────────
document.getElementById('tab-snapshot').addEventListener('click', () => switchMode('snapshot'))
document.getElementById('tab-record').addEventListener('click', () => switchMode('record'))

function switchMode(mode) {
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

function showStep(n) {
    document.getElementById(`step-${n}`)?.classList.add('visible')
}

function setAllStepsVisible() {
    for (let i = 1; i <= 5; i++) showStep(i)
}

function setError(msg) {
    const box = document.getElementById('error-box')
    box.textContent = '⚠ ' + msg
    show('error-box')
    hide('loading-box')
    stopPolling()
}

function showResult(code, tabId) {
    generatedCode = code
    document.getElementById('result-lines').textContent = `${code.split('\n').length} lines`
    hide('loading-box')
    show('result-box')
    show('btn-new-test-wrap')
    stopPolling()
    document.getElementById('btn-generate').disabled = false
    document.getElementById('btn-start-record').style.display = 'block'
    document.getElementById('btn-discard').style.display = 'none'

    // Wire New Test button with the correct tabId
    const btn = document.getElementById('btn-new-test')
    btn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'CLEAR_JOB', tabId: tabId || currentTabId })
        hide('result-box')
        hide('btn-new-test-wrap')
        generatedCode = null
    }
}

function resetSharedUI() {
    hide('loading-box')
    hide('result-box')
    hide('error-box')
    generatedCode = null
    stopPolling()
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`step-${i}`)?.classList.remove('visible')
    }
}

// ── Polling — popup checks job status every 2s ────────────────────────────────
function startPolling(tabId) {
    stopPolling()
    pollInterval = setInterval(async () => {
        const job = await getJob(tabId)
        if (job.status === 'done') {
            showResult(job.testCode, tabId)
        } else if (job.status === 'error') {
            setError(job.error)
            chrome.runtime.sendMessage({ type: 'CLEAR_JOB', tabId })
        }
        // If still 'running' — keep polling
    }, 2000)
}

function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

// ── Background message helpers ────────────────────────────────────────────────
function getJob(tabId) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_JOB', tabId }, resolve)
    })
}

function captureScreenshot() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, resolve)
    })
}

async function scrapeDom() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        return await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_DOM' })
    } catch { return null }
}

async function getNetworkLog(tabId) {
    try {
        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            tabId = tab.id
        }
        const result = await chrome.storage.local.get(`network_${tabId}`)
        return result[`network_${tabId}`] || []
    } catch { return [] }
}

async function getSessionStates(tabId) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_SESSION_STATES', tabId }, res => {
            resolve(res?.states || [])
        })
    })
}

// ── SNAPSHOT FLOW ─────────────────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', async () => {
    resetSharedUI()
    document.getElementById('btn-generate').disabled = true
    show('loading-box')

    // Show steps 1-4 immediately as we collect data
    showStep(1)
    const screenshot = await captureScreenshot()
    if (screenshot?.error) { setError('Screenshot failed: ' + screenshot.error); return }

    showStep(2)
    const domData = await scrapeDom()
    if (domData) document.getElementById('badge-dom').classList.add('active')

    showStep(3)
    const networkData = await getNetworkLog()
    if (networkData?.length > 0) document.getElementById('badge-network').classList.add('active')

    showStep(4)
    const config = {
        baseUrl: document.getElementById('snap-url').value || 'http://localhost:3000',
        focus: document.getElementById('snap-focus').value || '',
        notes: document.getElementById('snap-notes').value || '',
    }

    // Hand off to background — popup can close now
    showStep(5)
    chrome.runtime.sendMessage({
        type: 'START_GENERATE_SNAPSHOT',
        tabId: currentTabId,
        payload: {
            image: screenshot.base64,
            mimeType: screenshot.mimeType,
            dom: domData?.dom || null,
            meta: domData?.meta || null,
            network: networkData || [],
            config,
        }
    })

    // Start polling for result
    startPolling(currentTabId)
})

// ── RECORD FLOW ───────────────────────────────────────────────────────────────
document.getElementById('btn-start-record').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    currentTabId = tab.id

    chrome.runtime.sendMessage({ type: 'CLEAR_SESSION', tabId: tab.id })
    hide('session-summary')
    resetSharedUI()

    chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
            setError('Could not start recording. Try refreshing the page.')
            return
        }

        isRecording = true
        chrome.storage.local.set({ recording_tab: tab.id })
        document.getElementById('btn-start-record').style.display = 'none'
        document.getElementById('btn-stop-record').style.display = 'block'
        document.getElementById('btn-discard').style.display = 'block'
        show('recording-status')

        // Poll interaction count
        recordingInterval = setInterval(async () => {
            const states = await getSessionStates(tab.id)
            document.getElementById('rec-count').textContent = `${states.length} / 10`
            if (states.length >= 10) stopAndGenerate(tab)
        }, 1000)
    })
})

document.getElementById('btn-stop-record').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    stopAndGenerate(tab)
})

document.getElementById('btn-discard').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    clearInterval(recordingInterval)
    isRecording = false
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' })
    chrome.runtime.sendMessage({ type: 'CLEAR_SESSION', tabId: tab.id })
    chrome.storage.local.remove('recording_tab')
    document.getElementById('btn-start-record').style.display = 'block'
    document.getElementById('btn-stop-record').style.display = 'none'
    document.getElementById('btn-discard').style.display = 'none'
    hide('recording-status')
    hide('session-summary')
    resetSharedUI()
})

async function stopAndGenerate(tab) {
    clearInterval(recordingInterval)
    isRecording = false
    chrome.storage.local.remove('recording_tab')
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' })
    document.getElementById('btn-stop-record').style.display = 'none'
    hide('recording-status')

    const states = await getSessionStates(tab.id)

    if (states.length === 0) {
        setError('No interactions recorded. Try clicking around the page first.')
        document.getElementById('btn-start-record').style.display = 'block'
        document.getElementById('btn-discard').style.display = 'none'
        return
    }

    showSessionSummary(states)

    // Show loading
    resetSharedUI()
    show('loading-box')
    setAllStepsVisible()

    const networkData = await getNetworkLog(tab.id)
    const config = {
        baseUrl: document.getElementById('rec-url').value || 'http://localhost:3000',
        notes: document.getElementById('rec-notes').value || '',
    }

    // Hand off to background — popup can close now
    chrome.runtime.sendMessage({
        type: 'START_GENERATE_SESSION',
        tabId: tab.id,
        payload: { states, network: networkData, config }
    })

    startPolling(tab.id)
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
        detail.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px'
        div.appendChild(type); div.appendChild(detail)
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