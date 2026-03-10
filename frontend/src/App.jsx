import { useState, useRef, useCallback, useEffect } from 'react'
import CodeBlock from './CodeBlock.jsx'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

const btn = (overrides = {}) => ({
  fontFamily: 'DM Mono, monospace',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  border: '1px solid #222222',
  borderRadius: 0,
  cursor: 'pointer',
  transition: 'all 0.12s',
  padding: '10px 16px',
  background: 'transparent',
  color: '#a8a8a8',
  ...overrides,
})

// ─── Noise texture overlay ────────────────────────────────────────────────────
function Noise() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
      opacity: 0.4,
    }} />
  )
}

// ─── Step bar ─────────────────────────────────────────────────────────────────
function StepBar({ current, onBack }) {
  const steps = ['Capture', 'Analyse', 'Configure', 'Generate']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 64 }}>
      {current > 0 && (
        <button
          onClick={onBack}
          style={btn({ marginRight: 24, color: '#666', borderColor: '#222' })}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#222' }}
        >← back</button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => i < current && onBack(i)}
              disabled={i > current}
              style={{
                ...btn({ border: 'none', background: 'none', padding: '6px 12px', fontSize: 13 }),
                color: current === i ? '#fff' : current > i ? '#22c55e' : '#333',
                cursor: i < current ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              {current > i ? '✓ ' : `${i + 1}. `}{s}
              {current === i && <span style={{ position: 'absolute', bottom: 2, left: 12, right: 12, height: 1, background: 'linear-gradient(90deg, #22c55e, #4ade80)' }} />}
            </button>
            {i < steps.length - 1 && <span style={{ color: '#222', fontSize: 12, margin: '0 2px' }}>/</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 0: Capture ──────────────────────────────────────────────────────────
function CaptureStep({ onCapture }) {
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => onCapture({ base64: e.target.result.split(',')[1], mimeType: file.type, preview: e.target.result })
    reader.readAsDataURL(file)
  }, [onCapture])

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, selfBrowserSurface: 'exclude' })
      const track = stream.getVideoTracks()[0]
      await new Promise(r => setTimeout(r, 200))
      const bitmap = await new ImageCapture(track).grabFrame()
      stream.getTracks().forEach(t => t.stop())
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width; canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      window.focus()
      onCapture({ base64: dataUrl.split(',')[1], mimeType: 'image/png', preview: dataUrl })
    } catch { alert('Screen capture cancelled.') }
  }

  return (
    <div style={{ animation: 'up 0.25s ease' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 16 }}>
          01 — Input
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 400, lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 14 }}>
          Show Spectre<br />your application.
        </h1>
        <p style={{ color: '#a8a8a8', fontSize: 13, lineHeight: 1.75, maxWidth: 400 }}>
          Upload a screenshot or capture your screen live. Spectre reads every pixel and writes production-ready Cypress tests.
        </p>
      </div>

      {/* Screen capture — primary action */}
      <button
        onClick={handleScreenCapture}
        style={btn({ width: '100%', padding: '14px', textAlign: 'center', background: '#9c9797', color: '#000', borderColor: '#fff', fontSize: 13, marginBottom: 1 })}
        onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
        onMouseLeave={e => e.currentTarget.style.background = '#f8f3f3'}
      >
        ⌘ Capture screen live
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        <span style={{ fontSize: 11, color: '#f7eeee', letterSpacing: '0.08em', textTransform: 'uppercase' }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
      </div>

      {/* Drop zone — secondary action */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current.click()}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          border: `1px solid ${dragging ? '#22c55e' : hovering ? '#444' : '#222'}`,
          padding: '40px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.12s',
          background: dragging ? 'rgba(34,197,94,0.04)' : '#000',
          position: 'relative',
        }}
      >
        {(hovering || dragging) && <>
          <span style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: '2px solid #22c55e', borderLeft: '2px solid #22c55e' }} />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: '2px solid #22c55e', borderRight: '2px solid #22c55e' }} />
          <span style={{ position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottom: '2px solid #22c55e', borderLeft: '2px solid #22c55e' }} />
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: '2px solid #22c55e', borderRight: '2px solid #22c55e' }} />
        </>}
        <div style={{ fontSize: 24, marginBottom: 10, transition: 'transform 0.15s', transform: hovering ? 'translateY(-3px)' : 'none' }}>↑</div>
        <div style={{ fontSize: 13, color: hovering ? '#fff' : '#a8a8a8', transition: 'color 0.12s', marginBottom: 4 }}>
          Drop screenshot here
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>PNG · JPG · WebP</div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
      </div>
    </div>
  )
}

