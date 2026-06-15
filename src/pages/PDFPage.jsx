import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { uploadPDF, chatWithPDF, extractProperties, getPDFSessions, getLibrary, getLibraryPaper, fetchPDFBlob } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { X, Table, BookOpen } from 'lucide-react'

function useIsNarrow(bp = 768) {
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.innerWidth <= bp)
  useEffect(() => {
    const fn = () => setV(window.innerWidth <= bp)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [bp])
  return v
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
          width:7, height:7, borderRadius:'50%', background:'#6E6E6E', display:'block',
          animation:`tfBounce 1.2s ${i*0.2}s infinite ease-in-out`
        }}/>
      ))}
    </div>
  )
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(()=>setDone(false),2000) }}
      style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer',
        color: done ? '#277A38' : '#6E6E6E', fontSize:10, fontFamily:'inherit',
        padding:'2px 4px', borderRadius:4, transition:'color 0.15s' }}>
      {done ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

// ── Extract cited ref numbers from answer text ─────────────────────────────
// BUG FIX 3: Only show sources that Claude actually cited in the answer
function extractCitedRefs(answer) {
  const matches = answer.match(/\[(\d+)\]/g) || []
  return new Set(matches.map(m => parseInt(m.replace(/\[|\]/g, ''))))
}

// ── Client-Side PDF Text Highlight Matching (Resolves Multi-Column Bleeding) ──
async function findTextOnPage(page, snippet) {
  try {
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const pageHeight = viewport.height

    const cleanText = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
    const query = cleanText(snippet)
    if (!query) return null

    let fullText = ''
    const charMap = []

    textContent.items.forEach((item) => {
      if (!item.str) return
      const startIdx = fullText.length
      fullText += item.str
      const endIdx = fullText.length
      for (let i = startIdx; i < endIdx; i++) {
        charMap[i] = { item, localIdx: i - startIdx }
      }
      fullText += ' '
      charMap.push({ item: null, localIdx: 0 })
    })

    let normalizedFullText = ''
    const normToFullMap = []

    for (let i = 0; i < fullText.length; i++) {
      const char = fullText[i].toLowerCase()
      if (/[a-z0-9]/.test(char)) {
        normToFullMap.push(i)
        normalizedFullText += char
      }
    }

    const matchIdx = normalizedFullText.indexOf(query)
    if (matchIdx === -1) {
      if (query.length > 40) {
        const partialQuery = query.slice(0, 30)
        const partialIdx = normalizedFullText.indexOf(partialQuery)
        if (partialIdx !== -1) {
          const startNorm = partialIdx
          // Limit partial match length to 80 characters to prevent multi-column/cross-page bleeding
          const endNorm = Math.min(normalizedFullText.length - 1, partialIdx + Math.min(query.length, 80) - 1)
          return extractBboxes(startNorm, endNorm, normToFullMap, charMap, pageHeight)
        }
      }
      return null
    }

    const startNormIdx = matchIdx
    const endNormIdx = matchIdx + query.length - 1
    return extractBboxes(startNormIdx, endNormIdx, normToFullMap, charMap, pageHeight)
  } catch (e) {
    console.warn('Client-side findTextOnPage failed:', e)
    return null
  }
}

function extractBboxes(startNormIdx, endNormIdx, normToFullMap, charMap, pageHeight) {
  const startFullIdx = normToFullMap[startNormIdx]
  const endFullIdx = normToFullMap[endNormIdx]

  const matchedRuns = []
  for (let i = startFullIdx; i <= endFullIdx; i++) {
    const mapInfo = charMap[i]
    if (mapInfo && mapInfo.item) {
      matchedRuns.push(mapInfo.item)
    }
  }

  const uniqueItems = Array.from(new Set(matchedRuns))
  const linesMap = {}
  uniqueItems.forEach((item) => {
    const tx = item.transform[4]
    const ty = item.transform[5]
    const fontSize = item.transform[0] || item.height
    const roundedY = Math.round(ty)
    let groupedY = null
    for (const key of Object.keys(linesMap)) {
      if (Math.abs(Number(key) - roundedY) <= 3) {
        groupedY = key
        break
      }
    }
    if (!groupedY) {
      groupedY = roundedY.toString()
      linesMap[groupedY] = []
    }
    linesMap[groupedY].push({
      item,
      x0: tx,
      x1: tx + item.width,
      y0: pageHeight - (ty + fontSize),
      y1: pageHeight - ty,
    })
  })

  return Object.values(linesMap).map((itemsInLine) => {
    itemsInLine.sort((a, b) => a.x0 - b.x0)
    const x0 = Math.min(...itemsInLine.map(t => t.x0))
    const x1 = Math.max(...itemsInLine.map(t => t.x1))
    const y0 = Math.min(...itemsInLine.map(t => t.y0))
    const y1 = Math.max(...itemsInLine.map(t => t.y1))
    return [x0, y0, x1, y1]
  })
}

// ── PDF Viewer with highlight ──────────────────────────────────────────────
function PDFViewer({ file, filename, highlight }) {
  const canvasRefs  = useRef({})
  const renderTasks = useRef({})
  const [pages, setPages]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [clientBboxes, setClientBboxes] = useState(null)
  const [pageDims, setPageDims] = useState({})
  const SCALE = 1.4
  const pdfjsRef = useRef(null)
  const docRef   = useRef(null)

  // Load pdf.js from CDN
  useEffect(() => {
    if (window._pdfjsLib) { pdfjsRef.current = window._pdfjsLib; return }
    const script    = document.createElement('script')
    script.src      = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload   = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      window._pdfjsLib   = window.pdfjsLib
      pdfjsRef.current   = window.pdfjsLib
    }
    document.head.appendChild(script)
  }, [])

  // Load PDF document
  useEffect(() => {
    if (!file) { setPages([]); docRef.current = null; setPageDims({}); return }
    let cancelled = false
    setLoading(true); setError(null); setPages([]); setPageDims({})
    canvasRefs.current = {}

    const load = async () => {
      let attempts = 0
      while (!pdfjsRef.current && attempts++ < 50)
        await new Promise(r => setTimeout(r, 150))
      if (!pdfjsRef.current) { setError('PDF viewer unavailable'); setLoading(false); return }
      try {
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsRef.current.getDocument({ data: buf }).promise
        if (cancelled) return
        docRef.current = pdf
        setPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1))
      } catch (e) {
        if (!cancelled) setError('Could not render PDF: ' + e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [file])

  // Render each page onto its canvas
  useEffect(() => {
    if (!docRef.current || !pages.length) return
    pages.forEach(async (pageNum) => {
      const canvas = canvasRefs.current[pageNum]
      if (!canvas) return
      // Cancel any previous render task for this page
      if (renderTasks.current[pageNum]) {
        try { renderTasks.current[pageNum].cancel() } catch {}
      }
      try {
        const page     = await docRef.current.getPage(pageNum)
        const viewport = page.getViewport({ scale: SCALE })
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        
        setPageDims(prev => ({
          ...prev,
          [pageNum]: { width: unscaledViewport.width, height: unscaledViewport.height }
        }))

        canvas.width   = viewport.width
        canvas.height  = viewport.height
        const task = page.render({ canvasContext: canvas.getContext('2d'), viewport })
        renderTasks.current[pageNum] = task
        await task.promise
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.warn('Render error p' + pageNum, e)
      }
    })
  }, [pages])

  // Scroll to highlighted page when highlight changes
  useEffect(() => {
    if (!highlight?.page) return
    // Small delay so the canvas has rendered before we scroll
    setTimeout(() => {
      const el = document.getElementById(`pdf-page-${highlight.page}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [highlight])

  // Look up character/line coordinates when snippet is clicked
  useEffect(() => {
    if (!highlight || !highlight.page || !highlight.snippet || !docRef.current) {
      setClientBboxes(null)
      return
    }
    let cancelled = false
    const match = async () => {
      try {
        const page = await docRef.current.getPage(highlight.page)
        const bboxes = await findTextOnPage(page, highlight.snippet)
        if (!cancelled) {
          if (bboxes && bboxes.length > 0) {
            setClientBboxes(bboxes)
          } else {
            setClientBboxes(null)
          }
        }
      } catch (e) {
        if (!cancelled) setClientBboxes(null)
      }
    }
    match()
    return () => { cancelled = true }
  }, [highlight, docRef.current])

  /**
   * BUG FIX 1: Correct highlight positioning.
   *
   * By using percentage-based positioning relative to standard unscaled page
   * dimensions (page width & height at scale 1.0), highlights will scale
   * and position themselves PERFECTLY inside the page regardless of device/browser
   * resizing or scale reductions.
   */
  const getHighlightStyle = useCallback((pageNum) => {
    if (!highlight || highlight.page !== pageNum) return []
    const dims = pageDims[pageNum]
    if (!dims) return []
    const { width: pW, height: pH } = dims

    // Prioritize high-precision client-side columns/lines if matched successfully
    const bboxes = (clientBboxes && highlight.page === pageNum)
      ? clientBboxes
      : (highlight.bboxes || (highlight.bbox ? [highlight.bbox] : []))
    
    return bboxes
      .filter(bbox => bbox && bbox.length >= 4)
      .map(([x0, y0, x1, y1]) => {
        const left   = `${(x0 / pW) * 100}%`
        const top    = `${(y0 / pH) * 100}%`
        const width  = `${((x1 - x0) / pW) * 100}%`
        const height = `${((y1 - y0) / pH) * 100}%`

        return {
          position: 'absolute', left, top, width, height,
          background:    'rgba(255,210,0,0.40)',
          border:        '1.5px solid rgba(200,160,0,0.80)',
          borderRadius:  2,
          pointerEvents: 'none',
          zIndex:        2,
          transition:    'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
        }
      })
      .filter(Boolean)
  }, [highlight, clientBboxes, pageDims])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f4f4f4' }}>
      {/* Header */}
      <div style={{ height:40, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)',
        display:'flex', alignItems:'center', padding:'0 14px', gap:8, flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span style={{ fontSize:11, color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
          {filename || 'No file loaded'}
        </span>
        {highlight && (
          <span style={{ fontSize:10, color:'#854836', background:'rgba(133,72,54,0.10)',
            padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap', flexShrink:0 }}>
            → p.{highlight.page}
          </span>
        )}
      </div>

      {/* Page canvases */}
      <div style={{ flex:1, overflowY:'auto', padding:'10px', display:'flex',
        flexDirection:'column', gap:8, alignItems:'center' }}>

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:300, color:'#6E6E6E', gap:12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="2.5"
              style={{ animation:'tfSpin 0.75s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize:12 }}>Rendering PDF…</p>
          </div>
        )}
        {error && <div style={{ color:'#B42318', fontSize:12, padding:20 }}>{error}</div>}
        {!file && !loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:300, color:'#6E6E6E', gap:12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p style={{ fontSize:12 }}>PDF appears here after upload</p>
          </div>
        )}

        {pages.map(pageNum => {
          const hlStyles = getHighlightStyle(pageNum)  // now returns array
          return (
            <div key={pageNum} id={`pdf-page-${pageNum}`}
              style={{ position:'relative', boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
                background:'#fff', lineHeight:0, flexShrink:0, width:'fit-content',
                maxWidth:'100%', margin:'0 auto' }}>
              <canvas
                ref={el => { if (el) canvasRefs.current[pageNum] = el }}
                style={{ display:'block', maxWidth:'100%', height:'auto' }}
              />
              {hlStyles.map((style, i) => (
                <div key={i} style={style}/>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Answer renderer with clickable citation badges ─────────────────────────
function AnswerText({ content, sources, onCiteClick }) {
  if (!sources?.length) {
    return (
      <div style={{ fontSize:12, lineHeight:1.7 }}>
        {content.split('\n').map((l, i) => (
          <p key={i} style={{ marginBottom: l ? 5 : 0 }}
            dangerouslySetInnerHTML={{ __html: l.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>') || '&nbsp;' }}/>
        ))}
      </div>
    )
  }

  const parts = content.split(/(\[\d+\])/g)
  return (
    <div style={{ fontSize:12, lineHeight:1.7 }}>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/)
        if (match) {
          const refNum = parseInt(match[1])
          const src    = sources.find(s => s.ref === refNum)
          return (
            <button key={i}
              onClick={() => src && onCiteClick(src)}
              title={src ? `Page ${src.page}: ${src.snippet}` : `[${refNum}]`}
              style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:16, height:16, borderRadius:'50%',
                background: src ? '#854836' : '#aaa',
                color:'#fff', fontSize:9, fontWeight:700,
                border:'none', cursor: src ? 'pointer' : 'default',
                verticalAlign:'super', lineHeight:1,
                margin:'0 1px', flexShrink:0,
                transition:'transform 0.1s',
              }}
              onMouseEnter={e => { if(src) e.currentTarget.style.transform='scale(1.25)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='scale(1)' }}>
              {refNum}
            </button>
          )
        }
        return (
          <span key={i} dangerouslySetInnerHTML={{
            __html: part.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
          }}/>
        )
      })}
    </div>
  )
}

// ── Sources strip — BUG FIX 3: only show actually cited sources ────────────
function SourcesPanel({ sources, answer, onCiteClick, activeRef }) {
  // Filter to only refs that appear in the answer text
  const citedRefs    = extractCitedRefs(answer)
  const citedSources = sources.filter(s => citedRefs.has(s.ref))

  if (!citedSources.length) return null

  return (
    <div style={{ borderTop:'1px solid rgba(0,0,0,0.08)', padding:'8px 13px',
      display:'flex', flexWrap:'wrap', gap:5, background:'rgba(0,0,0,0.02)' }}>
      <span style={{ fontSize:10, color:'#6E6E6E', width:'100%', marginBottom:2 }}>
        Sources
      </span>
      {citedSources.map(src => (
        <button key={src.ref} onClick={() => onCiteClick(src)}
          title={src.snippet}
          style={{
            display:'flex', alignItems:'center', gap:5,
            background: activeRef === src.ref ? 'rgba(133,72,54,0.15)' : 'rgba(0,0,0,0.05)',
            border: activeRef === src.ref
              ? '1px solid rgba(133,72,54,0.35)'
              : '1px solid rgba(0,0,0,0.10)',
            borderRadius:20, padding:'3px 10px 3px 6px',
            cursor:'pointer', transition:'all 0.15s', fontFamily:'inherit',
          }}>
          <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:14, height:14, borderRadius:'50%', background:'#854836',
            color:'#fff', fontSize:8, fontWeight:700, flexShrink:0 }}>
            {src.ref}
          </span>
          <span style={{ fontSize:10, color:'#444' }}>p.{src.page}</span>
        </button>
      ))}
    </div>
  )
}

// ── Chat panel ─────────────────────────────────────────────────────────────
function ChatPanel({ sessionId, messages, setMessages, onReset, onHighlight, isNarrow }) {
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [properties, setProps]      = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [tab,        setTab]        = useState('chat')
  const [error,      setError]      = useState(null)
  const [activeRef,  setActiveRef]  = useState(null)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages, sending])

  const handleCiteClick = useCallback((src) => {
    setActiveRef(src.ref)
    // Use bboxes[0] as the primary bbox (exact sentence start),
    // fall back to src.bbox (chunk anchor) if bboxes not present.
    const primaryBbox = src.bboxes?.[0] || src.bbox
    onHighlight({ page: src.page, bbox: primaryBbox, bboxes: src.bboxes || [primaryBbox], snippet: src.snippet })
  }, [onHighlight])

  const send = async (q) => {
    const question = (q || input).trim()
    if (!question || sending || !sessionId) return
    setInput(''); setError(null); setActiveRef(null)
    setMessages(prev => [...prev, { role:'user', content:question }])
    setSending(true)

    // Append strict formatting directives invisibly for the backend LLM
    const ruleText = 'Each sentence must answer clearly and have EXACTLY ONE valid citation marker [N]. Do not add multiple citations side by side like [1][2] for a single fact or sentence. Select the single most relevant page/reference and make sure it is true and valid, corresponding to a documented source in the PDF. Keep your explanations concise, professional, and well-structured.'
    const finalQuery = `${question}\n\n[STRICT INSTRUCTIONS FOR THE AI ASSISTANT ANSWER WRITING FORMAT]:\n${ruleText}\n\nValidate sources and ensure exactly ONE reference tag [N] is used per fact/sentence. Multiple adjacent brackets (e.g. [1][2]) are strictly forbidden.`

    try {
      const data = await chatWithPDF(sessionId, finalQuery)

      // Post-process the answer to clean up any consecutive brackets that may have accidentally slipped through from the LLM
      let cleanAnswer = data.answer || ''
      // Regex replaces adjacent braces e.g. [1][2] or [1], [2] or list separators with just the first one
      cleanAnswer = cleanAnswer.replace(/\[\d+\](?:\s*[,;]?\s*\[\d+\])+/g, (match) => {
        const first = match.match(/\[\d+\]/)
        return first ? first[0] : match
      })

      setMessages(prev => [...prev, {
        role:'assistant', content:cleanAnswer, sources:data.sources
      }])
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

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#fff' }}>
      {/* Tab bar */}
      <div style={{ minHeight:40, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)',
        display:'flex', alignItems:'center', flexWrap: isNarrow ? 'wrap' : 'nowrap',
        padding: isNarrow ? '8px' : '0 8px', gap:4, flexShrink:0 }}>
        {['chat','properties'].map(t => (
          <button key={t}
            onClick={() => t === 'properties' && !properties ? extract() : setTab(t)}
            style={{
              background: tab===t ? 'rgba(133,72,54,0.10)' : 'none',
              border: tab===t ? '1px solid rgba(133,72,54,0.22)' : '1px solid transparent',
              borderRadius:8, color: tab===t ? '#854836' : '#6E6E6E',
              fontFamily:'inherit', fontSize:12, fontWeight:500,
              padding:'5px 12px', cursor:'pointer', transition:'all 0.15s',
              textTransform:'capitalize', display:'flex', alignItems:'center', gap:5
            }}>
            {t === 'properties'
              ? `Properties${properties?.length ? ` (${properties.length})` : ''}`
              : 'Chat'}
          </button>
        ))}
        <button onClick={onReset} style={{
          marginLeft: isNarrow ? 0 : 'auto', background:'none',
          border:'1px solid rgba(0,0,0,0.08)', borderRadius:6,
          color:'#6E6E6E', fontSize:11, fontFamily:'inherit',
          padding:'4px 10px', cursor:'pointer',
          display:'flex', alignItems:'center', gap:4 }}>
          <X size={14}/> New PDF
        </button>
      </div>

      {tab === 'chat' ? (
        <>
          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'14px 16px',
            display:'flex', flexDirection:'column', gap:12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column',
                alignItems: m.role==='user' ? 'flex-end' : 'flex-start',
                animation:'tfFadeUp 0.3s ease both' }}>
                {m.role === 'assistant' && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <div style={{ width:22, height:22, borderRadius:6,
                      background:'linear-gradient(135deg,#854836,#9B5542)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, color:'#fff' }}>AI</div>
                    <span style={{ fontSize:10, color:'#6E6E6E',
                      fontFamily:'JetBrains Mono,monospace' }}>TriField AI</span>
                  </div>
                )}
                <div style={{
                  maxWidth: isNarrow ? '100%' : '88%',
                  color: m.role==='user' ? '#fff' : '#222',
                  borderRadius: m.role==='user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role==='user' ? '#854836' : '#F7F7F7',
                  border:`1px solid ${m.role==='user' ? 'rgba(133,72,54,0.22)' : 'rgba(0,0,0,0.08)'}`,
                  overflow:'hidden',
                }}>
                  <div style={{ padding:'10px 13px' }}>
                    {m.role === 'assistant' ? (
                      <AnswerText
                        content={m.content}
                        sources={m.sources}
                        onCiteClick={handleCiteClick}
                      />
                    ) : (
                      <div style={{ fontSize:12, lineHeight:1.65 }}>
                        {m.content.split('\n').map((l,j) => (
                          <p key={j} style={{ marginBottom: l ? 5 : 0 }}
                            dangerouslySetInnerHTML={{ __html: l || '&nbsp;' }}/>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* BUG FIX 3: pass answer text so panel filters to cited-only */}
                  {m.role === 'assistant' && m.sources?.length > 0 && (
                    <SourcesPanel
                      sources={m.sources}
                      answer={m.content}
                      onCiteClick={handleCiteClick}
                      activeRef={activeRef}
                    />
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
                <div style={{ background:'#F7F7F7', border:'1px solid rgba(0,0,0,0.08)',
                  borderRadius:'12px 12px 12px 4px' }}>
                  <TypingDots/>
                </div>
              </div>
            )}
            {error && (
              <div style={{ background:'rgba(180,35,24,0.08)', border:'1px solid rgba(180,35,24,0.20)',
                borderRadius:8, padding:'8px 12px', color:'#B42318', fontSize:11 }}>
                {error}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding:'0 14px 8px', display:'flex', flexWrap:'wrap', gap:5 }}>
              {SUGGESTIONS.map((s,i) => (
                <button key={i} onClick={() => send(s)} style={{
                  background:'rgba(133,72,54,0.07)', border:'1px solid rgba(0,0,0,0.08)',
                  borderRadius:20, color:'#6E6E6E', fontSize:10, fontFamily:'inherit',
                  padding:'4px 10px', cursor:'pointer', transition:'all 0.15s' }}>
                  {s}
                </button>
              ))}
              <button onClick={extract} style={{
                background:'rgba(255,178,44,0.18)', border:'1px solid rgba(255,178,44,0.42)',
                borderRadius:20, color:'#854836', fontSize:10, fontFamily:'inherit',
                padding:'4px 10px', cursor:'pointer',
                display:'flex', alignItems:'center', gap:4 }}>
                <Table size={12}/> Extract properties table
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: isNarrow ? '10px' : '10px 14px',
            borderTop:'1px solid rgba(0,0,0,0.08)', background:'#fff',
            display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
            <textarea ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }}}
              placeholder="Ask anything about this paper… (Enter to send)"
              rows={1} disabled={sending}
              style={{ flex:1, background:'#fff', border:'1px solid rgba(0,0,0,0.08)',
                borderRadius:10, color:'#000', fontFamily:'inherit', fontSize:12,
                padding:'9px 12px', outline:'none', resize:'none',
                lineHeight:1.5, maxHeight:100, overflowY:'auto' }}/>
            <button onClick={() => send()} disabled={!input.trim() || sending} style={{
              background: input.trim() && !sending
                ? 'linear-gradient(135deg,#854836,#9B5542)' : 'rgba(133,72,54,0.15)',
              border:'none', borderRadius:10,
              color: input.trim() && !sending ? '#fff' : '#6E6E6E',
              padding:'9px 13px',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.2s', flexShrink:0,
              boxShadow: input.trim() && !sending
                ? '0 10px 24px rgba(133,72,54,0.22)' : 'none' }}>
              {sending
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </>
      ) : (
        /* Properties tab */
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {extracting ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
              gap:14, padding:48, color:'#6E6E6E' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite' }}>
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
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#6E6E6E',
                        fontFamily:'JetBrains Mono,monospace', fontSize:9, letterSpacing:'.06em',
                        textTransform:'uppercase',
                        borderBottom:'1px solid rgba(0,0,0,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p,i) => (
                    <tr key={i} style={{ background: i%2 ? '#FBFBFB' : 'transparent' }}>
                      <td style={{ padding:'8px 12px', color:'#222',
                        borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.property_name}</td>
                      <td style={{ padding:'8px 12px', color:'#854836',
                        fontFamily:'JetBrains Mono,monospace',
                        borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.value}</td>
                      <td style={{ padding:'8px 12px', color:'#6E6E6E',
                        fontFamily:'JetBrains Mono,monospace',
                        borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.unit||'—'}</td>
                      <td style={{ padding:'8px 12px', color:'#6E6E6E',
                        borderBottom:'1px solid rgba(0,0,0,0.06)' }}>{p.test_standard||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize:12, color:'#6E6E6E', textAlign:'center', padding:40 }}>
              {properties === null
                ? 'Click "Extract properties table" in the chat tab.'
                : 'No structured properties found in this PDF.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PDFPage() {
  const { incrementPdfCount } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionUrlParam = searchParams.get('session')

  const [file,      setFile]      = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [messages,  setMessages]  = useState([])
  const [highlight, setHighlight] = useState(null)
  const [splitPct,  setSplitPct]  = useState(52)
  const containerRef = useRef()
  const fileInputRef = useRef()
  const resizing     = useRef(false)
  const startX       = useRef(0)
  const startW       = useRef(0)
  const isNarrow     = useIsNarrow()

  useEffect(() => {
    if (!sessionUrlParam || sessionId === sessionUrlParam) return

    let active = true
    const fetchSessionPDF = async () => {
      setUploading(true)
      setError(null)
      try {
        const libRes = await getLibrary({ limit: 100 }).catch(() => ({ papers: [] }))
        let matched = libRes.papers?.find(p => p.session_id === sessionUrlParam || p.id === sessionUrlParam)

        if (!matched && sessionUrlParam) {
          try {
            const paperRes = await getLibraryPaper(sessionUrlParam)
            if (paperRes) matched = paperRes
          } catch (e) {
            // ignore fallback
          }
        }

        if (!matched) {
          const sessionsRes = await getPDFSessions().catch(() => ({ sessions: [] }))
          matched = sessionsRes.sessions?.find(s => s.id === sessionUrlParam || s.session_id === sessionUrlParam)
        }

        if (!matched) {
          throw new Error('PDF Session not found')
        }

        const pdfUrl = matched.r2_url || matched.open_access_url || matched.pdf_url || matched.url || matched.file_url || matched.download_url || matched.pdf
        if (!pdfUrl) {
          throw new Error('PDF file URL not available for this session')
        }

        let blob
        try {
          // Attempt 1: Direct fetch. Works if the source allows CORS or is on our origin.
          const response = await fetch(pdfUrl)
          if (!response.ok) {
            throw new Error(`Direct fetch returned status ${response.status}`)
          }
          blob = await response.blob()
        } catch (err) {
          console.warn('PDF direct fetch failed or blocked by CORS. Retrying via backend proxy...', err)
          // Attempt 2: Our own backend proxy (server-side fetch, no CORS issue,
          // no dependency on unreliable public CORS proxies)
          blob = await fetchPDFBlob(pdfUrl)
        }
        const loadedFile = new File([blob], matched.filename || matched.title || 'document.pdf', { type: 'application/pdf' })

        if (active) {
          setFile(loadedFile)
          setSessionId(matched.session_id || matched.id || sessionUrlParam)
          setMessages([{
            role: 'assistant',
            content: `**${loadedFile.name}** loaded from Library ✓\n\nAsk me anything — click the numbered badges in answers to jump to that passage in the PDF.`,
            sources: []
          }])
        }
      } catch (err) {
        if (active) {
          setError(err.message)
          setFile(null)
          setSessionId(null)
        }
      } finally {
        if (active) {
          setUploading(false)
        }
      }
    }

    fetchSessionPDF()
    return () => { active = false }
  }, [sessionUrlParam, sessionId])

  const handleFile = async (f) => {
    if (!f?.name.endsWith('.pdf')) { setError('Please select a PDF file.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File too large. Max 20MB.'); return }
    setFile(f); setUploading(true); setError(null); setMessages([]); setHighlight(null)
    try {
      const data = await uploadPDF(f)
      setSessionId(data.session_id)
      incrementPdfCount?.()
      setMessages([{
        role:'assistant',
        content:`**${f.name}** indexed ✓\n\nAsk me anything — click the numbered badges in answers to jump to that passage in the PDF.`,
        sources:[],
      }])
    } catch(e) {
      setError(e.message); setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null); setSessionId(null)
    setMessages([]); setError(null); setHighlight(null)
    setSearchParams({})
  }

  const onMouseDown = (e) => {
    resizing.current = true
    startX.current   = e.clientX
    startW.current   = containerRef.current
      ? containerRef.current.offsetWidth * splitPct / 100 : 0
  }
  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.current || !containerRef.current) return
      const total = containerRef.current.offsetWidth
      const newW  = startW.current + (e.clientX - startX.current)
      setSplitPct(Math.min(75, Math.max(25, (newW/total)*100)))
    }
    const onUp = () => { resizing.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // Upload screen
  if (!file && !uploading) return (
    <>
      <style>{`
        @keyframes tfFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes tfSpin   { to{transform:rotate(360deg)} }
        @keyframes tfBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
      `}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', minHeight: isNarrow ? 'auto' : '70vh',
        gap: isNarrow ? 20 : 24, padding: isNarrow ? '24px 0' : 40 }}>
        <div style={{ textAlign:'center', animation:'tfFadeUp 0.5s ease both' }}>
          <h1 style={{ fontFamily:'Inter,system-ui,-apple-system,sans-serif',
            fontSize:'clamp(30px,5vw,46px)', fontWeight:400, color:'#000',
            letterSpacing:'-0.02em', marginBottom:8, lineHeight:1.15 }}>
            Drop a paper,<br/><em style={{ fontStyle:'italic', color:'#854836' }}>start asking</em>
          </h1>
          <p style={{ fontSize:13, color:'#6E6E6E' }}>
            Click citation badges in answers to jump to the exact passage
          </p>
        </div>
        <div onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#854836' }}
          onDragLeave={e => { e.currentTarget.style.borderColor='rgba(133,72,54,0.22)' }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor='rgba(133,72,54,0.22)'; handleFile(e.dataTransfer.files[0]) }}
          style={{ width:'100%', maxWidth:400,
            border:'2px dashed rgba(133,72,54,0.22)', borderRadius:16,
            padding: isNarrow ? '30px 18px' : '44px 32px',
            display:'flex', flexDirection:'column', alignItems:'center',
            gap:14, cursor:'pointer', transition:'all 0.2s',
            animation:'tfFadeUp 0.5s 0.1s ease both' }}>
          <div style={{ width:60, height:60, borderRadius:14,
            background:'rgba(133,72,54,0.10)', border:'1px solid rgba(0,0,0,0.08)',
            display:'flex', alignItems:'center', justifyContent:'center', color:'#854836' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:14, color:'#222', marginBottom:4 }}>
              Drag & drop PDF or click to browse
            </p>
            <p style={{ fontSize:12, color:'#6E6E6E' }}>Max 20MB · Any research paper</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:'none' }}
            onChange={e => handleFile(e.target.files[0])}/>
        </div>
        {error && (
          <p style={{ fontSize:12, color:'#B42318', background:'rgba(180,35,24,0.08)',
            padding:'8px 18px', borderRadius:8, border:'1px solid rgba(180,35,24,0.20)' }}>
            {error}
          </p>
        )}
      </div>
    </>
  )

  if (uploading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight: isNarrow ? '45vh' : '60vh',
      gap:16, color:'#6E6E6E' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="2.5"
        style={{ animation:'tfSpin 0.75s linear infinite' }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
      </svg>
      <p style={{ fontSize:13 }}>Uploading and indexing {file?.name}…</p>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes tfFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes tfSpin    { to{transform:rotate(360deg)} }
        @keyframes tfBounce  { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
      `}</style>
      <div ref={containerRef} style={{
        display:'flex', flexDirection: isNarrow ? 'column' : 'row',
        height: isNarrow ? 'auto' : 'calc(100vh - 108px)',
        minHeight: isNarrow ? 'calc(100vh - 154px)' : undefined,
        background:'#fff', overflow:'hidden',
        borderRadius:12, border:'1px solid rgba(0,0,0,0.08)',
        margin: isNarrow ? '0' : '-24px -24px 0'
      }}>
        {/* PDF panel */}
        <div style={{ width: isNarrow ? '100%' : `${splitPct}%`,
          height: isNarrow ? '48vh' : 'auto',
          flexShrink:0, overflow:'hidden',
          borderBottom: isNarrow ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
          <PDFViewer file={file} filename={file?.name} highlight={highlight}/>
        </div>

        {/* Resize handle */}
        {!isNarrow && (
          <div onMouseDown={onMouseDown}
            style={{ display:'flex', width:4, flexShrink:0, cursor:'col-resize',
              background:'rgba(0,0,0,0.08)', transition:'background 0.15s',
              position:'relative', alignItems:'center', justifyContent:'center' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(133,72,54,0.26)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0.08)'}>
            <div style={{ position:'absolute', width:10, height:36, borderRadius:5,
              background:'rgba(133,72,54,0.28)', pointerEvents:'none' }}/>
          </div>
        )}

        {/* Chat panel */}
        <div style={{ flex:1, overflow:'hidden', minWidth:0,
          minHeight: isNarrow ? '55vh' : 0 }}>
          {sessionId
            ? <ChatPanel
                sessionId={sessionId}
                messages={messages}
                setMessages={setMessages}
                onReset={reset}
                onHighlight={setHighlight}
                isNarrow={isNarrow}
              />
            : <div style={{ display:'flex', alignItems:'center',
                justifyContent:'center', height:'100%', color:'#6E6E6E' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="#854836" strokeWidth="2.5"
                  style={{ animation:'tfSpin 0.75s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
              </div>
          }
        </div>
      </div>
    </>
  )
}
