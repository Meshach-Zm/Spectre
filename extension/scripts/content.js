// Injected into the active tab — scrapes a clean DOM snapshot
// Strips noise, keeps interactive elements + data attributes

function scrapeDom() {
    // Clone the body so we don't mutate the real page
    const clone = document.body.cloneNode(true)

    // Remove noise elements
    const noiseSelectors = ['script', 'style', 'svg', 'noscript', 'link', 'meta', 'iframe']
    noiseSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove())
    })

    // Strip all inline styles to save tokens
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))

    // Extract only meaningful attributes from each element
    const KEEP_ATTRS = [
        'id', 'class', 'type', 'name', 'placeholder', 'href', 'action',
        'data-testid', 'data-cy', 'data-test', 'data-id', 'aria-label',
        'aria-role', 'role', 'for', 'value', 'checked', 'disabled',
        'required', 'pattern', 'min', 'max', 'method', 'enctype'
    ]

    clone.querySelectorAll('*').forEach(el => {
        // Remove all attributes not in our keep list
        const attrs = Array.from(el.attributes)
        attrs.forEach(attr => {
            if (!KEEP_ATTRS.includes(attr.name)) {
                el.removeAttribute(attr.name)
            }
        })
    })

    // Truncate large repeating lists (e.g. 200-row tables) — keep first 5 items
    clone.querySelectorAll('ul, ol, tbody, [role="list"]').forEach(list => {
        const children = Array.from(list.children)
        if (children.length > 5) {
            children.slice(5).forEach(child => child.remove())
            const truncNote = document.createElement('li')
            truncNote.textContent = `... ${children.length - 5} more items`
            list.appendChild(truncNote)
        }
    })

    // Build a clean text representation
    const html = clone.innerHTML
        .replace(/\s+/g, ' ')         // collapse whitespace
        .replace(/> </g, '>\n<')      // one element per line
        .trim()

    // Cap at ~50k chars to stay within token budget
    return html.slice(0, 50000)
}

// Extract page metadata
function getPageMeta() {
    return {
        url: window.location.href,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_DOM') {
        sendResponse({
            dom: scrapeDom(),
            meta: getPageMeta(),
        })
    }
    return true // keep channel open for async
})