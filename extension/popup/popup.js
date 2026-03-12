const BACKEND = 'https://spectre-backend-60725814455.europe-west1.run.app'

let generatedCode = null

// ── UI helpers ────────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).classList.add('visible') }
function hide(id) { document.getElementById(id).classList.remove('visible') }
function showStep(n) { document.getElementById(`step-${n}`).classList.add('visible') }

function setError(msg) {
    const box = document.getElementById('error-box')
    box.textContent = '⚠ ' + msg
    show('error-box')
}

function setDisabled(disabled) {
    document.getElementById('btn-generate').disabled = disabled
}

function resetUI() {
    hide('loading-box')
    hide('result-box')
    hide('error-box')
    generatedCode = null
    document.getElementById('badge-dom').classList.remove('active')
    document.getElementById('badge-network').classList.remove('active')
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`step-${i}`).classList.remove('visible')
    }
}

// ── Main flow ─────────────────────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', async () => {
    resetUI()
    setDisabled(true)
    show('loading-box')

    try {
        // ── Step 1: Screenshot ──────────────────────────────────────────────────
        showStep(1)
        const screenshot = await captureScreenshot()
        if (screenshot.error) throw new Error('Screenshot failed: ' + screenshot.error)

        // ── Step 2: DOM ─────────────────────────────────────────────────────────
        showStep(2)
        const domData = await scrapeDom()
        if (domData) {
            document.getElementById('badge-dom').classList.add('active')
        }

        // ── Step 3: Network ─────────────────────────────────────────────────────
        showStep(3)
        const networkData = await getNetworkLog()
        if (networkData && networkData.length > 0) {
            document.getElementById('badge-network').classList.add('active')
        }

        // ── Step 4: Send to backend ─────────────────────────────────────────────
        showStep(4)
        const config = {
            baseUrl: document.getElementById('input-url').value || 'http://localhost:3000',
            focus: document.getElementById('input-focus').value || '',
            notes: document.getElementById('input-notes').value || '',
        }

        showStep(5)
        const result = await generateTests({
            screenshot,
            dom: domData,
            network: networkData,
            config,
        })

        // ── Done ────────────────────────────────────────────────────────────────
        generatedCode = result.testCode
        const lineCount = generatedCode.split('\n').length
        document.getElementById('result-lines').textContent = `${lineCount} lines`

        hide('loading-box')
        show('result-box')

    } catch (err) {
        hide('loading-box')
        setError(err.message)
    } finally {
        setDisabled(false)
    }
})

// ── Screenshot ────────────────────────────────────────────────────────────────
function captureScreenshot() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
            resolve(response || { error: 'No response from background' })
        })
    })
}

// ── DOM scrape ────────────────────────────────────────────────────────────────
async function scrapeDom() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_DOM' })
        return response || null
    } catch {
        return null // graceful fallback — DOM not available
    }
}

// ── Network log ───────────────────────────────────────────────────────────────
async function getNetworkLog() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const key = `network_${tab.id}`
        const result = await chrome.storage.local.get(key)
        return result[key] || []
    } catch {
        return []
    }
}

// ── Generate tests ────────────────────────────────────────────────────────────
async function generateTests({ screenshot, dom, network, config }) {
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

    const text = await res.text()
    if (!text) throw new Error('Empty response from server')

    const data = JSON.parse(text)
    if (!data.success) throw new Error(data.error || 'Generation failed')
    return data
}

// ── Copy ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-copy').addEventListener('click', () => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode).then(() => {
        const btn = document.getElementById('btn-copy')
        btn.textContent = '✓ copied'
        btn.classList.add('copied')
        setTimeout(() => {
            btn.textContent = 'copy'
            btn.classList.remove('copied')
        }, 2000)
    })
})

// ── Download ──────────────────────────────────────────────────────────────────
document.getElementById('btn-download').addEventListener('click', () => {
    if (!generatedCode) return
    const blob = new Blob([generatedCode], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), {
        href: url,
        download: 'spectre.cy.js'
    })
    a.click()
    URL.revokeObjectURL(url)
})