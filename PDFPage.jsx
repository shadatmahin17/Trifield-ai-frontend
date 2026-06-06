import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, Send, Loader2, Table2, X,
         ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import { uploadPDF, chatWithPDF, extractProperties } from '../lib/api.js'
import styles from './PDFPage.module.css'

const SUGGESTED = [
  'What fibre volume fraction was used?',
  'What fabrication method was described?',
  'Summarise the key mechanical properties found.',
  'What were the main conclusions?',
  'What test standards were followed?',
]

function Message({ msg }) {
  return (
    <div className={`${styles.msg} ${msg.role === 'user' ? styles.user : styles.assistant}`}>
      <div className={styles.msgBubble}>
        <p>{msg.content}</p>
        {msg.sources?.length > 0 && (
          <p className={styles.sources}>Sources: {msg.sources.join(', ')}</p>
        )}
      </div>
    </div>
  )
}

function PropertyTable({ properties }) {
  if (!properties?.length) return (
    <p className={styles.noProp}>No structured properties could be extracted from this PDF.</p>
  )
  return (
    <div className={styles.tableWrap}>
      <table className={styles.propTable}>
        <thead>
          <tr>
            <th>Property</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Standard</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p, i) => (
            <tr key={i}>
              <td>{p.property_name}</td>
              <td className={styles.valCell}>{p.value}</td>
              <td className={styles.unitCell}>{p.unit || '—'}</td>
              <td className={styles.stdCell}>{p.test_standard || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PDFPage() {
  const [sessionId,   setSessionId]   = useState(null)
  const [filename,    setFilename]    = useState(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [messages,    setMessages]    = useState([])
  const [question,    setQuestion]    = useState('')
  const [sending,     setSending]     = useState(false)
  const [chatError,   setChatError]   = useState(null)
  const [properties,  setProperties]  = useState(null)
  const [extracting,  setExtracting]  = useState(false)
  const [activeTab,   setActiveTab]   = useState('chat')
  const [isDragging,  setIsDragging]  = useState(false)
  const fileInputRef = useRef()
  const bottomRef    = useRef()
  const inputRef     = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      setUploadError('Please upload a PDF file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 20MB.')
      return
    }
    setUploading(true)
    setUploadError(null)
    setMessages([])
    setProperties(null)
    try {
      const data = await uploadPDF(file)
      setSessionId(data.session_id)
      setFilename(file.name)
      setMessages([{
        role: 'assistant',
        content: `PDF loaded: "${file.name}" (${data.size_mb}MB). Ask me anything about this paper — methodology, results, properties, conclusions.`,
      }])
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSend = async () => {
    const q = question.trim()
    if (!q || !sessionId || sending) return
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setSending(true)
    setChatError(null)
    try {
      const data = await chatWithPDF(sessionId, q)
      setMessages(prev => [
        ...prev.filter(m => m.role !== '_typing'),
        { role: 'assistant', content: data.answer, sources: data.sources }
      ])
    } catch (e) {
      setChatError(e.message)
      setMessages(prev => prev.filter(m => m.role !== '_typing'))
    } finally {
      setSending(false)
    }
  }

  const handleExtract = async () => {
    if (!sessionId || extracting) return
    setExtracting(true)
    setActiveTab('properties')
    try {
      const data = await extractProperties(sessionId)
      setProperties(data.properties)
    } catch (e) {
      setChatError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  const reset = () => {
    setSessionId(null); setFilename(null); setMessages([])
    setProperties(null); setChatError(null); setUploadError(null)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>PDF Chat</h1>
        <p className={styles.sub}>Upload any research paper — ask questions, extract data</p>
      </header>

      {!sessionId ? (
        /* ── Upload zone ── */
        <div
          className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className={styles.uploadingState}>
              <Loader2 size={36} className={styles.spin} />
              <p>Uploading and indexing PDF…</p>
            </div>
          ) : (
            <>
              <div className={styles.uploadIcon}>
                <Upload size={32} strokeWidth={1.5} />
              </div>
              <p className={styles.uploadTitle}>Drop your PDF here</p>
              <p className={styles.uploadSub}>or click to browse · Max 20MB</p>
              {uploadError && (
                <p className={styles.uploadError}>
                  <AlertCircle size={14} /> {uploadError}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── Chat interface ── */
        <div className={styles.chatWrap}>
          {/* File info bar */}
          <div className={styles.fileBar}>
            <div className={styles.fileInfo}>
              <FileText size={16} className={styles.fileIcon} />
              <span>{filename}</span>
              <CheckCircle2 size={14} className={styles.checkIcon} />
            </div>
            <div className={styles.fileActions}>
              <button
                onClick={handleExtract}
                disabled={extracting}
                className={styles.extractBtn}
              >
                {extracting
                  ? <><Loader2 size={13} className={styles.spin} /> Extracting…</>
                  : <><Table2 size={13} /> Extract Properties</>
                }
              </button>
              <button onClick={reset} className={styles.closeBtn} title="Upload new PDF">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'chat' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('chat')}
            >Chat</button>
            <button
              className={`${styles.tab} ${activeTab === 'properties' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('properties')}
            >
              Properties
              {properties?.length > 0 && (
                <span className={styles.tabBadge}>{properties.length}</span>
              )}
            </button>
          </div>

          {activeTab === 'chat' && (
            <>
              {/* Messages */}
              <div className={styles.messages}>
                {messages.map((m, i) => <Message key={i} msg={m} />)}
                {sending && (
                  <div className={`${styles.msg} ${styles.assistant}`}>
                    <div className={`${styles.msgBubble} ${styles.typing}`}>
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                {chatError && (
                  <div className={styles.chatError}>
                    <AlertCircle size={14} /> {chatError}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggested questions */}
              {messages.length <= 1 && (
                <div className={styles.suggested}>
                  {SUGGESTED.map((q, i) => (
                    <button key={i} onClick={() => { setQuestion(q); inputRef.current?.focus() }}
                      className={styles.suggestedBtn}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className={styles.inputRow}>
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask anything about this paper…"
                  className={styles.chatInput}
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!question.trim() || sending}
                  className={styles.sendBtn}
                >
                  {sending
                    ? <Loader2 size={16} className={styles.spin} />
                    : <Send size={16} />
                  }
                </button>
              </div>
            </>
          )}

          {activeTab === 'properties' && (
            <div className={styles.propertiesTab}>
              {extracting
                ? <div className={styles.extractLoading}>
                    <Loader2 size={28} className={styles.spin} />
                    <p>Extracting material properties…</p>
                  </div>
                : properties === null
                  ? <p className={styles.noProp}>
                      Click "Extract Properties" to auto-extract a table of mechanical
                      and material properties from this paper.
                    </p>
                  : <PropertyTable properties={properties} />
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}
