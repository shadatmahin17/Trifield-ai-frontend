/**
 * TriField AI — Community Library
 * SciSpace-style table with add/remove columns and on-demand LLM extraction.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLibrary, getLibraryStats, getLibraryColumnTypes, getLibraryPaper, uploadToLibrary, extractColumn, deleteLibraryPaper } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'

// All 18+2 available columns (matches backend COLUMN_DEFINITIONS)
const ALL_COLUMNS = [
  { key: 'tldr', label: 'TL;DR' },
  { key: 'summarized_abstract', label: 'Summarized Abstract' },
  { key: 'results', label: 'Results' },
  { key: 'summarized_introduction',label: 'Summarized Introduction' },
  { key: 'methods_used', label: 'Methods Used' },
  { key: 'literature_survey', label: 'Literature Survey' },
  { key: 'limitations', label: 'Limitations' },
  { key: 'contributions', label: 'Contributions' },
  { key: 'practical_implications', label: 'Practical Implications' },
  { key: 'objectives', label: 'Objectives' },
  { key: 'findings', label: 'Findings' },
  { key: 'research_gap', label: 'Research Gap' },
  { key: 'future_research', label: 'Future Research' },
  { key: 'dependent_variables', label: 'Dependent Variables' },
  { key: 'independent_variables', label: 'Independent Variables' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'population_sample', label: 'Population / Sample' },
  { key: 'problem_statement', label: 'Problem Statement' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'applications', label: 'Applications' },
]

const DISCIPLINE_COLORS = {
  aerospace: { bg:'rgba(59,139,212,0.12)', color:'#185FA5', label:'Aerospace' },
  materials: { bg:'rgba(133,72,54,0.12)', color:'#854836', label:'Materials' },
  textile: { bg:'rgba(39,122,56,0.12)', color:'#277A38', label:'Textile' },
  general: { bg:'rgba(110,110,110,0.10)',color:'#6E6E6E', label:'General' },
}

function Badge({ discipline }) {
  const d = DISCIPLINE_COLORS[discipline] || DISCIPLINE_COLORS.general
  return (
    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:d.bg, color:d.color, fontWeight:500, whiteSpace:'nowrap' }}>
      {d.label}
    </span>
  )
}

function Spinner({ size=14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'tfSpin 0.75s linear infinite', flexShrink:0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
    </svg>
  )
}

// ── Column cell with on-demand extraction ──────────────────────────────────
function ColumnCell({ paper, columnKey, cachedValue, onExtracted }) {
  const [value, setValue] = useState(cachedValue || null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setValue(cachedValue || null)
  }, [cachedValue])

  const extract = async (e) => {
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await extractColumn(paper.id, columnKey)
      setValue(res.content)
      onExtracted?.(paper.id, columnKey, res.content)
    } catch(err) {
      setValue('Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  const PREVIEW_LEN = 120
  const preview = value ? (value.length > PREVIEW_LEN && !expanded ? value.slice(0, PREVIEW_LEN) + '…' : value) : null

  return (
    <td style={{ padding:'12px 14px', verticalAlign:'top', minWidth:200, maxWidth:300, borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:12, lineHeight:1.6 }}>
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:6, color:'#854836' }}>
          <Spinner size={12}/>
          <span style={{ fontSize:11 }}>Extracting…</span>
        </div>
      ) : value ? (
        <div>
          <div style={{ color:'#333', whiteSpace:'pre-wrap' }}>{preview}</div>
          {value.length > PREVIEW_LEN && (
            <button onClick={e => { e.stopPropagation(); setExpanded(x => !x) }} style={{ background:'none', border:'none', color:'#854836', fontSize:10, cursor:'pointer', padding:'2px 0', fontFamily:'inherit', marginTop:2 }}>
              {expanded ? 'Show less ↑' : 'Read more ↓'}
            </button>
          )}
        </div>
      ) : (
        <button onClick={extract} style={{ background:'rgba(133,72,54,0.08)', border:'1px dashed rgba(133,72,54,0.30)', borderRadius:6, color:'#854836', fontSize:11, fontFamily:'inherit', padding:'4px 10px', cursor:'pointer', transition:'all 0.15s' }}>
          Extract
        </button>
      )}
    </td>
  )
}

// ── Column picker dropdown ──────────────────────────────────────────────────
function ColumnPicker({ activeColumns, onToggle, onClose }) {
  return (
    <div style={{ position:'absolute', top:'100%', right:0, zIndex:100, marginTop:4, background:'#fff', border:'1px solid rgba(0,0,0,0.12)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', width:280, maxHeight:420, overflowY:'auto', padding:'8px 0' }}>
      <div style={{ padding:'8px 14px 4px', fontSize:11, color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid rgba(0,0,0,0.06)', marginBottom:4 }}>
        Suggested columns
      </div>
      {ALL_COLUMNS.map(col => {
        const active = activeColumns.includes(col.key)
        return (
          <button key={col.key} onClick={() => onToggle(col.key)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, background: active ? 'rgba(133,72,54,0.07)' : 'none', border:'none', padding:'8px 14px', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'background 0.1s' }}>
            <span style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${active ? '#854836' : 'rgba(0,0,0,0.20)'}`, background: active ? '#854836' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {active && <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>}
            </span>
            <span style={{ fontSize:13, color:'#222' }}>{col.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Delete Confirmation modal ────────────────────────────────────────────────
function DeleteConfirmationModal({ onClose, onConfirm, title, message, actionText = 'Delete' }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:14, padding:24, width:380, boxShadow:'0 24px 64px rgba(0,0,0,0.18)', animation:'tfFadeUp 0.15s ease both' }}>
        <h3 style={{ fontSize:15, fontWeight:600, color:'#000', margin:'0 0 10px 0' }}>
          {title}
        </h3>
        <p style={{ fontSize:13, color:'#555', margin:'0 0 20px 0', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, color:'#6E6E6E', fontFamily:'inherit', fontSize:13, padding:'8px 16px', cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ background:'#DC3232', border:'none', borderRadius:8, color:'#fff', fontFamily:'inherit', fontSize:13, fontWeight:500, padding:'8px 18px', cursor:'pointer' }}>
            {actionText}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Upload modal ────────────────────────────────────────────────────────────
function UploadModal({ onClose, onUploaded }) {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [discipline,setDisc] = useState('general')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const result = await uploadToLibrary(file, discipline, user?.email || 'anonymous')
      onUploaded(result)
    } catch(e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:14, padding:28, width:420, boxShadow:'0 24px 64px rgba(0,0,0,0.18)', animation:'tfFadeUp 0.25s ease both' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:500, color:'#000', margin:0 }}>
            Upload to Library
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6E6E6E', padding:4, display:'flex', alignItems:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* File drop zone */}
        <div 
          onClick={() => fileRef.current?.click()} 
          onDragOver={e => { e.preventDefault() }} 
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }} 
          style={{ border:`2px dashed ${file ? '#854836' : 'rgba(0,0,0,0.15)'}`, borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer', marginBottom:16, background: file ? 'rgba(133,72,54,0.04)' : '#FAFAFA', transition:'all 0.2s' }}
        >
          {file ? (
            <div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#854836" strokeWidth="1.5" style={{ margin:'0 auto 8px' }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p style={{ fontSize:13, color:'#854836', margin:0, fontWeight:500 }}>{file.name}</p>
              <p style={{ fontSize:11, color:'#6E6E6E', margin:'4px 0 0' }}>
                {(file.size/1024/1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6E6E6E" strokeWidth="1.5" style={{ margin:'0 auto 8px' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize:13, color:'#6E6E6E', margin:0 }}>
                Drag & drop PDF or click to browse
              </p>
              <p style={{ fontSize:11, color:'#aaa', margin:'4px 0 0' }}>Max 20MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e => setFile(e.target.files[0])}/>
        </div>

        {/* Discipline */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, color:'#6E6E6E', display:'block', marginBottom:6 }}>
            Discipline
          </label>
          <select value={discipline} onChange={e => setDisc(e.target.value)} style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid rgba(0,0,0,0.12)', fontFamily:'inherit', fontSize:13, color:'#222', background:'#fff', outline:'none' }}>
            <option value="general">General</option>
            <option value="aerospace">Aerospace</option>
            <option value="materials">Materials Science</option>
            <option value="textile">Textile Engineering</option>
          </select>
        </div>

        {error && (
          <div style={{ background:'rgba(180,35,24,0.08)', border:'1px solid rgba(180,35,24,0.20)', borderRadius:8, padding:'8px 12px', color:'#B42318', fontSize:12, marginBottom:16 }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, color:'#6E6E6E', fontFamily:'inherit', fontSize:13, padding:'8px 18px', cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={handleUpload} disabled={!file || uploading} style={{ background: file && !uploading ? '#854836' : 'rgba(133,72,54,0.30)', border:'none', borderRadius:8, color:'#fff', fontFamily:'inherit', fontSize:13, fontWeight:500, padding:'8px 20px', cursor: file && !uploading ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', gap:8, transition:'all 0.2s' }}>
            {uploading ? <><Spinner size={13}/> Uploading…</> : 'Upload to Library'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Library page ──────────────────────────────────────────────────────
export default function LibraryPage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [papers, setPapers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [discipline, setDisc] = useState('all')
  const [activeColumns, setActiveCols] = useState(['tldr'])
  const [showPicker, setShowPicker] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState(null)
  const [colCache, setColCache] = useState({}) // {paperId: {colKey: value}}
  const [sortBy, setSortBy] = useState('created_at')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [deleteTarget, setDeleteTarget] = useState(null) // { paperId, title, isBulk, count }
  const pickerRef = useRef()

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setError(null)
    try {
      if (deleteTarget.isBulk) {
        await Promise.all(Array.from(selectedRows).map(id => deleteLibraryPaper(id)))
        setSelectedRows(new Set())
      } else {
        await deleteLibraryPaper(deleteTarget.paperId)
        setSelectedRows(prev => {
          const next = new Set(prev)
          next.delete(deleteTarget.paperId)
          return next
        })
      }
      setDeleteTarget(null)
      loadLibrary()
    } catch(err) {
      setError(err.message)
      setDeleteTarget(null)
    }
  }

  const canDeletePaper = useCallback((paper) => {
    return true
  }, [])

  const loadLibrary = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [libRes, statsRes] = await Promise.all([
        getLibrary({
          discipline: discipline === 'all' ? undefined : discipline,
          search: search || undefined,
          limit: 100
        }),
        getLibraryStats(),
      ])
      setPapers(libRes.papers || [])
      setStats(statsRes)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [discipline, search])

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  // Close picker on outside click
  useEffect(() => {
    const fn = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const toggleColumn = (key) => {
    setActiveCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key] )
  }

  const onExtracted = (paperId, colKey, value) => {
    setColCache(prev => ({
      ...prev,
      [paperId]: {
        ...(prev[paperId] || {}),
        [colKey]: value
      }
    }))
  }

  const onUploaded = (result) => {
    setShowUpload(false)
    loadLibrary()
  }

  const toggleRow = (id) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deletablePapers = papers.filter(canDeletePaper)

  const toggleAll = () => {
    setSelectedRows(prev => {
      const allDeletableSelected = deletablePapers.length > 0 && deletablePapers.every(p => prev.has(p.id))
      if (allDeletableSelected) {
        return new Set()
      } else {
        return new Set(deletablePapers.map(p => p.id))
      }
    })
  }

  const sortedPapers = [...papers].sort((a, b) => {
    if (sortBy === 'created_at') return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy === 'title') return (a.title||'').localeCompare(b.title||'')
    if (sortBy === 'year') return (b.year||0) - (a.year||0)
    return 0
  })

  const activeColDefs = ALL_COLUMNS.filter(c => activeColumns.includes(c.key))

  return (
    <>
      <style>{`
        @keyframes tfFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes tfSpin { to{transform:rotate(360deg)} }
        .lib-row:hover { background: rgba(133,72,54,0.03) !important; }
        .lib-row:hover .lib-actions { opacity:1 !important; }
        .col-btn:hover { background: rgba(133,72,54,0.10) !important; border-color: rgba(133,72,54,0.30) !important; }
      `}</style>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, position: 'relative' }}>
        
        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:500, color:'#000', margin:0, letterSpacing:'-0.02em' }}>
              Community Library
            </h1>
            {stats && (
              <p style={{ fontSize:12, color:'#6E6E6E', margin:'3px 0 0' }}>
                {stats.total_papers} papers · shared by the TriField community
              </p>
            )}
          </div>
          <button onClick={() => setShowUpload(true)} style={{ background:'#854836', border:'none', borderRadius:8, color:'#fff', fontFamily:'inherit', fontSize:13, fontWeight:500, padding:'9px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 14px rgba(133,72,54,0.30)', transition:'all 0.2s' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Upload PDFs
          </button>
        </div>

        {/* ── Filters bar ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
          {/* Search */}
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E6E6E" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search papers by title, abstract…" style={{ width:'100%', paddingLeft:32, padding:'8px 12px 8px 32px', border:'1px solid rgba(0,0,0,0.10)', borderRadius:8, fontFamily:'inherit', fontSize:13, color:'#222', outline:'none', background:'#fff', boxSizing:'border-box' }}/>
          </div>

          {/* Discipline filter */}
          <select value={discipline} onChange={e => setDisc(e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(0,0,0,0.10)', borderRadius:8, fontFamily:'inherit', fontSize:13, color:'#222', background:'#fff', outline:'none' }}>
            <option value="all">All disciplines</option>
            <option value="aerospace">Aerospace</option>
            <option value="materials">Materials</option>
            <option value="textile">Textile</option>
            <option value="general">General</option>
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding:'8px 12px', border:'1px solid rgba(0,0,0,0.10)', borderRadius:8, fontFamily:'inherit', fontSize:13, color:'#222', background:'#fff', outline:'none' }}>
            <option value="created_at">Sort: Newest</option>
            <option value="title">Sort: Title A–Z</option>
            <option value="year">Sort: Year</option>
          </select>

          {/* Add columns */}
          <div ref={pickerRef} style={{ position:'relative' }}>
            <button className="col-btn" onClick={() => setShowPicker(x => !x)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid rgba(0,0,0,0.10)', borderRadius:8, background:'#fff', fontFamily:'inherit', fontSize:13, color:'#222', cursor:'pointer', transition:'all 0.15s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              Add columns {activeColumns.length > 0 && `(${activeColumns.length})`}
            </button>
            {showPicker && (
              <ColumnPicker activeColumns={activeColumns} onToggle={toggleColumn} onClose={() => setShowPicker(false)} />
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background:'rgba(180,35,24,0.08)', border:'1px solid rgba(180,35,24,0.20)', borderRadius:8, padding:'10px 14px', color:'#B42318', fontSize:12, marginBottom:12 }}>
            {error}
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ flex:1, overflowX:'auto', overflowY:'auto', borderRadius:10, border:'1px solid rgba(0,0,0,0.08)', background:'#fff' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, gap:12, color:'#6E6E6E' }}>
              <Spinner size={22}/>
              <span style={{ fontSize:13 }}>Loading library…</span>
            </div>
          ) : papers.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, gap:12, color:'#6E6E6E' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V4h16v13H6.5"/>
              </svg>
              <p style={{ fontSize:13, margin:0 }}>No papers yet — upload the first one!</p>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead style={{ position:'sticky', top:0, zIndex:10, background:'#F9F9F9' }}>
                <tr>
                  {/* Checkbox */}
                  <th style={{ width:40, padding:'10px 14px', textAlign:'center', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
                    <input type="checkbox" checked={deletablePapers.length > 0 && deletablePapers.every(p => selectedRows.has(p.id))} onChange={toggleAll} style={{ cursor:'pointer' }}/>
                  </th>
                  {/* Files column */}
                  <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:500, color:'#6E6E6E', fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', borderBottom:'1px solid rgba(0,0,0,0.08)', minWidth:280, whiteSpace:'nowrap' }}>
                    Files ({papers.length}/{papers.length})
                  </th>
                  {/* Active columns */}
                  {activeColDefs.map(col => (
                    <th key={col.key} style={{ padding:'10px 14px', textAlign:'left', fontWeight:500, color:'#6E6E6E', fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', borderBottom:'1px solid rgba(0,0,0,0.08)', minWidth:220, whiteSpace:'nowrap', position:'relative' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {col.label}
                        <button onClick={() => toggleColumn(col.key)} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', padding:0, display:'flex', alignItems:'center', lineHeight:1, marginLeft:'auto' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPapers.map(paper => (
                  <tr key={paper.id} className="lib-row" style={{ background:'transparent', transition:'background 0.1s' }}>
                    {/* Checkbox */}
                    <td style={{ padding:'10px 14px', textAlign:'center', borderBottom:'1px solid rgba(0,0,0,0.06)', verticalAlign:'top' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedRows.has(paper.id)} 
                        onChange={() => toggleRow(paper.id)} 
                        onClick={e => e.stopPropagation()} 
                        style={{ cursor: 'pointer', marginTop:4 }}
                      />
                    </td>
                    {/* Paper info column */}
                    <td style={{ padding:'12px 14px', borderBottom:'1px solid rgba(0,0,0,0.06)', verticalAlign:'top', minWidth:280 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                        {/* PDF icon */}
                        <div style={{ width:32, height:32, borderRadius:6, flexShrink:0, background:'rgba(220,50,50,0.10)', border:'1px solid rgba(220,50,50,0.15)', display:'flex', alignItems:'center', justifyContent:'center', marginTop:2 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC3232" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Title */}
                          <p style={{ margin:'0 0 3px', fontWeight:500, fontSize:13, color:'#000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }} title={paper.title || paper.filename}>
                            {paper.title || paper.filename}
                          </p>
                          {/* Authors */}
                          {paper.authors?.length > 0 && (
                            <p style={{ margin:'0 0 2px', fontSize:11, color:'#854836' }}>
                              {paper.authors.slice(0,2).join(', ')}
                              {paper.authors.length > 2 ? ` +${paper.authors.length-2} more` : ''}
                            </p>
                          )}
                          {/* DOI */}
                          {paper.doi && (
                            <p style={{ margin:'0 0 2px', fontSize:10, color:'#6E6E6E', fontFamily:'JetBrains Mono,monospace' }}>
                              {paper.doi}
                            </p>
                          )}
                          {/* Journal + year */}
                          {(paper.journal || paper.year) && (
                            <p style={{ margin:'0 0 6px', fontSize:11, color:'#6E6E6E' }}>
                              {paper.year && <span>{paper.year}</span>}
                              {paper.journal && paper.year && <span> · </span>}
                              {paper.journal && <span>{paper.journal}</span>}
                            </p>
                          )}
                          {/* Discipline + actions */}
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            <Badge discipline={paper.discipline}/>
                            <div className="lib-actions" style={{ display:'flex', gap:5, opacity:0, transition:'opacity 0.15s' }}>
                              <button onClick={e => { e.stopPropagation(); navigate(`/pdf?session=${paper.session_id || paper.id}`) }} style={{ background:'rgba(133,72,54,0.10)', border:'none', borderRadius:6, color:'#854836', fontFamily:'inherit', fontSize:10, fontWeight:500, padding:'3px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                                </svg>
                                Chat
                              </button>
                              {paper.r2_url && (
                                <a href={paper.r2_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ background:'rgba(0,0,0,0.05)', border:'none', borderRadius:6, color:'#6E6E6E', fontSize:10, fontWeight:500, padding:'3px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round"/>
                                  </svg>
                                  PDF
                                </a>
                              )}
                              {canDeletePaper(paper) && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteTarget({
                                      paperId: paper.id,
                                      title: paper.filename || paper.title || 'this paper',
                                      isBulk: false
                                    })
                                  }} 
                                  style={{ background:'rgba(220,50,50,0.10)', border:'none', borderRadius:6, color:'#DC3232', fontFamily:'inherit', fontSize:10, fontWeight:500, padding:'3px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Extraction columns */}
                    {activeColDefs.map(col => (
                      <ColumnCell key={col.key} paper={paper} columnKey={col.key} cachedValue={colCache[paper.id]?.[col.key] || paper.extracted_columns?.[col.key]} onExtracted={onExtracted} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Floating Action Bar for Selected Rows ── */}
        {selectedRows.size > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1A1A1A',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            zIndex: 100,
            animation: 'tfFadeUp 0.25s ease both'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{selectedRows.size} selected</span>
            <button
              onClick={() => {
                setDeleteTarget({
                  isBulk: true,
                  count: selectedRows.size
                })
              }}
              style={{
                background: '#DC3232',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              Delete Selected
            </button>
          </div>
        )}

        {/* ── Footer stats ── */}
        {stats && !loading && (
          <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
            {Object.entries(stats.by_discipline || {}).map(([disc, count]) => (
              <span key={disc} style={{ fontSize:11, color:'#6E6E6E' }}>
                {disc}: <strong style={{ color:'#222' }}>{count}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={onUploaded}/>
      )}

      {/* Delete Confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmationModal 
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title={deleteTarget.isBulk ? "Delete Selected Papers?" : "Delete Paper?"}
          message={
            deleteTarget.isBulk 
              ? `Are you sure you want to permanently delete these ${deleteTarget.count} selected papers from your library and storage? This action cannot be undone.`
              : `Are you sure you want to permanently delete "${deleteTarget.title}"? This action cannot be undone.`
          }
          actionText="Delete permanently"
        />
      )}
    </>
  )
}
