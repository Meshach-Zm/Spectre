import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { analyzeRoutes } from './routes/analyze.js'
import { generateRoutes } from './routes/generate.js'
import { sessionRoutes } from './routes/session.js'

const app = express()
const PORT = process.env.PORT || 8080

const allowedOrigins = [
  'https://spectre-frontend-60725814455.europe-west1.run.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.use(express.json({ limit: '20mb' }))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'spectre-backend', version: '1.0.0' })
})

app.use('/api/analyze', analyzeRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/session', sessionRoutes)

app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Spectre backend running on port ${PORT}`)
  console.log(`Gemini key loaded: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`)
})