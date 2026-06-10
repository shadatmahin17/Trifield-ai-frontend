import { useState, useRef, useEffect } from 'react'
import { uploadPDF, chatWithPDF, extractProperties } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'


function useIsNarrowViewport(breakpoint = 768) {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= breakpoint
  })

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= breakpoint)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isNarrow
}

const SUGGESTIONS = [
  'What is the main contribution of this paper?',
  'What methodology was used?',
  'Summarise the key results and findings.',
  'What material properties were reported?',
  'What are the limitations of this study?',
  'What future work do the authors suggest?',
]

function TypingDots() {
  return (
    <div style={{ display:'flex', gap:5, padding:'12px 14px', alignItems:'center' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:7, height:7, borderRadius:'50%', background:'#6E6E6E',
          display:'block',
          animation:`tfBounce 1.2s ${i*0.2}s infinite ease-in-out`
        }}/>
      ))}
    </div>
  )
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false)
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) }
  return (
    <button onClick={copy} style={{
      display:'flex', alignItems:'center', gap:4,
      background:'none', border:'none', cursor:'pointer',
      color: done ? '#277A38' : '#6E6E6E',
      fontSize:10, fontFamily:'inherit', padding:'2px 4px',
      borderRadius:4, transition:'color 0.15s'
    }}>
      {done ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

function PDFViewer({ objectUrl, filename }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#FFFFFF' }}>
      <div style={{
        height:40, background:'#FFFFFF',
        borderBottom:'1px solid rgba(0,0,0,0.08)',
        display:'flex', alignItems:'center', padding:'0 14px', gap:8, flexShrink:0
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span style={{ fontSize:11, color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
          {filename || 'No file loaded'}
        </span>
      </div>
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {objectUrl ? (
          <iframe
            src={`${objectUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            style={{ width:'100%', height:'100%', border:'none', display:'block' }}
            title="PDF Viewer"
          />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#6E6E6E', gap:12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p style={{ fontSize:12 }}>PDF appears here after upload</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ChatPanel({ sessionId, filename, messages, setMessages, onReset, isNarrow }) {
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [properties, setProps]      = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [tab,        setTab]        = useState('chat')
  const [error,      setError]      = useState(null)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages, sending])

  const send = async (q) => {
    const question = (q || input).trim()
    if (!question || sending || !sessionId) return
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role:'user', content:question }])
    setSending(true)
    try {
      const data = await chatWithPDF(sessionId, question)
      setMessages(prev => [...prev, { role:'assistant', content:data.answer, sources:data.sources }])
    } catch(e) {
      setError(e.message)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const extract = async () => {
    setExtracting(true); setTab('properties')
    try {
      const data = await extractProperties(sessionId)
      setProps(data.properties)
    } catch(e) { setError(e.message) }
    finally { setExtracting(false) }
  }

  const renderContent = (text) =>
    text.split('\n').map((line, i) => (
      <p key={i} style={{ marginBottom: line ? 5 : 0 }}
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>') || '&nbsp;' }}
      />
    ))

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#FFFFFF' }}>
      {/* Tab bar */}
      <div style={{
        minHeight:40, background:'#FFFFFF', borderBottom:'1px solid rgba(0,0,0,0.08)',
        display:'flex', alignItems:'center', flexWrap:isNarrow ? 'wrap' : 'nowrap', padding:isNarrow ? '8px' : '0 8px', gap:4, flexShrink:0
      }}>
        {['chat','properties'].map(t => (
          <button key={t} onClick={() => t === 'properties' && !properties ? extract() : setTab(t)}
            style={{
              background: tab===t ? 'rgba(133,72,54,0.10)' : 'none',
              border: tab===t ? '1px solid rgba(133,72,54,0.22)' : '1px solid transparent', borderRadius:8,
              color: tab===t ? '#854836' : '#6E6E6E',
              fontFamily:'inherit', fontSize:12, fontWeight:500,
              padding:'5px 12px', cursor:'pointer', transition:'all 0.15s',
              textTransform:'capitalize', display:'flex', alignItems:'center', gap:5
            }}>
            {t === 'properties'
              ? `Properties${properties?.length ? ` (${properties.length})` : ''}`
              : 'Chat'
            }
          </button>
        ))}
        <button onClick={onReset} style={{
          marginLeft:isNarrow ? 0 : 'auto', background:'none',
          border:'1px solid rgba(0,0,0,0.08)', borderRadius:6,
          color:'#6E6E6E', fontSize:11, fontFamily:'inherit',
          padding:'4px 10px', cursor:'pointer',
          display:'flex', alignItems:'center', gap:4
        }}>
          ✕ New PDF
        </button>
      </div>

      {tab === 'chat' ? (
        <>
          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display:'flex', flexDirection:'column',
                alignItems: m.role==='user' ? 'flex-end' : 'flex-start',
                animation:'tfFadeUp 0.3s ease both'
              }}>
                {m.role === 'assistant' && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <div style={{
                      width:22, height:22, borderRadius:6,
                      background:'linear-gradient(135deg,#854836,#9B5542)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, color:'#FFFFFF'
                    }}>AI</div>
                    <span style={{ fontSize:10, color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace' }}>TriField AI</span>
                  </div>
                )}
                <div style={{
                  maxWidth:isNarrow ? '100%' : '88%', padding:'10px 13px', fontSize:12, lineHeight:1.65,
                  color: m.role==='user' ? '#FFFFFF' : '#222222',
                  borderRadius: m.role==='user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role==='user' ? '#854836' : '#F7F7F7',
                  border: `1px solid ${m.role==='user' ? 'rgba(133,72,54,0.22)' : 'rgba(0,0,0,0.08)'}`
                }}>
                  {renderContent(m.content)}
                  {m.sources?.length > 0 && (
                    <p style={{ marginTop:6, fontSize:10, color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace' }}>
                      ref: {m.sources.join(', ')}
                    </p>
                  )}
                </div>
                {m.role === 'assistant' && m.content.length > 40 && (
                  <div style={{ marginLeft:28, marginTop:2 }}>
                    <CopyBtn text={m.content}/>
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div style={{ display:'flex', alignItems:'flex-start' }}>
                <div style={{ background:'#F7F7F7', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'12px 12px 12px 4px' }}>
                  <TypingDots/>
                </div>
              </div>
            )}
            {error && (
              <div style={{ background:'rgba(180,35,24,0.08)', border:'1px solid rgba(180,35,24,0.20)', borderRadius:8, padding:'8px 12px', color:'#B42318', fontSize:11 }}>
                {error}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding:'0 14px 8px', display:'flex', flexWrap:'wrap', gap:5 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  background:'rgba(133,72,54,0.07)', border:'1px solid rgba(0,0,0,0.08)',
                  borderRadius:20, color:'#6E6E6E', fontSize:10,
                  fontFamily:'inherit', padding:'4px 10px', cursor:'pointer',
                  transition:'all 0.15s'
                }}>
                  {s}
                </button>
              ))}
              <button onClick={extract} style={{
                background:'rgba(255,178,44,0.18)', border:'1px solid rgba(255,178,44,0.42)',
                borderRadius:20, color:'#854836', fontSize:10,
                fontFamily:'inherit', padding:'4px 10px', cursor:'pointer'
              }}>
                ⊞ Extract properties table
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{
            padding:isNarrow ? '10px' : '10px 14px', borderTop:'1px solid rgba(0,0,0,0.08)',
            background:'#FFFFFF', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask anything about this paper… (Enter to send)"
              rows={1}
              disabled={sending}
              style={{
                flex:1, background:'#FFFFFF',
                border:'1px solid rgba(0,0,0,0.08)', borderRadius:10,
                color:'#000000', fontFamily:'inherit', fontSize:12,
                padding:'9px 12px', outline:'none', resize:'none',
                lineHeight:1.5, maxHeight:100, overflowY:'auto'
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || sending} style={{
              background: input.trim() && !sending ? 'linear-gradient(135deg,#854836,#9B5542)' : 'rgba(133,72,54,0.15)',
              border:'none', borderRadius:10, color: input.trim() && !sending ? '#fff' : '#6E6E6E',
              padding:'9px 13px', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.2s', flexShrink:0, boxShadow: input.trim() && !sending ? '0 10px 24px rgba(133,72,54,0.22)' : 'none'
            }}>
              {sending
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </>
      ) : (
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {extracting ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:48, color:'#6E6E6E' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
              </svg>
              <p style={{ fontSize:12 }}>Extracting material properties…</p>
            </div>
          ) : properties?.length > 0 ? (
            <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid rgba(0,0,0,0.08)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ background:'#F7F7F7' }}>
                    {['Property','Value','Unit','Standard'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace', fontSize:9, letterSpacing:'.06em', textTransform:'uppercase', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p, i) => (
                    <tr key={i} style={{ background: i%2 ? '#FBFBFB' : 'transparent' }}>
                      <td style={{ padding:'8px 12px', color:'#222222', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.property_name}</td>
                      <td style={{ padding:'8px 12px', color:'#854836', fontFamily:'JetBrains Mono,monospace', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.value}</td>
                      <td style={{ padding:'8px 12px', color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.unit||'—'}</td>
                      <td style={{ padding:'8px 12px', color:'#6E6E6E', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.test_standard||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize:12, color:'#6E6E6E', textAlign:'center', padding:40 }}>
              {properties === null ? 'Click "Extract properties table" in the chat tab.' : 'No structured properties found in this PDF.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PDFPage() {
  const { incrementPdfCount } = useAuth()
  const [file,      setFile]      = useState(null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [messages,  setMessages]  = useState([])
  const [splitPct,  setSplitPct]  = useState(52)
  const containerRef = useRef()
  const isNarrow = useIsNarrowViewport()
  const resizing     = useRef(false)
  const startX       = useRef(0)
  const startW       = useRef(0)
  const fileInputRef = useRef()

  const handleFile = async (f) => {
    if (!f?.name.endsWith('.pdf')) { setError('Please select a PDF file.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File too large. Max 20MB.'); return }
    const url = URL.createObjectURL(f)
    setFile(f); setObjectUrl(url)
    setUploading(true); setError(null); setMessages([])
    try {
      const data = await uploadPDF(f)
      setSessionId(data.session_id)
      incrementPdfCount()
      setMessages([{ role:'assistant', content:`**${f.name}** indexed ✓\n\nAsk me anything — methodology, results, material properties, conclusions, or any specific section.` }])
    } catch(e) {
      setError(e.message); setFile(null); setObjectUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const onMouseDown = (e) => {
    resizing.current = true
    startX.current   = e.clientX
    startW.current   = containerRef.current
      ? (containerRef.current.offsetWidth * splitPct / 100)
      : 0
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.current || !containerRef.current) return
      const total = containerRef.current.offsetWidth
      const newW  = startW.current + (e.clientX - startX.current)
      setSplitPct(Math.min(75, Math.max(25, (newW / total) * 100)))
    }
    const onUp = () => { resizing.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const reset = () => {
    setFile(null); setObjectUrl(null); setSessionId(null)
    setMessages([]); setError(null)
  }

  // Upload screen
  if (!file && !uploading) return (
    <>
      <style>{`
        @keyframes tfFadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
        @keyframes tfSpin   { to { transform:rotate(360deg) } }
        @keyframes tfBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
      `}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:isNarrow ? 'auto' : '70vh', gap:isNarrow ? 20 : 24, padding:isNarrow ? '24px 0' : 40 }}>
        <div style={{ textAlign:'center', animation:'tfFadeUp 0.5s ease both' }}>
          <h1 style={{ fontFamily:'Inter,system-ui,-apple-system,sans-serif', fontSize:'clamp(30px,5vw,46px)', fontWeight:400, color:'#000000', letterSpacing:'-0.02em', marginBottom:8, lineHeight:1.15 }}>
            Drop a paper,<br/><em style={{ fontStyle:'italic', color:'#854836' }}>start asking</em>
          </h1>
          <p style={{ fontSize:13, color:'#6E6E6E' }}>Chat with any research PDF — composites, aerospace, textile</p>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#854836' }}
          onDragLeave={e => { e.currentTarget.style.borderColor='rgba(133,72,54,0.22)' }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor='rgba(133,72,54,0.22)'; handleFile(e.dataTransfer.files[0]) }}
          style={{
            width:'100%', maxWidth:400,
            border:'2px dashed rgba(133,72,54,0.22)', borderRadius:16,
            padding:isNarrow ? '30px 18px' : '44px 32px', display:'flex', flexDirection:'column',
            alignItems:'center', gap:14, cursor:'pointer', transition:'all 0.2s',
            animation:'tfFadeUp 0.5s 0.1s ease both'
          }}
        >
          <div style={{ width:60, height:60, borderRadius:14, background:'rgba(133,72,54,0.10)', border:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', color:'#854836' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:14, color:'#222222', marginBottom:4 }}>Drag & drop PDF or click to browse</p>
            <p style={{ fontSize:12, color:'#6E6E6E' }}>Max 20MB · Any research paper</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])}/>
        </div>
        {error && <p style={{ fontSize:12, color:'#B42318', background:'rgba(180,35,24,0.08)', padding:'8px 18px', borderRadius:8, border:'1px solid rgba(180,35,24,0.20)' }}>{error}</p>}
      </div>
    </>
  )

  // Loading
  if (uploading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:isNarrow ? '45vh' : '60vh', gap:16, color:'#6E6E6E' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
      </svg>
      <p style={{ fontSize:13 }}>Uploading and indexing {file?.name}…</p>
    </div>
  )

  // Workspace — split screen
  return (
    <>
      <style>{`
        @keyframes tfFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes tfSpin    { to{transform:rotate(360deg)} }
        @keyframes tfBounce  { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
      `}</style>
      <div
        ref={containerRef}
        style={{
          display:'flex', flexDirection:isNarrow ? 'column' : 'row', height:isNarrow ? 'auto' : 'calc(100vh - 108px)',
          minHeight:isNarrow ? 'calc(100vh - 154px)' : undefined,
          background:'#FFFFFF', overflow:'hidden',
          borderRadius:12, border:'1px solid rgba(0,0,0,0.08)',
          margin:isNarrow ? '0' : '-24px -24px 0'
        }}
      >
        {/* PDF panel */}
        <div style={{ width:isNarrow ? '100%' : `${splitPct}%`, height:isNarrow ? '42vh' : 'auto', flexShrink:0, overflow:'hidden', borderBottom:isNarrow ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
          <PDFViewer objectUrl={objectUrl} filename={file?.name}/>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={isNarrow ? undefined : onMouseDown}
          style={{
            display:isNarrow ? 'none' : 'flex', width:4, flexShrink:0, cursor:'col-resize',
            background:'rgba(0,0,0,0.08)', transition:'background 0.15s',
            position:'relative', alignItems:'center', justifyContent:'center'
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(133,72,54,0.26)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0.08)'}
        >
          <div style={{ position:'absolute', width:10, height:36, borderRadius:5, background:'rgba(133,72,54,0.28)', pointerEvents:'none' }}/>
        </div>

        {/* Chat panel */}
        <div style={{ flex:1, overflow:'hidden', minWidth:0, minHeight:isNarrow ? '55vh' : 0 }}>
          {sessionId
            ? <ChatPanel sessionId={sessionId} filename={file?.name} messages={messages} setMessages={setMessages} onReset={reset} isNarrow={isNarrow}/>
            : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#6E6E6E' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
              </div>
          }
        </div>
      </div>
    </>
  )
}
