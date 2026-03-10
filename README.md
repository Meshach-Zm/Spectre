# 👻 Spectre — Visual QA Agent

> Take a screenshot of any web app. Spectre analyses it with Gemini and generates a complete, production-ready Cypress test suite — instantly.

**Live demo:** <https://spectre-frontend-60725814455.europe-west1.run.app>

Built for the **Gemini Live Agent Challenge 2026** — UI Navigator category.

---

## What It Does

1. **Capture** — Upload a screenshot or capture your screen live
2. **Analyse** — Gemini 2.5 Flash reads the UI and identifies components, user journeys, and testable interactions
3. **Configure** — Set your base URL and focus area
4. **Generate** — Download a complete `.cy.js` Cypress test file with `cy.intercept()`, edge cases, and anti-flaky patterns built in

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Google Gemini 2.5 Flash (multimodal vision) |
| Agent SDK | Google GenAI SDK |
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Hosting | Google Cloud Run |
| Container | Docker |

---

## Running Locally

### Prerequisites

- Node.js 20+
- A Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### Backend

```bash
cd backend
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm install
npm start
# You should see: "Spectre backend running on port 8080" and "Gemini key loaded: YES"
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## Deploying to Google Cloud Run

Both services are configured for continuous deployment from GitHub via Cloud Build. Push to `main` and both frontend and backend redeploy automatically.

To deploy manually:

```bash
# Backend
gcloud run deploy spectre-backend \
  --source ./backend \
  --region europe-west1 \
  --set-env-vars GEMINI_API_KEY=your_key \
  --allow-unauthenticated

# Frontend
gcloud run deploy spectre-frontend \
  --source ./frontend \
  --region europe-west1 \
  --allow-unauthenticated
```

---

## How Spectre Uses Gemini

**Screenshot Analysis** — Gemini 2.5 Flash receives the screenshot as a base64 image and returns structured JSON identifying every UI component, user journey, API endpoint, and suggested test scenario.

**Test Generation** — A second Gemini call takes the analysis and generates a complete Cypress test file following production best practices — `cy.intercept()` with aliases, viewport tests, edge case coverage, and documented anti-flaky patterns.

**Conversational Follow-up** — A session-based chat allows you to ask Gemini questions about your app directly, with the screenshot as persistent visual context.

---

## Why This Matters

Writing tests is the most skipped step in software development because it's tedious and time-consuming. Spectre removes that friction entirely — you show it your app, it writes the tests. What used to take hours takes seconds.

---

*Built by Misheck Zimba for the Gemini Live Agent Challenge 2026*
