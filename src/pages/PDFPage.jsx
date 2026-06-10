import { useState, useRef, useEffect, useCallback } from 'react'
import {
  uploadPDF, chatWithPDF, extractProperties,
  listPDFSessions, getPDFSession, deletePDFSession, getPDFDownloadUrl,
} from '../lib/api.js'
import {
  FileText, Upload, Trash2, Download, Clock, MessageSquare,
  Database, Loader2, X, ChevronRight, ExternalLink,
} from 'lucide-react'
import styles from './PDFPage.module.css'

// ── helpers ────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
}

const SUGGESTIONS = [
  'What is the main contribution?',
  'Summarise the key results.',
  'What methodology was used?',
  'What material properties were reported?',
  'What are the limitations?',
  'What future work is suggested?',
]

// ── Sub-components ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className={styles.typingDots}>
      {[0,1,2].map(i => <span key={i} style={{ animationDelay:`${i*0.2}s` }} />)}
    </div>
  )
}

function SessionCard({ session, onOpen, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete "${session.filename}"?\nThis removes the file, embeddings, and chat history.`)) return
    setDeleting(true)
    try { await onDelete(session.session_id) }
    catch { setDeleting(false) }
  }

  return (
    <div className={styles.sessionCard} onClick={() => onOpen(session.session_id)}>
      <div className={styles.sessionIcon}>
        <FileText size={16} />
      </div>
      <div className={styles.sessionInfo}>
        <span className={styles.sessionName}>{session.filename}</span>
        <span className={styles.sessionMeta}>
          {fmtSize(session.size_bytes)} · {session.chunk_count} chunks · {fmtDate(session.created_at)}
        </span>
        {session.history?.length > 0 && (
          <span className={styles.sessionHistory}>
            <MessageSquare size={10} /> {session.history.length / 2 | 0} exchanges
          </span>
        )}
      </div>
      <div className={styles.sessionActions}>
        <ChevronRight size={14} className={styles.sessionChevron} />
        <button
          className={styles.sessionDeleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          title="Delete session"
        >
          {deleting ? <Loader2 size={13} className={styles.spin} /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  )
}

function SessionsLibrary({ onSelectSession, onUploadClick }) {
  const [sessions, setSessions]   = useState([])
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await listPDFSessions(50)
      setSessions(data.sessions || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (sessionId) => {
    await deletePDFSession(sessionId)
    setSessions(prev => prev.filter(s => s.session_id !== sessionId))
  }

  return (
    <div className={styles.library}>
      <div className={styles.libraryHeader}>
        <div className={styles.libraryTitle}>
          <Database size={16} />
          <span>PDF Library</span>
          {sessions.length > 0 && (
            <span className={styles.libraryCount}>{sessions.length}</span>
          )}
        </div>
        <button className={styles.uploadNewBtn} onClick={onUploadClick}>
          <Upload size={13} /> Upload new
        </button>
      </div>

      {loading && (
        <div className={styles.libraryCentered}>
          <Loader2 size={22} className={styles.spin} style={{ color: '#854836' }} />
          <p>Loading library…</p>
        </div>
      )}

      {error && (
        <div className={styles.libraryError}>
          <p>Could not load library: {error}</p>
          <button onClick={load} className={styles.retryBtn}>Retry</button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className={styles.libraryCentered}>
          <FileText size={32} strokeWidth={1} style={{ color: '#854836', opacity: 0.4 }} />
          <p>No PDFs yet — upload your first paper above.</p>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className={styles.sessionList}>
          {sessions.map(s => (
            <SessionCard
              key={s.session_id}
              session={s}
              onOpen={onSelectSession}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChatPanel({ sessionId, filename, messages, setMessages, onReset, downloadUrl }) {
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [properties, setProps]      = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [tab,        setTab]        = useState('chat')
  const [error,      setError]      = useState(null)
  const [dlUrl,      setDlUrl]      = useState(downloadUrl || null)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  // Fetch signed download URL if not provided
  useEffect(() => {
    if (!dlUrl && sessionId) {
      getPDFDownloadUrl(sessionId)
        .then(d => setDlUrl(d.url))
        .catch(() => {})
    }
  }, [sessionId])

  const send = async (q) => {
    const question = (q || input).trim()
    if (!question || sending || !sessionId) return
    setInput(''); setError(null)
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setSending(true)
    try {
      const data = await chatWithPDF(sessionId, question)
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }])
    } catch (e) {
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
    } catch (e) { setError(e.message) }
    finally { setExtracting(false) }
  }

  const renderContent = (text) =>
    text.split('\n').map((line, i) => (
      <p key={i} style={{ marginBottom: line ? 4 : 0 }}
         dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '&nbsp;' }} />
    ))

  return (
    <div className={styles.chatPanel}>
      {/* Panel header */}
      <div className={styles.panelHeader}>
        <div className={styles.panelFile}>
          <FileText size={14} className={styles.panelFileIcon} />
          <span className={styles.panelFileName}>{filename}</span>
        </div>
        <div className={styles.panelHeaderActions}>
          {dlUrl && (
            <a href={dlUrl} target="_blank" rel="noopener noreferrer"
               className={styles.panelDlBtn} title="Download original PDF">
              <Download size={13} /> PDF
            </a>
          )}
          <button className={styles.panelCloseBtn} onClick={onReset} title="Back to library">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['chat', 'properties'].map(t => (
          <button
            key={t}
            onClick={() => t === 'properties' && !properties ? extract() : setTab(t)}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
          >
            {t === 'properties'
              ? `Properties${properties?.length ? ` (${properties.length})` : ''}`
              : 'Chat'
            }
          </button>
        ))}
      </div>

      {tab === 'chat' ? (
        <>
          {/* Messages */}
          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.userMsg : styles.asstMsg}`}>
                {m.role === 'assistant' && (
                  <div className={styles.asstAvatar}>AI</div>
                )}
                <div className={styles.msgBubble}>
                  {renderContent(m.content)}
                  {m.sources?.length > 0 && (
                    <p className={styles.sources}>ref: {m.sources.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className={`${styles.msg} ${styles.asstMsg}`}>
                <div className={styles.asstAvatar}>AI</div>
                <div className={`${styles.msgBubble} ${styles.typingBubble}`}><TypingDots /></div>
              </div>
            )}
            {error && (
              <div className={styles.chatError}>{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} className={styles.suggBtn}>{s}</button>
              ))}
              <button onClick={extract} className={`${styles.suggBtn} ${styles.suggExtract}`}>
                ⊞ Extract properties table
              </button>
            </div>
          )}

          {/* Input */}
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask anything about this paper… (Enter to send)"
              rows={1}
              disabled={sending}
              className={styles.chatInput}
            />
            <button onClick={() => send()} disabled={!input.trim() || sending} className={styles.sendBtn}>
              {sending
                ? <Loader2 size={15} className={styles.spin} />
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </>
      ) : (
        /* Properties tab */
        <div className={styles.propsTab}>
          {extracting ? (
            <div className={styles.propsLoading}>
              <Loader2 size={24} className={styles.spin} style={{ color: '#854836' }} />
              <p>Extracting material properties…</p>
            </div>
          ) : properties?.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.propTable}>
                <thead>
                  <tr>
                    {['Property', 'Value', 'Unit', 'Standard'].map(h => <th key={h}>{h}</th>)}
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
          ) : (
            <p className={styles.noProps}>
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

// ── Upload drop zone ────────────────────────────────────────────────────────

function UploadZone({ onFile, error }) {
  const fileInputRef = useRef()
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dragging : ''}`}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]) }}
    >
      <div className={styles.uploadIcon}>
        <Upload size={24} />
      </div>
      <div>
        <p className={styles.uploadTitle}>Drop a PDF or click to browse</p>
        <p className={styles.uploadSub}>Max 20 MB · Any research paper</p>
      </div>
      {error && <p className={styles.uploadError}>{error}</p>}
      <input
        ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => onFile(e.target.files[0])}
      />
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function PDFPage() {
  // Active session state
  const [sessionId,   setSessionId]   = useState(null)
  const [filename,    setFilename]     = useState(null)
  const [messages,    setMessages]     = useState([])
  const [downloadUrl, setDownloadUrl]  = useState(null)
  const [uploading,   setUploading]    = useState(false)
  const [uploadError, setUploadError]  = useState(null)
  // View: 'library' | 'chat'
  const [view, setView] = useState('library')
  // Library refresh key
  const [libraryKey, setLibraryKey] = useState(0)

  const handleFile = async (file) => {
    if (!file?.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a PDF file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File too large. Max 20 MB.')
      return
    }
    setUploading(true); setUploadError(null)
    try {
      const data = await uploadPDF(file)
      setSessionId(data.session_id)
      setFilename(file.name)
      setMessages([{
        role: 'assistant',
        content: `**${file.name}** uploaded and indexed ✓\n\nAsk me anything — methodology, results, material properties, conclusions, or any specific section.`,
      }])
      setDownloadUrl(null)
      setView('chat')
      setLibraryKey(k => k + 1) // refresh library next time it's shown
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSelectSession = async (sid) => {
    try {
      const data = await getPDFSession(sid)
      setSessionId(data.session_id)
      setFilename(data.filename)
      // Restore chat history as messages
      const restored = (data.history || []).map(m => ({
        role:    m.role,
        content: m.content,
      }))
      setMessages(
        restored.length > 0
          ? restored
          : [{ role: 'assistant', content: `**${data.filename}** — session restored.\n\nContinue the conversation or ask a new question.` }]
      )
      setDownloadUrl(data.download_url || null)
      setView('chat')
    } catch (e) {
      alert('Could not load session: ' + e.message)
    }
  }

  const handleReset = () => {
    setSessionId(null); setFilename(null)
    setMessages([]); setDownloadUrl(null)
    setView('library')
    setLibraryKey(k => k + 1)
  }

  return (
    <div className={styles.page}>

      {view === 'library' || view === 'upload' ? (
        <>
          {/* Upload zone */}
          {uploading ? (
            <div className={styles.uploadingState}>
              <Loader2 size={28} className={styles.spin} style={{ color: '#854836' }} />
              <p>Uploading and indexing…</p>
            </div>
          ) : (
            <UploadZone onFile={handleFile} error={uploadError} />
          )}

          {/* Sessions library */}
          {!uploading && (
            <SessionsLibrary
              key={libraryKey}
              onSelectSession={handleSelectSession}
              onUploadClick={() => {}}
            />
          )}
        </>
      ) : (
        /* Chat view */
        <ChatPanel
          sessionId={sessionId}
          filename={filename}
          messages={messages}
          setMessages={setMessages}
          onReset={handleReset}
          downloadUrl={downloadUrl}
        />
      )}
    </div>
  )
}
