import express from 'express'
import { generateFromExtension } from '../services/gemini.js'

export const extensionRoutes = express.Router()

extensionRoutes.post('/', async (req, res) => {
    try {
        const { image, mimeType, dom, meta, network, config } = req.body

        if (!image) return res.status(400).json({ success: false, error: 'No image provided' })

        const testCode = await generateFromExtension({ image, mimeType, dom, meta, network, config })

        res.json({ success: true, testCode })
    } catch (err) {
        console.error('Extension generate error:', err.message)

        if (err.status === 429) return res.status(429).json({ success: false, error: 'Rate limit hit — try again in 30 seconds' })
        if (err.status === 404) return res.status(500).json({ success: false, error: 'Model not available' })
        if (err.message?.includes('API_KEY_INVALID')) return res.status(401).json({ success: false, error: 'API key invalid' })

        res.status(500).json({ success: false, error: err.message || 'Generation failed' })
    }
})