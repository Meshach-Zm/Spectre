# 👻 Spectre — Visual QA Agent

> Show Spectre your web app. It analyses the UI with Gemini and generates a complete, production-ready Cypress test suite — instantly.

**Live demo:** <https://spectre-frontend-60725814455.europe-west1.run.app>

Built for the **Gemini Live Agent Challenge 2026** — UI Navigator category.

---

## What It Does

Spectre has two modes:

### Web App (Screenshot mode)

1. **Capture** — Upload a screenshot or capture your screen live
2. **Analyse** — Gemini 2.5 Flash reads the UI and identifies components, user journeys, and testable interactions
3. **Configure** — Set your base URL and focus area
4. **Generate** — Download a complete `.cy.js` Cypress test file with `cy.intercept()`, edge cases, and anti-flaky patterns built in

### Spectre Lens (Chrome Extension)

A companion extension that captures far richer context for more accurate tests:

- **Snapshot mode** — captures screenshot + real DOM tree + network requests in one click
- **Session Recording mode** — record yourself using the app, Gemini gets the full interaction sequence with DOM snapshots and network logs at each step

With the extension, generated tests use **real selectors** from the DOM (`data-testid`, `aria-label`, element IDs) and **exact API routes** from the network log instead of guessed ones — eliminating the two biggest sources of hallucination in AI-generated tests.

The web app detects the extension automatically and shows a **Start Recording** button inline when Spectre Lens is active.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Google Gemini 2.5 Flash (multimodal vision) |
| Agent SDK | Google GenAI SDK |
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Extension | Chrome Manifest V3 |
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

### Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Pin **Spectre Lens** to your toolbar
5. Open any web app and click the extension icon

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

**Test Generation (web app)** — A second Gemini call generates a complete Cypress test file with `cy.intercept()` aliases, viewport tests, edge case coverage, and anti-flaky patterns.

**Test Generation (extension)** — When DOM and network data are available, the prompt enforces strict rules: selectors must come from the real DOM tree, API routes must come from the captured network log. This eliminates selector and route hallucination entirely.

**Session Recording** — Gemini receives up to 10 recorded interaction states, each with a DOM snapshot, action metadata, and a screenshot. It reconstructs the full user journey and generates tests covering the happy path, error states, and edge cases — including auth `beforeEach` hooks if a login flow was recorded.

**Conversational Follow-up** — A session-based chat lets you ask Gemini questions about your app with the screenshot as persistent visual context.

---

## Why This Matters

Writing E2E tests is the most skipped step in software development — because it's tedious, time-consuming, and requires deep knowledge of the app's internals. Spectre removes that friction entirely.

With just a screenshot you get a working starting point in seconds. With the extension you get tests a senior QA engineer would write — real selectors, real routes, real edge cases. What used to take hours takes seconds.

---

## Project Structure

```
spectre/
├── Dockerfile                   ← Backend container
├── deploy.sh                    ← Manual deploy script
├── backend/
│   └── src/
│       ├── index.js             ← Express server + CORS
│       ├── routes/
│       │   ├── analyze.js           ← POST /api/analyze
│       │   ├── generate.js          ← POST /api/generate
│       │   ├── session.js           ← POST /api/session
│       │   ├── extension.js         ← POST /api/generate-from-extension
│       │   └── session-generate.js  ← POST /api/generate-from-session
│       └── services/
│           └── gemini.js        ← All Gemini prompt logic
├── frontend/
│   ├── Dockerfile               ← Frontend container (nginx)
│   ├── nginx.conf
│   ├── cloudbuild.frontend.yaml
│   └── src/
│       ├── App.jsx              ← 4-step UI + extension detection + recording
│       ├── CodeBlock.jsx        ← Syntax highlighted code viewer
│       ├── index.css
│       └── main.jsx
└── extension/                   ← Chrome Manifest V3
    ├── manifest.json
    ├── icons/
    ├── popup/
    │   ├── popup.html           ← Extension UI (snapshot + record tabs)
    │   └── popup.js             ← Delegates all API calls to background
    ├── scripts/
    │   ├── background.js        ← Owns all fetches, survives popup close
    │   └── content.js           ← DOM scraper + recorder + web app bridge
    └── devtools/
        ├── devtools.html
        └── devtools.js          ← Network request capture
```

---

*Built by Misheck Zimba for the Gemini Live Agent Challenge 2026*