// ─── Step 1: Analyse ──────────────────────────────────────────────────────────
function AnalyseStep({ capture, onAnalysis }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyse = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capture.base64, mimeType: capture.mimeType })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      onAnalysis(data.analysis)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ animation: 'up 0.25s ease' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 16 }}>02 — Analyse</div>
        <h1 style={{ fontSize: 38, fontWeight: 400, lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 14 }}>
          Gemini reads<br />your UI.
        </h1>
        <p style={{ color: '#a8a8a8', fontSize: 13, lineHeight: 1.75 }}>
          Every component, every journey, every edge case — identified from pixels alone.
        </p>
      </div>

      <div style={{ border: '1px solid #222', marginBottom: 1, position: 'relative', background: '#0c0c0c', overflow: 'hidden' }}>
        <img src={capture.preview} alt="Screenshot" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', opacity: loading ? 0.3 : 1, transition: 'opacity 0.3s' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22c55e', animation: 'pulse 1.4s ease-in-out infinite' }}>
              Analysing...
            </div>
          </div>
        )}
        {loading && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(34,197,94,0.02) 50%)', backgroundSize: '100% 4px', pointerEvents: 'none' }} />}
      </div>

      {error && (
        <div style={{ padding: '12px 14px', border: '1px solid #222', borderTop: 'none', fontSize: 12, color: '#ef4444', marginBottom: 1 }}>
          ⚠ {error}
        </div>
      )}

      <button
        onClick={analyse}
        disabled={loading}
        style={btn({
          width: '100%', padding: '13px', textAlign: 'center', borderTop: 'none',
          background: loading ? '#0c0c0c' : '#fff',
          color: loading ? '#555' : '#000',
          borderColor: loading ? '#222' : '#fff',
          cursor: loading ? 'not-allowed' : 'pointer',
        })}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#e5e5e5' }}
        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#fff' }}
      >
        {loading ? 'Reading interface...' : 'Analyse screenshot →'}
      </button>
    </div>
  )
}

