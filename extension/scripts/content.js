// ── Web app handshake ─────────────────────────────────────────────────────────
// Announce extension presence to the Spectre web app
function announceExtension() {
    window.postMessage({ type: 'SPECTRE_LENS_PRESENT', version: '1.0.0' }, '*')
}

// Announce on load and after a short delay (for SPAs that load async)
announceExtension()
setTimeout(announceExtension, 1000)

// Listen for web app pings (it may ask again after mounting)
window.addEventListener('message', (event) => {
    if (event.data?.type === 'SPECTRE_PING') {
        announceExtension()
    }
})

// content.js — DOM scraper + session recorder
// Injected into every page by the extension

// ── DOM Scraper (existing) ────────────────────────────────────────────────────
function scrapeDom() {
    const clone = document.body.cloneNode(true)

    const noiseSelectors = ['script', 'style', 'svg', 'noscript', 'link', 'meta', 'iframe']
    noiseSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove())
    })

    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))

    const KEEP_ATTRS = [
        'id', 'class', 'type', 'name', 'placeholder', 'href', 'action',
        'data-testid', 'data-cy', 'data-test', 'data-id', 'aria-label',
        'aria-role', 'role', 'for', 'value', 'checked', 'disabled',
        'required', 'pattern', 'min', 'max', 'method', 'enctype'
    ]

    clone.querySelectorAll('*').forEach(el => {
        const attrs = Array.from(el.attributes)
        attrs.forEach(attr => {
            if (!KEEP_ATTRS.includes(attr.name)) el.removeAttribute(attr.name)
        })
    })

    clone.querySelectorAll('ul, ol, tbody, [role="list"]').forEach(list => {
        const children = Array.from(list.children)
        if (children.length > 5) {
            children.slice(5).forEach(child => child.remove())
            const note = document.createElement('li')
            note.textContent = `... ${children.length - 5} more items`
            list.appendChild(note)
        }
    })

    return clone.innerHTML.replace(/\s+/g, ' ').replace(/> </g, '>\n<').trim().slice(0, 30000)
}

function getPageMeta() {
    return {
        url: window.location.href,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
    }
}

// ── Session Recording ─────────────────────────────────────────────────────────
let isRecording = false
let sessionActions = []
const MAX_INTERACTIONS = 10

// Significant state change triggers — these get a screenshot + DOM snapshot
const SIGNIFICANT_EVENTS = [
    'submit',       // form submissions
    'popstate',     // browser navigation
]

const SIGNIFICANT_SELECTORS = [
    'button',
    'a[href]',
    '[type="submit"]',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    'select',
]

function isSignificantClick(target) {
    return SIGNIFICANT_SELECTORS.some(sel => target.closest(sel))
}

function getSelector(el) {
    // Prefer test attributes
    if (el.dataset?.testid) return `[data-testid="${el.dataset.testid}"]`
    if (el.dataset?.cy) return `[data-cy="${el.dataset.cy}"]`
    if (el.dataset?.test) return `[data-test="${el.dataset.test}"]`
    // Then aria
    if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`
    // Then id
    if (el.id) return `#${el.id}`
    // Then type + text for buttons
    const tag = el.tagName.toLowerCase()
    const text = el.textContent?.trim().slice(0, 30)
    if (text) return `${tag}:contains("${text}")`
    // Fallback
    return tag
}

function getInputValue(el) {
    if (el.type === 'password') return '[REDACTED]'
    return el.value || ''
}

function recordAction(type, target, extra = {}) {
    if (!isRecording) return
    if (sessionActions.length >= MAX_INTERACTIONS) return

    const action = {
        type,
        selector: target ? getSelector(target) : null,
        tag: target?.tagName?.toLowerCase() || null,
        text: target?.textContent?.trim().slice(0, 60) || null,
        url: window.location.href,
        timestamp: Date.now(),
        ...extra,
    }

    sessionActions.push(action)

    // Notify background to take screenshot + DOM for significant events
    chrome.runtime.sendMessage({
        type: 'RECORD_STATE',
        action,
        dom: scrapeDom(),
        meta: getPageMeta(),
        actionIndex: sessionActions.length - 1,
    })
}

// ── Event listeners ───────────────────────────────────────────────────────────
function handleClick(e) {
    if (!isRecording) return
    const target = e.target
    if (!isSignificantClick(target)) return
    recordAction('click', target)
}

function handleInput(e) {
    if (!isRecording) return
    const target = e.target
    if (!['input', 'textarea', 'select'].includes(target.tagName?.toLowerCase())) return
    // Debounce — only record after user stops typing
    clearTimeout(target._spectreTimer)
    target._spectreTimer = setTimeout(() => {
        recordAction('type', target, { value: getInputValue(target) })
    }, 800)
}

function handleSubmit(e) {
    if (!isRecording) return
    recordAction('submit', e.target)
}

function handleNavigation() {
    if (!isRecording) return
    recordAction('navigate', null, { url: window.location.href })
}

// ── DOM mutation observer — detects modals, toasts, dropdowns opening ─────────
let mutationDebounce = null
const observer = new MutationObserver((mutations) => {
    if (!isRecording) return

    const significant = mutations.some(m => {
        return Array.from(m.addedNodes).some(node => {
            if (node.nodeType !== 1) return false
            const el = node
            // Check if it looks like a modal, toast, dropdown, or dialog
            const role = el.getAttribute?.('role')
            const classes = el.className?.toString() || ''
            return (
                role === 'dialog' ||
                role === 'alertdialog' ||
                role === 'tooltip' ||
                role === 'alert' ||
                classes.includes('modal') ||
                classes.includes('toast') ||
                classes.includes('dropdown') ||
                classes.includes('popover') ||
                classes.includes('notification') ||
                el.tagName === 'DIALOG'
            )
        })
    })

    if (significant) {
        clearTimeout(mutationDebounce)
        mutationDebounce = setTimeout(() => {
            recordAction('state_change', null, {
                reason: 'dom_mutation',
                url: window.location.href,
            })
        }, 300)
    }
})

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_DOM') {
        sendResponse({ dom: scrapeDom(), meta: getPageMeta() })
    }

    if (message.type === 'START_RECORDING') {
        isRecording = true
        sessionActions = []

        // Attach listeners
        document.addEventListener('click', handleClick, true)
        document.addEventListener('input', handleInput, true)
        document.addEventListener('submit', handleSubmit, true)
        window.addEventListener('popstate', handleNavigation)

        // Start mutation observer
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
        })

        // Capture initial state
        recordAction('page_load', null, { url: window.location.href })

        sendResponse({ success: true })
    }

    if (message.type === 'STOP_RECORDING') {
        isRecording = false

        // Remove listeners
        document.removeEventListener('click', handleClick, true)
        document.removeEventListener('input', handleInput, true)
        document.removeEventListener('submit', handleSubmit, true)
        window.removeEventListener('popstate', handleNavigation)
        observer.disconnect()

        sendResponse({ success: true, actionCount: sessionActions.length })
    }

    if (message.type === 'GET_SESSION') {
        sendResponse({ actions: sessionActions })
    }

    return true
})