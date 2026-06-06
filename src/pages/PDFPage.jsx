import { useState, useRef, useEffect } from 'react'
import { uploadPDF, chatWithPDF, extractProperties } from '../lib/api.js'

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
          width:7, height:7, borderRadius:'50%', background:'#4A6480',
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
      color: done ? '#5AE06A' : '#4A6480',
      fontSize:10, fontFamily:'inherit', padding:'2px 4px',
      borderRadius:4, transition:'color 0.15s'
    }}>
      {done ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

function PDFViewer({ objectUrl, filename }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#0D1B2A' }}>
      <div style={{
        height:40, background:'#0A1628',
        borderBottom:'1px solid rgba(42,82,152,0.25)',
        display:'flex', alignItems:'center', padding:'0 14px', gap:8, flexShrink:0
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3AA0FF" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span style={{ fontSize:11, color:'#6B82A8', fontFamily:'DM Mono,monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
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
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#2A3A50', gap:12 }}>
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

function ChatPanel({ sessionId, filename, messages, setMessages, onReset }) {
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
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#0A1628' }}>
      {/* Tab bar */}
      <div style={{
        height:40, background:'#0A1628', borderBottom:'1px solid rgba(42,82,152,0.25)',
        display:'flex', alignItems:'center', padding:'0 8px', gap:2, flexShrink:0
      }}>
        {['chat','properties'].map(t => (
          <button key={t} onClick={() => t === 'properties' && !properties ? extract() : setTab(t)}
            style={{
              background: tab===t ? 'rgba(26,111,196,0.2)' : 'none',
              border:'none', borderRadius:8,
              color: tab===t ? '#3AA0FF' : '#4A6480',
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
          marginLeft:'auto', background:'none',
          border:'1px solid rgba(42,82,152,0.3)', borderRadius:6,
          color:'#4A6480', fontSize:11, fontFamily:'inherit',
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
                      background:'linear-gradient(135deg,#1A6FC4,#0A3060)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, color:'#7BC4FF'
                    }}>AI</div>
                    <span style={{ fontSize:10, color:'#3A5070', fontFamily:'DM Mono,monospace' }}>TriField AI</span>
                  </div>
                )}
                <div style={{
                  maxWidth:'88%', padding:'10px 13px', fontSize:12, lineHeight:1.65,
                  color:'#B8C8E8',
                  borderRadius: m.role==='user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role==='user' ? 'rgba(26,74,138,0.6)' : 'rgba(15,32,64,0.8)',
                  border: `1px solid ${m.role==='user' ? 'rgba(58,160,255,0.2)' : 'rgba(42,82,152,0.25)'}`
                }}>
                  {renderContent(m.content)}
                  {m.sources?.length > 0 && (
                    <p style={{ marginTop:6, fontSize:10, color:'#3A5070', fontFamily:'DM Mono,monospace' }}>
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
                <div style={{ background:'rgba(15,32,64,0.8)', border:'1px solid rgba(42,82,152,0.25)', borderRadius:'12px 12px 12px 4px' }}>
                  <TypingDots/>
                </div>
              </div>
            )}
            {error && (
              <div style={{ background:'rgba(220,60,60,0.08)', border:'1px solid rgba(220,60,60,0.2)', borderRadius:8, padding:'8px 12px', color:'#FF8080', fontSize:11 }}>
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
                  background:'rgba(26,111,196,0.07)', border:'1px solid rgba(42,82,152,0.25)',
                  borderRadius:20, color:'#6B82A8', fontSize:10,
                  fontFamily:'inherit', padding:'4px 10px', cursor:'pointer',
                  transition:'all 0.15s'
                }}>
                  {s}
                </button>
              ))}
              <button onClick={extract} style={{
                background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.3)',
                borderRadius:20, color:'#C9A84C', fontSize:10,
                fontFamily:'inherit', padding:'4px 10px', cursor:'pointer'
              }}>
                ⊞ Extract properties table
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{
            padding:'10px 14px', borderTop:'1px solid rgba(42,82,152,0.25)',
            background:'#0A1628', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0
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
                flex:1, background:'rgba(15,32,64,0.6)',
                border:'1px solid rgba(42,82,152,0.3)', borderRadius:10,
                color:'#F0F4FF', fontFamily:'inherit', fontSize:12,
                padding:'9px 12px', outline:'none', resize:'none',
                lineHeight:1.5, maxHeight:100, overflowY:'auto'
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || sending} style={{
              background: input.trim() && !sending ? 'linear-gradient(135deg,#1A6FC4,#0A4A90)' : 'rgba(26,111,196,0.15)',
              border:'none', borderRadius:10, color: input.trim() && !sending ? '#fff' : '#3A5070',
              padding:'9px 13px', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.2s', flexShrink:0
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
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:48, color:'#4A6480' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
              </svg>
              <p style={{ fontSize:12 }}>Extracting material properties…</p>
            </div>
          ) : properties?.length > 0 ? (
            <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid rgba(42,82,152,0.25)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ background:'rgba(15,32,64,0.9)' }}>
                    {['Property','Value','Unit','Standard'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#3A5070', fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:'.06em', textTransform:'uppercase', borderBottom:'1px solid rgba(42,82,152,0.25)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p, i) => (
                    <tr key={i} style={{ background: i%2 ? 'rgba(10,22,40,0.5)' : 'transparent' }}>
                      <td style={{ padding:'8px 12px', color:'#B8C8E8', borderBottom:'1px solid rgba(42,82,152,0.1)' }}>{p.property_name}</td>
                      <td style={{ padding:'8px 12px', color:'#3AA0FF', fontFamily:'DM Mono,monospace', borderBottom:'1px solid rgba(42,82,152,0.1)' }}>{p.value}</td>
                      <td style={{ padding:'8px 12px', color:'#6B82A8', fontFamily:'DM Mono,monospace', borderBottom:'1px solid rgba(42,82,152,0.1)' }}>{p.unit||'—'}</td>
                      <td style={{ padding:'8px 12px', color:'#4A6480', borderBottom:'1px solid rgba(42,82,152,0.1)' }}>{p.test_standard||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize:12, color:'#4A6480', textAlign:'center', padding:40 }}>
              {properties === null ? 'Click "Extract properties table" in the chat tab.' : 'No structured properties found in this PDF.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PDFPage() {
  const [file,      setFile]      = useState(null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [messages,  setMessages]  = useState([])
  const [splitPct,  setSplitPct]  = useState(52)
  const containerRef = useRef()
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
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', gap:24, padding:40 }}>
        <div style={{ textAlign:'center', animation:'tfFadeUp 0.5s ease both' }}>
          <h1 style={{ fontFamily:'DM Serif Display,Georgia,serif', fontSize:'clamp(30px,5vw,46px)', fontWeight:400, color:'#F0F4FF', letterSpacing:'-0.02em', marginBottom:8, lineHeight:1.15 }}>
            Drop a paper,<br/><em style={{ fontStyle:'italic', color:'#3AA0FF' }}>start asking</em>
          </h1>
          <p style={{ fontSize:13, color:'#6B82A8' }}>Chat with any research PDF — composites, aerospace, textile</p>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#3AA0FF' }}
          onDragLeave={e => { e.currentTarget.style.borderColor='rgba(42,82,152,0.4)' }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor='rgba(42,82,152,0.4)'; handleFile(e.dataTransfer.files[0]) }}
          style={{
            width:'100%', maxWidth:400,
            border:'2px dashed rgba(42,82,152,0.4)', borderRadius:16,
            padding:'44px 32px', display:'flex', flexDirection:'column',
            alignItems:'center', gap:14, cursor:'pointer', transition:'all 0.2s',
            animation:'tfFadeUp 0.5s 0.1s ease both'
          }}
        >
          <div style={{ width:60, height:60, borderRadius:14, background:'rgba(26,111,196,0.1)', border:'1px solid rgba(42,82,152,0.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'#3AA0FF' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:14, color:'#B8C8E8', marginBottom:4 }}>Drag & drop PDF or click to browse</p>
            <p style={{ fontSize:12, color:'#6B82A8' }}>Max 20MB · Any research paper</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])}/>
        </div>
        {error && <p style={{ fontSize:12, color:'#FF8080', background:'rgba(220,60,60,0.08)', padding:'8px 18px', borderRadius:8, border:'1px solid rgba(220,60,60,0.2)' }}>{error}</p>}
      </div>
    </>
  )

  // Loading
  if (uploading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, color:'#6B82A8' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3AA0FF" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
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
          display:'flex', height:'calc(100vh - 108px)',
          background:'#0A1628', overflow:'hidden',
          borderRadius:12, border:'1px solid rgba(42,82,152,0.25)',
          margin:'-24px -24px 0'
        }}
      >
        {/* PDF panel */}
        <div style={{ width:`${splitPct}%`, flexShrink:0, overflow:'hidden' }}>
          <PDFViewer objectUrl={objectUrl} filename={file?.name}/>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width:4, flexShrink:0, cursor:'col-resize',
            background:'rgba(42,82,152,0.2)', transition:'background 0.15s',
            position:'relative', display:'flex', alignItems:'center', justifyContent:'center'
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(58,160,255,0.45)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(42,82,152,0.2)'}
        >
          <div style={{ position:'absolute', width:10, height:36, borderRadius:5, background:'rgba(42,82,152,0.6)', pointerEvents:'none' }}/>
        </div>

        {/* Chat panel */}
        <div style={{ flex:1, overflow:'hidden', minWidth:0 }}>
          {sessionId
            ? <ChatPanel sessionId={sessionId} filename={file?.name} messages={messages} setMessages={setMessages} onReset={reset}/>
            : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#4A6480' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3AA0FF" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
              </div>
          }
        </div>
      </div>
    </>
  )
}
