# 👻 Spectre — Visual QA Agent

> Take a screenshot of any web app. Spectre analyses it with Gemini and generates a complete, production-ready Cypress test suite — instantly.

Built for the **Gemini Live Agent Challenge** — UI Navigator category.

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
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>

---

## Reproducing the Demo (For Judges)

Follow these steps to see Spectre working end-to-end:

1. **Clone the repo and start the backend:**

```bash
git clone <repo-url>
cd spectre/backend
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm install
npm start
# You should see: "Spectre backend running on port 8080" and "Gemini key loaded: YES"
```

1. **Start the frontend:**

```bash
cd ../frontend
npm install
npm run dev
# Open http://localhost:5173
```

1. **Run a test generation:**
   - Click **Upload a screenshot** and select any web app screenshot (or use the sample in `/samples/`)
   - Click **Analyse Screenshot**
   - Review the detected components and user journeys
   - Click **⚡ Generate Cypress Tests**
   - Download the `.cy.js` file

2. **Verify the output runs:**

```bash
# In any existing Cypress project:
cp spectre.cy.js cypress/e2e/
npx cypress run --spec cypress/e2e/spectre.cy.js
```

---

## Deploying to Google Cloud Run

```bash
chmod +x deploy.sh
./deploy.sh YOUR_GCP_PROJECT_ID YOUR_GEMINI_API_KEY
```

Then set `VITE_BACKEND_URL` in your frontend environment to the Cloud Run URL and deploy the frontend to Firebase Hosting or Cloud Run.

---

## How Spectre Uses Gemini

**Screenshot Analysis** — Gemini 2.5 Flash receives the screenshot as a base64 image and returns structured JSON identifying every UI component, user journey, API endpoint, and suggested test scenario.

**Test Generation** — A second Gemini call takes the analysis and generates a complete Cypress test file following production best practices — `cy.intercept()` with aliases, shadow DOM handling, edge case coverage, and documented anti-flaky patterns.

**Conversational Follow-up** — A session-based chat allows users to ask Gemini questions about their app directly, with the screenshot as persistent visual context.

---

## Why This Matters

Writing tests is the most skipped step in software development because it's tedious and time-consuming. Spectre removes that friction entirely — you show it your app, it writes the tests. What used to take hours takes seconds.

---

*Built by Misheck Zimba for the Gemini Live Agent Challenge 2026*
