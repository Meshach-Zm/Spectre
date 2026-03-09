import express from 'express'
import { askAboutScreenshot } from '../services/gemini.js'

export const sessionRoutes = express.Router()

// In-memory session store (replace with Redis for production)
const sessions = new Map()

// POST /api/session/start
// Body: { image: base64, mimeType: string }
sessionRoutes.post('/start', async (req, res) => {
  try {
    const { image, mimeType } = req.body
    if (!image) return res.status(400).json({ error: 'image is required' })

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`

    sessions.set(sessionId, {
      image,
      mimeType: mimeType || 'image/png',
      history: [],
      createdAt: Date.now()
    })

    res.json({ success: true, sessionId })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/session/:id/ask
// Body: { question: string }
sessionRoutes.post('/:id/ask', async (req, res) => {
  try {
    const session = sessions.get(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const { question } = req.body
    if (!question) return res.status(400).json({ error: 'question is required' })

    const answer = await askAboutScreenshot(
      session.image,
      question,
      session.history
    )

    // Store conversation history
    session.history.push(
      { role: 'user', content: question },
      { role: 'model', content: answer }
    )

    res.json({ success: true, answer })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/session/:id
sessionRoutes.delete('/:id', (req, res) => {
  sessions.delete(req.params.id)
  res.json({ success: true })
})
