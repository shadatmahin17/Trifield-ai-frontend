import { useState, useRef, useCallback } from 'react'
import { Search, SlidersHorizontal, ExternalLink, BookOpen,
         FileText, ChevronDown, X, Loader2, AlertCircle, Download,
         Zap, Brain } from 'lucide-react'
import { searchPapers, streamSearch } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'
import styles from './SearchPage.module.css'

const DISCIPLINES = [
  { value: 'all',       label: 'All Disciplines' },
  { value: 'aerospace', label: 'Aerospace'        },
  { value: 'materials', label: 'Materials Science'},
  { value: 'textile',   label: 'Textile Engineering'},
]

const DISC_COLORS = {
  aerospace: { bg: 'rgba(133, 72, 54, 0.12)', color: '#854836', border: 'rgba(133, 72, 54, 0.24)' },
  materials: { bg: 'rgba(255, 178, 44, 0.18)', color: '#854836', border: 'rgba(255, 178, 44, 0.42)' },
  textile:   { bg: 'rgba(155, 85, 66, 0.10)', color: '#9B5542', border: 'rgba(155, 85, 66, 0.24)' },
  general:   { bg: 'rgba(110, 110, 110, 0.10)', color: '#6E6E6E', border: 'rgba(110, 110, 110, 0.22)' },
}

const EXAMPLE_QUERIES = [
  { q: 'jute flax hybrid composite mechanical properties', d: 'textile'   },
  { q: 'carbon fibre laminate fatigue damage',             d: 'aerospace' },
  { q: '3D woven composites progressive damage',           d: 'materials' },
  { q: 'piezoresistive strain sensing smart composites',   d: 'materials' },
]

const SOURCE_LABELS = {
  openalex: 'OpenAlex',
  crossref: 'Crossref',
  arxiv:    'arXiv',
  pubmed:   'PubMed',
}

function DisciplineBadge({ tag }) {
  const c = DISC_COLORS[tag] || DISC_COLORS.general
  return (
    <span className={styles.badge} style={{ background: c.bg, color: c.color, borderColor: c.border }}>
      {tag}
    </span>
  )
}

function QualityBar({ score }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? '#277A38' : pct >= 45 ? '#854836' : '#6E6E6E'
  return (
    <span className={styles.qualityWrap} title={`Quality score: ${pct}/100`}>
      <span className={styles.qualityTrack}>
        <span className={styles.qualityFill} style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className={styles.qualityLabel} style={{ color }}>{pct}</span>
    </span>
  )
}

function PaperCard({ paper, index }) {
  const [expanded, setExpanded] = useState(false)
  const hasAbstract = paper.abstract && paper.abstract.length > 10

  return (
    <article className={styles.card} style={{ animationDelay: `${index * 55}ms` }}>
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <DisciplineBadge tag={paper.discipline_tag} />
          {paper.year && <span className={styles.year}>{paper.year}</span>}
          {paper.citation_count > 0 && (
            <span className={styles.citations}>
              <BookOpen size={11} /> {paper.citation_count} cited
            </span>
          )}
          <QualityBar score={paper.quality_score} />
        </div>
        <div className={styles.cardActions}>
          {paper.open_access_url && (
            <a href={paper.open_access_url} target="_blank" rel="noopener noreferrer"
               className={styles.oaBtn} title="Open Access PDF">
              <Download size={13} /><span>PDF</span>
            </a>
          )}
          <a href={paper.url} target="_blank" rel="noopener noreferrer"
             className={styles.doiBtn} title="View paper">
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <h2 className={styles.title}>
        <a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.title}</a>
      </h2>

      {paper.authors?.length > 0 && (
        <p className={styles.authors}>
          {paper.authors.slice(0, 4).map(a => a.name).join(', ')}
          {paper.authors.length > 4 && ` +${paper.authors.length - 4} more`}
        </p>
      )}

      {paper.journal && (
        <p className={styles.journal}>
          <FileText size={12} />{paper.journal}
        </p>
      )}

      {hasAbstract && (
        <div className={styles.abstractWrap}>
          <p className={`${styles.abstract} ${expanded ? styles.expanded : ''}`}>
            {paper.abstract}
          </p>
          <button className={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Show less' : 'Read abstract'}
            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
      )}
      {!hasAbstract && (
        <p className={styles.noAbstract}>Abstract not available in open databases</p>
      )}
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skRow} style={{ width: '30%', height: 20 }} />
      <div className={styles.skRow} style={{ width: '90%', height: 22, marginTop: 12 }} />
      <div className={styles.skRow} style={{ width: '60%', height: 22, marginTop: 6 }} />
      <div className={styles.skRow} style={{ width: '45%', height: 16, marginTop: 10 }} />
      <div className={styles.skRow} style={{ width: '100%', height: 14, marginTop: 12 }} />
      <div className={styles.skRow} style={{ width: '80%', height: 14, marginTop: 4 }} />
    </div>
  )
}

