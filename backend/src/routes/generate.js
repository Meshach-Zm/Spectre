import express from 'express'
import { generateCypressTests } from '../services/gemini.js'

export const generateRoutes = express.Router()

function parseGeminiError(err) {
  const msg = err.message || ''
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return { code: 'INVALID_KEY', message: 'Your Gemini API key is invalid. Check your .env file.' }
  }
  if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
    return { code: 'RATE_LIMITED', message: 'Rate limit hit. The request will retry automatically — please wait a moment.' }
  }
  return { code: 'GEMINI_ERROR', message: 'Gemini API error. Please try again.' }
}

generateRoutes.post('/', async (req, res) => {
  try {
    const { analysis, userContext } = req.body
    if (!analysis) return res.status(400).json({ error: 'analysis is required' })

    console.log('Generating Cypress tests...')
    const testCode = await generateCypressTests(analysis, userContext || {})
    res.json({ success: true, testCode })

  } catch (err) {
    const parsed = parseGeminiError(err)
    console.error('Generate error:', parsed.code, '-', parsed.message)
    res.status(500).json({ error: parsed.message, code: parsed.code })
  }
})