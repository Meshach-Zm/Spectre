import express from 'express'
import { generateFromSession } from '../services/gemini.js'

export const sessionGenerateRoutes = express.Router()

sessionGenerateRoutes.post('/', async (req, res) => {
    try {
        const { states, network, config } = req.body

        if (!states || states.length === 0) {
            return res.status(400).json({ success: false, error: 'No session states provided' })
        }

        const testCode = await generateFromSession({ states, network, config })
        res.json({ success: true, testCode })

    } catch (err) {
        console.error('Session generate error:', err.message)
        if (err.status === 429) return res.status(429).json({ success: false, error: 'Rate limit hit — try again in 30 seconds' })
        res.status(500).json({ success: false, error: err.message || 'Generation failed' })
    }
})