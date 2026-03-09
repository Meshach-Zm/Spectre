import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { analyzeRoutes } from './routes/analyze.js'
import { generateRoutes } from './routes/generate.js'
import { sessionRoutes } from './routes/session.js'

const app = express()
const PORT = process.env.PORT || 8080

app.use(cors())
app.use(express.json({ limit: '20mb' }))

// Health check — required for Cloud Run
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
})