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
