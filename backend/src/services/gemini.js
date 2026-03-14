import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Analyze a screenshot and extract UI components and interactions
export async function analyzeScreenshot(base64Image, mimeType = 'image/png') {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a QA automation expert analyzing a web application screenshot.

Analyze this screenshot and return a JSON object with the following structure:
{
  "appType": "brief description of what this app appears to be",
  "components": [
    {
      "type": "button|input|form|card|table|modal|nav|list|other",
      "label": "visible text or aria label",
      "purpose": "what this component does",
      "selector": "suggested data-cy or CSS selector",
      "testable": true
    }
  ],
  "userJourneys": [
    {
      "name": "journey name",
      "steps": ["step 1", "step 2", "step 3"],
      "edgeCases": ["edge case 1", "edge case 2"]
    }
  ],
  "apiEndpoints": [
    {
      "method": "GET|POST|PUT|DELETE",
      "path": "/api/something",
      "purpose": "what this endpoint does"
    }
  ],
  "suggestedTests": [
    {
      "title": "test description",
      "type": "happy-path|error-case|edge-case|ui-state",
      "priority": "high|medium|low"
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanation.`

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Image
      }
    }
  ])

  const text = result.response.text().trim()
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('Failed to parse Gemini analysis response')
  }
}

// Generate Cypress test suite from analysis + user context
export async function generateCypressTests(analysis, userContext = {}) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a senior QA automation engineer. Generate a complete, production-ready Cypress test suite.

App Analysis:
${JSON.stringify(analysis, null, 2)}

User Context:
- App URL: ${userContext.baseUrl || 'http://localhost:3000'}
- Specific focus: ${userContext.focus || 'all user journeys'}
- Framework: ${userContext.framework || 'standard web app'}
- Additional notes: ${userContext.notes || 'none'}

Generate a complete Cypress test file following these rules:
1. Use cy.intercept() with aliases for ALL API calls — NEVER use cy.wait(milliseconds)
2. Always use cy.wait('@aliasName') to wait for network events
3. Use data-cy selectors where possible, fall back to semantic selectors
4. Cover happy path, error states (500, 404), and edge cases
5. Include descriptive comments explaining WHY each test matters
6. Handle shadow DOM with .shadow() if web components are present
7. Each test must be independent — no shared state between tests
8. Include a comment block explaining the flaky test anti-pattern and how you avoid it

Return ONLY the complete JavaScript test file content. No markdown code blocks, no explanation. Just the raw .cy.js file content starting with // and the describe block.`

  const result = await model.generateContent(prompt)
  return result.response.text().trim().replace(/```javascript|```js|```/g, '').trim()
}

// Analyze screenshot and answer a follow-up question about it
export async function askAboutScreenshot(base64Image, question, conversationHistory = []) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const history = conversationHistory.map(turn => ({
    role: turn.role,
    parts: [{ text: turn.content }]
  }))

  const chat = model.startChat({ history })

  const result = await chat.sendMessage([
    `You are a QA automation expert. Answer this question about the web app in the screenshot: ${question}`,
    { inlineData: { mimeType: 'image/png', data: base64Image } }
  ])

  return result.response.text()
}

// Generate tests from full extension payload (screenshot + DOM + network)
export async function generateFromExtension({ image, mimeType, dom, meta, network, config }) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const hasDom = dom && dom.length > 0
  const hasNetwork = network && network.length > 0

  // Build network summary for the prompt
  const networkSummary = hasNetwork
    ? network.slice(0, 30).map(r => `${r.method} ${r.url} → ${r.status}`).join('\n')
    : null

  const prompt = `You are a senior QA automation engineer. Generate a complete, production-ready Cypress test suite.

## Instructions
${hasDom ? '- You have been provided with the real DOM tree. You MUST ONLY use selectors found in this DOM. Do not guess or invent selectors.' : '- No DOM provided. Use semantic selectors based on the screenshot.'}
${hasNetwork ? '- You have been provided with real network requests. You MUST ONLY use these exact endpoints in cy.intercept() calls. Do not guess or invent routes.' : '- No network log provided. Infer likely routes from the UI context.'}

## App Context
- URL: ${config?.baseUrl || meta?.url || 'http://localhost:3000'}
- Page title: ${meta?.title || 'Unknown'}
- Focus area: ${config?.focus || 'all user journeys'}
- Notes: ${config?.notes || 'none'}

${hasDom ? `## DOM Tree (real — use ONLY these selectors)\n\`\`\`html\n${dom.slice(0, 40000)}\n\`\`\`` : ''}

${hasNetwork ? `## Network Requests (real — use ONLY these routes in cy.intercept())\n${networkSummary}` : ''}

## Rules
1. Use cy.intercept() with aliases for ALL API calls — NEVER cy.wait(milliseconds)
2. Always cy.wait('@aliasName') after triggering a network event
3. ${hasDom ? 'Use data-testid or data-cy selectors from the DOM above — prefer these over class or tag selectors' : 'Use semantic selectors (role, label, placeholder)'}
4. Cover: happy path, 500 error, 404 error, empty state, viewport (desktop + mobile)
5. Each test must be fully independent — beforeEach resets state
6. Add a beforeEach auth block if the page appears to require authentication
7. Add WHY THIS TEST MATTERS comment on each test
8. Include anti-flaky pattern comment block at the top

Return ONLY the raw .cy.js file content. No markdown, no code fences, no explanation.`

  const parts = [
    prompt,
    { inlineData: { mimeType: mimeType || 'image/png', data: image } }
  ]

  const result = await model.generateContent(parts)
  return result.response.text().trim().replace(/```javascript|```js|```/g, '').trim()
}

// Generate tests from a full recorded session (multiple states)
export async function generateFromSession({ states, network, config }) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const sessionNarrative = states.map((state, i) => {
    const action = state.action
    const lines = [`## State ${i + 1}: ${action?.type || 'unknown'}`]
    if (action?.url) lines.push(`URL: ${action.url}`)
    if (action?.selector) lines.push(`Element: ${action.selector}`)
    if (action?.text) lines.push(`Text: ${action.text}`)
    if (action?.value) lines.push(`Value: ${action.value}`)
    if (state.dom) lines.push(`DOM snapshot:\n${state.dom.slice(0, 8000)}`)
    return lines.join('\n')
  }).join('\n\n---\n\n')

  const networkSummary = network?.length > 0
    ? network.slice(0, 30).map(r => {
      let line = `${r.method} ${r.url} → ${r.status}`
      if (r.requestBody) line += `\n  Request: ${r.requestBody.slice(0, 200)}`
      if (r.responseBody) line += `\n  Response: ${r.responseBody.slice(0, 200)}`
      return line
    }).join('\n')
    : null

  const prompt = `You are a senior QA automation engineer. Generate a complete, production-ready Cypress test suite from a recorded user session.

## Instructions
- Use the DOM snapshots to extract REAL selectors — prefer data-testid, data-cy, aria-label, then id
- Use the network log to write EXACT cy.intercept() calls with real URLs and methods
- Reconstruct the full user journey from the recorded states
- Generate tests for: happy path (what the user did), error states (500, 404), edge cases, viewport variations (desktop + mobile)
- Each test must be fully independent with its own beforeEach
- If you see a login flow in the states, generate a reusable beforeEach auth block
- Add WHY THIS TEST MATTERS on each test
- Include anti-flaky pattern comment block at the top

## App context
- Base URL: ${config?.baseUrl || 'http://localhost:3000'}
- Notes: ${config?.notes || 'none'}

## Recorded session (${states.length} states)
${sessionNarrative}

${networkSummary ? `## Network requests\n${networkSummary}` : ''}

Return ONLY the raw .cy.js file. No markdown, no code fences, no explanation.`

  // Include up to 3 screenshots as multimodal context
  const parts = [prompt]
  const screenshots = states.filter(s => s.screenshot).slice(0, 3)
  screenshots.forEach((state, i) => {
    parts.push(`\n[Screenshot ${i + 1} — after: ${state.action?.type} on ${state.action?.selector || state.action?.url}]`)
    parts.push({ inlineData: { mimeType: 'image/png', data: state.screenshot } })
  })

  const result = await model.generateContent(parts)
  return result.response.text().trim().replace(/```javascript|```js|```/g, '').trim()
}