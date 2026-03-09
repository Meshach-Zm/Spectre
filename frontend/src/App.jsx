import { useState, useRef, useCallback } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Capture', 'Analyse', 'Configure', 'Generate']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 20,
            background: current === i ? 'rgba(124,58,237,0.15)' : 'transparent',
            border: `1px solid ${current === i ? '#7c3aed' : current > i ? '#3fb950' : '#21262d'}`,
            color: current === i ? '#a78bfa' : current > i ? '#3fb950' : '#7d8590',
            fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 500,
            transition: 'all 0.2s'
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: current > i ? '#3fb950' : current === i ? '#7c3aed' : '#21262d',
              color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0
            }}>
              {current > i ? '✓' : i + 1}
            </span>
            {s}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 24, height: 1, background: current > i ? '#3fb950' : '#21262d' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 0: Capture ─────────────────────────────────────────────────────────
function CaptureStep({ onCapture }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1]
      onCapture({ base64, mimeType: file.type, preview: e.target.result })
    }
    reader.readAsDataURL(file)
  }, [onCapture])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          displaySurface: 'browser'
        },
        selfBrowserSurface: 'exclude'
      })
      
      const track = stream.getVideoTracks()[0]
      
      // Wait a tick for the stream to stabilize
      await new Promise(r => setTimeout(r, 200))
      
      const imageCapture = new ImageCapture(track)
      const bitmap = await imageCapture.grabFrame()
      
      // Stop immediately to return focus to Spectre
      stream.getTracks().forEach(t => t.stop())

      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]

      // Refocus this window
      window.focus()

      onCapture({ base64, mimeType: 'image/png', preview: dataUrl })
    } catch {
      alert('Screen capture cancelled or not supported. Please upload a screenshot instead.')
    }
  }
  
  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        Show Spectre your app
      </h2>
      <p style={{ color: '#7d8590', marginBottom: 32, fontSize: 15 }}>
        Upload a screenshot or capture your screen. Spectre will analyse every component and generate a complete Cypress test suite.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? '#7c3aed' : '#21262d'}`,
          borderRadius: 12, padding: '48px 32px', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16,
          background: dragging ? 'rgba(124,58,237,0.05)' : 'transparent'
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop a screenshot here</div>
        <div style={{ color: '#7d8590', fontSize: 13 }}>PNG, JPG, WebP supported</div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 1, background: '#21262d' }} />
        <span style={{ color: '#7d8590', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#21262d' }} />
      </div>

      <button
        onClick={handleScreenCapture}
        style={{
          width: '100%', marginTop: 16, padding: '14px',
          background: 'rgba(124,58,237,0.1)', border: '1px solid #7c3aed',
          color: '#a78bfa', borderRadius: 8, cursor: 'pointer',
          fontSize: 14, fontWeight: 600, fontFamily: 'Syne',
          transition: 'all 0.2s'
        }}
      >
        📸 Capture Screen Live
      </button>
    </div>
  )
}

// ─── Step 1: Analyse ─────────────────────────────────────────────────────────
function AnalyseStep({ capture, onAnalysis }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyse = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capture.base64, mimeType: capture.mimeType })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      onAnalysis(data.analysis)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Analysing your app</h2>
      <p style={{ color: '#7d8590', marginBottom: 24, fontSize: 15 }}>
        Spectre is reading your UI — identifying components, user journeys, and testable interactions.
      </p>

      <img src={capture.preview} alt="Screenshot" style={{
        width: '100%', borderRadius: 8, border: '1px solid #21262d',
        marginBottom: 24, maxHeight: 320, objectFit: 'contain', background: '#0d1117'
      }} />

      {error && (
        <div style={{ padding: 12, background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: 6, color: '#f85149', fontSize: 13, fontFamily: 'IBM Plex Mono', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button
        onClick={analyse}
        disabled={loading}
        style={{
          width: '100%', padding: '14px',
          background: loading ? '#21262d' : '#7c3aed',
          border: 'none', color: '#fff', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 15, fontWeight: 700, fontFamily: 'Syne', transition: 'all 0.2s'
        }}
      >
        {loading ? '🔍 Analysing...' : '🔍 Analyse Screenshot'}
      </button>
    </div>
  )
}

// ─── Step 2: Configure ───────────────────────────────────────────────────────
function ConfigureStep({ analysis, onConfigure }) {
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000')
  const [focus, setFocus] = useState('')
  const [notes, setNotes] = useState('')

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    background: '#0d1117', border: '1px solid #21262d',
    color: '#e6edf3', borderRadius: 6, fontSize: 13,
    fontFamily: 'IBM Plex Mono', outline: 'none', marginTop: 6
  }

  const labelStyle = { fontSize: 12, color: '#7d8590', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Configure your tests</h2>
      <p style={{ color: '#7d8590', marginBottom: 24, fontSize: 15 }}>
        Spectre found <strong style={{ color: '#a78bfa' }}>{analysis.components?.length || 0} components</strong> and <strong style={{ color: '#a78bfa' }}>{analysis.suggestedTests?.length || 0} test scenarios</strong>. Refine the output below.
      </p>

      {/* Analysis summary */}
      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#7d8590', fontFamily: 'IBM Plex Mono', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Detected App</div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{analysis.appType}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {analysis.userJourneys?.slice(0, 4).map(j => (
            <span key={j.name} style={{
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa', fontSize: 11, fontFamily: 'IBM Plex Mono'
            }}>{j.name}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Base URL</label>
          <input style={inputStyle} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:3000" />
        </div>
        <div>
          <label style={labelStyle}>Focus area (optional)</label>
          <input style={inputStyle} value={focus} onChange={e => setFocus(e.target.value)} placeholder="e.g. login flow, checkout, error states" />
        </div>
        <div>
          <label style={labelStyle}>Additional notes (optional)</label>
          <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. uses Lit web components, auth required" />
        </div>
      </div>

      <button
        onClick={() => onConfigure({ baseUrl, focus, notes })}
        style={{
          width: '100%', padding: '14px',
          background: '#7c3aed', border: 'none',
          color: '#fff', borderRadius: 8, cursor: 'pointer',
          fontSize: 15, fontWeight: 700, fontFamily: 'Syne'
        }}
      >
        ⚡ Generate Cypress Tests
      </button>
    </div>
  )
}

// ─── Step 3: Generate ────────────────────────────────────────────────────────
function GenerateStep({ analysis, config, capture }) {
  const [loading, setLoading] = useState(true)
  const [testCode, setTestCode] = useState(null)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Auto-generate on mount
  useState(() => {
    generate()
    startSession()
  })

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, userContext: config })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTestCode(data.testCode)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function startSession() {
    try {
      const res = await fetch(`${BACKEND}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capture.base64, mimeType: capture.mimeType })
      })
      const data = await res.json()
      if (data.success) setSessionId(data.sessionId)
    } catch { /* session is optional */ }
  }

  async function askQuestion() {
    if (!question.trim() || !sessionId) return
    setAsking(true)
    try {
      const res = await fetch(`${BACKEND}/api/session/${sessionId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })
      const data = await res.json()
      setAnswer(data.answer)
      setQuestion('')
    } catch (err) {
      setAnswer('Error: ' + err.message)
    } finally {
      setAsking(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(testCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const blob = new Blob([testCode], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spectre.cy.js'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Generating your test suite...</div>
      <div style={{ color: '#7d8590', fontSize: 14 }}>Spectre is writing your Cypress tests</div>
    </div>
  )

  if (error) return (
    <div style={{ padding: 20, background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: 8, color: '#f85149' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Generation failed</div>
      <div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono' }}>{error}</div>
      <button onClick={generate} style={{ marginTop: 12, padding: '8px 16px', background: 'transparent', border: '1px solid #f85149', color: '#f85149', borderRadius: 6, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>✅ Tests generated</h2>
          <p style={{ color: '#7d8590', fontSize: 13 }}>Download and drop into your <code style={{ fontFamily: 'IBM Plex Mono', color: '#a78bfa' }}>cypress/e2e/</code> folder</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyToClipboard} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid #21262d',
            color: copied ? '#3fb950' : '#7d8590', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'IBM Plex Mono'
          }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button onClick={download} style={{
            padding: '8px 16px', background: '#7c3aed', border: 'none',
            color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Syne'
          }}>
            ↓ Download .cy.js
          </button>
        </div>
      </div>

      {/* Code output */}
      <pre style={{
        background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
        padding: 20, overflow: 'auto', maxHeight: 400,
        fontSize: 12, fontFamily: 'IBM Plex Mono', lineHeight: 1.6,
        color: '#e6edf3', marginBottom: 24
      }}>
        {testCode}
      </pre>

      {/* Ask follow-up */}
      {sessionId && (
        <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#7d8590', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Ask Spectre about your app
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askQuestion()}
              placeholder="e.g. What edge cases should I add for the login form?"
              style={{
                flex: 1, padding: '10px 14px',
                background: '#161b22', border: '1px solid #21262d',
                color: '#e6edf3', borderRadius: 6, fontSize: 13,
                fontFamily: 'IBM Plex Mono', outline: 'none'
              }}
            />
            <button onClick={askQuestion} disabled={asking} style={{
              padding: '10px 16px', background: '#7c3aed', border: 'none',
              color: '#fff', borderRadius: 6, cursor: asking ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600
            }}>
              {asking ? '...' : 'Ask'}
            </button>
          </div>
          {answer && (
            <div style={{ marginTop: 12, padding: 12, background: '#161b22', borderRadius: 6, fontSize: 13, lineHeight: 1.6, color: '#e6edf3' }}>
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0)
  const [capture, setCapture] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [config, setConfig] = useState(null)

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #21262d', padding: '16px 40px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(7,9,15,0.8)', backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 600, color: '#a78bfa', letterSpacing: '0.05em' }}>
          👻 SPECTRE
        </div>
        <div style={{ height: 16, width: 1, background: '#21262d' }} />
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#7d8590' }}>
          Visual QA Agent
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#7d8590' }}>
          Powered by Gemini
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 740, margin: '0 auto', padding: '48px 24px' }}>
        <Steps current={step} />

        {step === 0 && (
          <CaptureStep onCapture={(c) => { setCapture(c); setStep(1) }} />
        )}
        {step === 1 && capture && (
          <AnalyseStep capture={capture} onAnalysis={(a) => { setAnalysis(a); setStep(2) }} />
        )}
        {step === 2 && analysis && (
          <ConfigureStep analysis={analysis} onConfigure={(c) => { setConfig(c); setStep(3) }} />
        )}
        {step === 3 && analysis && config && (
          <GenerateStep analysis={analysis} config={config} capture={capture} />
        )}
      </main>
    </div>
  )
}