function StreamStatus({ sourceStatus, rewrittenQuery, intent }) {
  const sources = Object.entries(SOURCE_LABELS)
  return (
    <div className={styles.streamStatus}>
      {(rewrittenQuery || intent) && (
        <div className={styles.rewriteBar}>
          {intent && (
            <span className={styles.intentTag}>
              <Brain size={11} /> {intent.replace(/_/g, ' ')}
            </span>
          )}
          {rewrittenQuery && (
            <span className={styles.rewriteText}>
              <Zap size={11} /> AI query: <em>"{rewrittenQuery}"</em>
            </span>
          )}
        </div>
      )}
      <div className={styles.sourceRow}>
        {sources.map(([key, label]) => {
          const st = sourceStatus[key]
          return (
            <span key={key} className={`${styles.sourceChip} ${st === 'done' ? styles.sourceDone : st === 'searching' ? styles.sourceSearching : st === 'error' ? styles.sourceError : ''}`}>
              {st === 'searching' && <span className={styles.sourceDot} />}
              {label}
              {st === 'done' && <span className={styles.sourceTick}>✓</span>}
              {st === 'error' && <span className={styles.sourceTick} style={{color:'#B42318'}}>✗</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function SearchPage() {
  const { incrementSearchCount } = useAuth()
  const [query,       setQuery]       = useState('')
  const [discipline,  setDisc]        = useState('all')
  const [yearFrom,    setYearFrom]    = useState('')
  const [yearTo,      setYearTo]      = useState('')
  const [limit,       setLimit]       = useState(10)
  const [showFilters, setShowFilters] = useState(false)
  const [useStream,   setUseStream]   = useState(true)

  const [results,     setResults]     = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  // streaming state
  const [sourceStatus,     setSourceStatus]     = useState({})
  const [rewrittenQuery,   setRewrittenQuery]   = useState('')
  const [intent,           setIntent]           = useState('')
  const [streamPhase,      setStreamPhase]      = useState('') // 'searching' | 'ranking' | ''

  const abortRef  = useRef(null)
  const inputRef  = useRef()

  const resetStreamState = () => {
    setSourceStatus({})
    setRewrittenQuery('')
    setIntent('')
    setStreamPhase('')
  }

  const handleSearch = useCallback(async (q = query, d = discipline) => {
    const trimmed = q.trim()
    if (!trimmed) return
    if (abortRef.current) abortRef.current.abort()

    // Increment searches stat count
    incrementSearchCount()

    setLoading(true)
    setError(null)
    setResults(null)
    resetStreamState()

    const opts = { query: trimmed, discipline: d, yearFrom: yearFrom || null, yearTo: yearTo || null, limit }

    if (useStream) {
      setStreamPhase('searching')
      abortRef.current = streamSearch(opts, (event, data) => {
        switch (event) {
          case 'start':
            break
          case 'rewrite':
            setRewrittenQuery(data.rewritten_query || '')
            setIntent(data.intent || '')
            break
          case 'source_complete':
            setSourceStatus(prev => ({ ...prev, [data.source]: 'done' }))
            break
          case 'source_error':
            setSourceStatus(prev => ({ ...prev, [data.source]: 'error' }))
            break
          case 'ranking':
            setStreamPhase('ranking')
            // Mark any not-yet-done sources as done
            setSourceStatus(prev => {
              const next = { ...prev }
              Object.keys(SOURCE_LABELS).forEach(k => { if (!next[k]) next[k] = 'done' })
              return next
            })
            break
          case 'results':
          case 'done':
            if (data.papers !== undefined) {
              setResults(data)
            }
            setStreamPhase('')
            setLoading(false)
            break
          case 'error':
            setError(data.message || 'Stream error')
            setStreamPhase('')
            setLoading(false)
            break
          default:
            break
        }
      })

      // Mark sources as 'searching' immediately
      setSourceStatus({ openalex: 'searching', crossref: 'searching', arxiv: 'searching', pubmed: 'searching' })
    } else {
      try {
        const data = await searchPapers(opts)
        setResults(data)
        if (data.interpreted_query) setRewrittenQuery(data.interpreted_query)
        if (data.intent)            setIntent(data.intent)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
  }, [query, discipline, yearFrom, yearTo, limit, useStream])

  const handleExample = (ex) => {
    setQuery(ex.q)
    setDisc(ex.d)
    handleSearch(ex.q, ex.d)
  }

  const clearSearch = () => {
    if (abortRef.current) abortRef.current.abort()
    setQuery('')
    setResults(null)
    setError(null)
    resetStreamState()
    inputRef.current?.focus()
  }

  const isSearching = loading || streamPhase !== ''

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      {!results && !isSearching && (
        <header className={styles.hero}>
          <p className={styles.heroEyebrow}>Research Workspace</p>
          <h1 className={styles.heroTitle}>
            Find papers across<br />
            <em>three disciplines</em>
          </h1>
          <p className={styles.heroSub}>
            OpenAlex · Crossref · arXiv · PubMed · Unpaywall — searched simultaneously
          </p>
        </header>
      )}

      {/* ── Search bar ── */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search papers… e.g. jute flax hybrid composite"
            className={styles.input}
            autoFocus
          />
          {query && (
            <button onClick={clearSearch} className={styles.clearBtn}><X size={15} /></button>
          )}
          <select value={discipline} onChange={e => setDisc(e.target.value)} className={styles.discSelect}>
            {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`${styles.filterBtn} ${showFilters ? styles.filterActive : ''}`}
            title="Advanced filters"
          >
            <SlidersHorizontal size={15} />
          </button>
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || isSearching}
            className={styles.searchBtn}
          >
            {isSearching ? <Loader2 size={16} className={styles.spin} /> : 'Search'}
          </button>
        </div>

        {showFilters && (
          <div className={styles.filters}>
            <label>
              <span>From year</span>
              <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                placeholder="e.g. 2010" min="1900" max="2026" />
            </label>
            <label>
              <span>To year</span>
              <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)}
                placeholder="e.g. 2024" min="1900" max="2026" />
            </label>
            <label>
              <span>Results</span>
              <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
                {[5, 10, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className={styles.streamToggle}>
              <input type="checkbox" checked={useStream} onChange={e => setUseStream(e.target.checked)} />
              <span>Live streaming</span>
            </label>
          </div>
        )}
      </div>

      {/* ── Example queries ── */}
      {!results && !isSearching && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLE_QUERIES.map((ex, i) => (
            <button key={i} onClick={() => handleExample(ex)} className={styles.exampleBtn}>
              {ex.q}
            </button>
          ))}
        </div>
      )}

      {/* ── Stream status ── */}
      {isSearching && (Object.keys(sourceStatus).length > 0 || rewrittenQuery) && (
        <StreamStatus sourceStatus={sourceStatus} rewrittenQuery={rewrittenQuery} intent={intent} />
      )}

      {/* ── Loading skeletons ── */}
      {isSearching && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <div className={styles.skRow} style={{ width: 160, height: 16, borderRadius: 4 }} />
            {streamPhase === 'ranking' && (
              <span className={styles.rankingBadge}>
                <Zap size={11} /> Ranking results…
              </span>
            )}
          </div>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className={styles.error}>
          <AlertCircle size={18} />
          <div>
            <strong>Search failed</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {results && !isSearching && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultCount}>
              {results.total} paper{results.total !== 1 ? 's' : ''} found
            </span>
            <span className={styles.resultQuery}>"{results.query}"</span>
            {results.discipline !== 'all' && <DisciplineBadge tag={results.discipline} />}

            {/* AI rewrite/intent bar in results */}
            {(rewrittenQuery || intent) && (
              <div className={styles.rewriteBarInline}>
                {intent && (
                  <span className={styles.intentTag}>
                    <Brain size={11} /> {intent.replace(/_/g, ' ')}
                  </span>
                )}
                {rewrittenQuery && rewrittenQuery !== results.query && (
                  <span className={styles.rewriteText}>
                    <Zap size={11} /> AI rewrote: <em>"{rewrittenQuery}"</em>
                  </span>
                )}
              </div>
            )}
          </div>

          {results.papers.length === 0 ? (
            <div className={styles.empty}>
              <Search size={32} />
              <p>No papers matched your query. Try broader search terms.</p>
            </div>
          ) : (
            results.papers.map((paper, i) => (
              <PaperCard key={paper.paper_id} paper={paper} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