// ─── Step 2: Configure ────────────────────────────────────────────────────────
function ConfigureStep({ analysis, onConfigure }) {
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000')
  const [focus, setFocus] = useState('')
  const [notes, setNotes] = useState('')
  const [activeField, setActiveField] = useState(null)

  const Field = ({ id, label, value, onChange, placeholder }) => (
    <div style={{ borderBottom: '1px solid #222', transition: 'background 0.12s', background: activeField === id ? '#0c0c0c' : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ padding: '13px 16px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: activeField === id ? '#22c55e' : '#555', borderRight: '1px solid #222', minWidth: 110, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}>
          {label}
        </div>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setActiveField(id)}
          onBlur={() => setActiveField(null)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '13px 16px', fontSize: 12, fontFamily: 'DM Mono', color: '#fff', caretColor: '#22c55e' }}
        />
      </div>
    </div>
  )

  return (
    <div style={{ animation: 'up 0.25s ease' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 16 }}>03 — Configure</div>
        <h1 style={{ fontSize: 38, fontWeight: 400, lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 14 }}>
          <span style={{ color: '#22c55e' }}>{analysis.components?.length || 0}</span> components.<br />
          <span style={{ color: '#22c55e' }}>{analysis.suggestedTests?.length || 0}</span> scenarios.
        </h1>
        <p style={{ color: '#a8a8a8', fontSize: 13, lineHeight: 1.75, maxWidth: 440 }}>
          {analysis.appType}
        </p>
      </div>

      {analysis.userJourneys?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 32 }}>
          {analysis.userJourneys.slice(0, 6).map(j => (
            <span key={j.name} style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8a8a8', border: '1px solid #222', padding: '4px 10px' }}>
              {j.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ border: '1px solid #222', marginBottom: 1 }}>
        <Field id="url" label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="http://localhost:3000" />
        <Field id="focus" label="Focus" value={focus} onChange={setFocus} placeholder="login flow, checkout..." />
        <Field id="notes" label="Notes" value={notes} onChange={setNotes} placeholder="Lit components, auth required..." />
      </div>

      <button
        onClick={() => onConfigure({ baseUrl, focus, notes })}
        style={btn({ width: '100%', padding: '13px', textAlign: 'center', background: '#fff', color: '#000', borderColor: '#fff' })}
        onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
      >
        Generate tests →
      </button>
    </div>
  )
}

// ─── Step 3: Generate ─────────────────────────────────────────────────────────
function GenerateStep({ analysis, config, capture }) {
  const [loading, setLoading] = useState(true)
  const [testCode, setTestCode] = useState(null)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    generate(); startSession()
  }, [])

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, userContext: config })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTestCode(data.testCode)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function startSession() {
    try {
      const res = await fetch(`${BACKEND}/api/session/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capture.base64, mimeType: capture.mimeType })
      })
      const data = await res.json()
      if (data.success) setSessionId(data.sessionId)
    } catch { }
  }

  async function askQuestion() {
    if (!question.trim() || !sessionId) return
    setAsking(true); setAnswer(null)
    try {
      const res = await fetch(`${BACKEND}/api/session/${sessionId}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })
      const text = await res.text()
      if (!text) throw new Error('Empty response')
      const data = JSON.parse(text)
      if (!data.success) throw new Error(data.error || 'Unknown error')
      setAnswer(data.answer); setQuestion('')
    } catch (err) { setAnswer(`Error: ${err.message}`) }
    finally { setAsking(false) }
  }

  const copy = () => { navigator.clipboard.writeText(testCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const download = () => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([testCode], { type: 'text/javascript' })),
      download: 'spectre.cy.js'
    })
    a.click()
  }

  const loadingSteps = [
    { text: 'Identifying components...', color: '#22c55e' },
    { text: 'Mapping user journeys...', color: '#22c55e' },
    { text: 'Writing intercept handlers...', color: '#38bdf8' },
    { text: 'Adding edge cases...', color: '#38bdf8' },
    { text: 'Finalising test suite...', color: '#4ade80' },
  ]

  if (loading) return (
    <div style={{ animation: 'up 0.25s ease' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 16 }}>04 — Generate</div>
        <h1 style={{ fontSize: 38, fontWeight: 400, lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 14 }}>
          Writing<br />your tests.
        </h1>
      </div>
      <div style={{ border: '1px solid #222', padding: '28px 24px', background: '#0c0c0c' }}>
        {loadingSteps.map((s, i) => (
          <div key={s.text} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', animation: `appear 0.5s ease ${i * 0.35}s both` }}>
            <span style={{ color: s.color, fontSize: 10 }}>▸</span>
            <span style={{ fontSize: 12, color: '#a8a8a8' }}>
              {s.text}
              {i === loadingSteps.length - 1 && (
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: '#4ade80', marginLeft: 8, verticalAlign: 'middle',
                  animation: 'blink 1s ease-in-out infinite'
                }} />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div style={{ animation: 'up 0.25s ease', border: '1px solid #222', padding: 24 }}>
      <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 16 }}>⚠ {error}</div>
      <button onClick={() => { hasFetched.current = false; generate() }} style={btn({ color: '#fff', borderColor: '#333' })}
        onMouseEnter={e => e.currentTarget.style.background = '#0c0c0c'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        Retry →
      </button>
    </div>
  )

  const lineCount = testCode?.split('\n').length || 0

  return (
    <div style={{ animation: 'up 0.25s ease' }}>
      {/* Sticky floating toolbar */}
      <div style={{
        position: 'sticky', top: 48, zIndex: 9,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', marginBottom: 40,
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#22c55e', marginBottom: 4 }}>
            ✓ Complete
          </div>
          <div style={{ fontSize: 20, fontWeight: 400, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#22c55e' }}>{lineCount}</span>
            <span style={{ color: '#a8a8a8' }}> lines · Ready to run</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 1 }}>
          <button onClick={copy}
            style={btn({
              fontSize: 13, padding: '10px 20px',
              color: copied ? '#22c55e' : '#a8a8a8',
              borderColor: copied ? 'rgba(34,197,94,0.4)' : '#222',
              background: copied ? 'rgba(34,197,94,0.06)' : 'transparent',
            })}
            onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#444' } }}
            onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = '#a8a8a8'; e.currentTarget.style.borderColor = '#222' } }}>
            {copied ? '✓ copied' : 'copy'}
          </button>
          <button onClick={download}
            style={btn({ background: '#fff', color: '#000', borderColor: '#fff', fontSize: 13, padding: '10px 20px' })}
            onMouseEnter={e => e.currentTarget.style.background = '#e5e5e5'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            download .cy.js
          </button>
        </div>
      </div>

      <CodeBlock code={testCode} />

      {sessionId && (
        <div style={{ border: '1px solid #222', marginTop: 1 }}>
          <div style={{ display: 'flex', borderBottom: answer ? '1px solid #222' : 'none' }}>
            <div style={{ padding: '13px 16px', fontSize: 13, letterSpacing: '0.04em', color: '#888', borderRight: '1px solid #222', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              Ask
            </div>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && question.trim() && askQuestion()}
              placeholder="What edge cases am I missing?"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '13px 16px', fontSize: 12, fontFamily: 'DM Mono', color: '#fff', caretColor: '#22c55e' }}
            />
            {question.trim() && (
              <button onClick={askQuestion} disabled={asking} style={{
                padding: '13px 18px', background: 'transparent', border: 'none',
                borderLeft: '1px solid #222',
                color: asking ? '#444' : '#22c55e',
                cursor: asking ? 'not-allowed' : 'pointer',
                fontSize: 18, fontFamily: 'DM Mono', fontWeight: 500,
                transition: 'color 0.12s', lineHeight: 1,
              }}>
                {asking ? '·' : '→'}
              </button>
            )}
          </div>
          {answer && (
            <div style={{ padding: '16px 18px', fontSize: 12, color: '#a8a8a8', lineHeight: 1.8, borderLeft: '2px solid #22c55e', background: '#0c0c0c' }}>
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── App shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0)
  const [capture, setCapture] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [config, setConfig] = useState(null)

  const goBack = (target) => setStep(typeof target === 'number' ? target : step - 1)

  return (
    <div style={{ minHeight: '100vh', background: '#000', position: 'relative' }}>
      <Noise />
      <nav style={{ borderBottom: '1px solid #1a1a1a', padding: '0 40px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}>
          <span style={{ fontSize: 14, color: '#fff', fontWeight: 500, letterSpacing: '0.08em', fontFamily: 'DM Mono' }}>SPECTRE</span>
          <span style={{ fontSize: 12, color: '#666', letterSpacing: '0.06em', fontFamily: 'DM Mono' }}>/ visual qa</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontSize: 12, color: '#888', letterSpacing: '0.06em', fontFamily: 'DM Mono' }}>
            Gemini 2.5 Flash
          </span>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 80px', position: 'relative', zIndex: 1 }}>
        <StepBar current={step} onBack={goBack} />
        {step === 0 && <CaptureStep onCapture={(c) => { setCapture(c); setStep(1) }} />}
        {step === 1 && capture && <AnalyseStep capture={capture} onAnalysis={(a) => { setAnalysis(a); setStep(2) }} />}
        {step === 2 && analysis && <ConfigureStep analysis={analysis} onConfigure={(c) => { setConfig(c); setStep(3) }} />}
        {step === 3 && analysis && config && <GenerateStep analysis={analysis} config={config} capture={capture} />}
      </main>

      <style>{`
        @keyframes up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes appear { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        input::placeholder { color: #555; }
        * { box-sizing: border-box; }
        button { font-family: 'DM Mono', monospace; }
      `}</style>
    </div>
  )
}