import { useEffect, useRef } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'

const theme = `
.token.comment { color: #555; font-style: italic; }
.token.keyword { color: #38bdf8; }
.token.string { color: #86efac; }
.token.number { color: #fbbf24; }
.token.function { color: #f9a8d4; }
.token.class-name { color: #e2e8f0; font-weight: 500; }
.token.operator { color: #94a3b8; }
.token.punctuation { color: #666; }
.token.boolean { color: #38bdf8; }
.token.parameter { color: #e2e8f0; }
.token.property { color: #e2e8f0; }
.token.template-string { color: #86efac; }
.token.regex { color: #4ade80; }
code[class*="language-"] { text-shadow: none; }
`

export default function CodeBlock({ code }) {
    const ref = useRef()
    useEffect(() => { if (ref.current) Prism.highlightElement(ref.current) }, [code])
    const lines = code?.split('\n') || []

    return (
        <>
            <style>{theme}</style>
            <div style={{ border: '1px solid #222', overflow: 'hidden', fontFamily: 'DM Mono, monospace' }}>
                {/* Title bar */}
                <div style={{ padding: '11px 18px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0c0c0c' }}>
                    <div style={{ display: 'flex', gap: 7 }}>
                        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444', opacity: 0.8 }} />
                        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b', opacity: 0.8 }} />
                        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#22c55e', opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#888', letterSpacing: '0.06em' }}>spectre.cy.js</span>
                    <span style={{ fontSize: 12, color: '#666' }}>{lines.length} lines</span>
                </div>

                {/* Code body */}
                <div style={{ display: 'flex', overflow: 'auto', maxHeight: 500, background: '#080808' }}>
                    {/* Line numbers */}
                    <div style={{
                        padding: '18px 14px 18px 18px',
                        background: '#080808',
                        borderRight: '1px solid #141414',
                        userSelect: 'none',
                        flexShrink: 0,
                        textAlign: 'right',
                        minWidth: 52,
                    }}>
                        {lines.map((_, i) => (
                            <div key={i} style={{ fontSize: 12, lineHeight: '1.75', color: '#333' }}>{i + 1}</div>
                        ))}
                    </div>
                    {/* Syntax */}
                    <pre style={{ margin: 0, padding: '18px 24px', flex: 1, background: '#080808', overflow: 'visible' }}>
                        <code ref={ref} className="language-javascript" style={{
                            fontSize: 13,
                            lineHeight: '1.75',
                            fontFamily: 'DM Mono, monospace',
                            color: '#94a3b8',
                            display: 'block',
                            whiteSpace: 'pre',
                        }}>
                            {code}
                        </code>
                    </pre>
                </div>
            </div>
        </>
    )
}