import express from 'express'
import { analyzeScreenshot } from '../services/gemini.js'

export const analyzeRoutes = express.Router()

function parseGeminiError(err) {
  const msg = err.message || ''
  if (msg.includes('404') || msg.includes('no longer available') || msg.includes('NOT_FOUND')) {
    return { code: 'MODEL_NOT_FOUND', message: 'Gemini model not available. Contact support.' }
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return { code: 'INVALID_KEY', message: 'Your Gemini API key is invalid. Check your .env file.' }
  }
  if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
    return { code: 'RATE_LIMITED', message: 'Rate limit hit. Please wait a moment and try again.' }
  }
  if (msg.includes('Failed to parse')) {
    return { code: 'PARSE_ERROR', message: 'Gemini returned an unexpected response. Try again.' }
  }
  return { code: 'GEMINI_ERROR', message: `Gemini error: ${msg.slice(0, 120)}` }
}

analyzeRoutes.post('/', async (req, res) => {
  try {
    const { image, mimeType } = req.body
    if (!image) return res.status(400).json({ error: 'image is required' })

    console.log('Analyzing screenshot...')
    const analysis = await analyzeScreenshot(image, mimeType || 'image/png')
    res.json({ success: true, analysis })

  }  catch (err) {
  console.error('RAW ERROR:', err.message)
  res.status(500).json({ error: err.message })
}
})