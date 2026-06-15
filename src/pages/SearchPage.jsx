import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, SlidersHorizontal, ExternalLink, BookOpen,
         FileText, ChevronDown, X, Loader2, AlertCircle, Download,
         Zap, Brain, Calendar, Sparkles, Award, Copy, Check } from 'lucide-react'
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
  aerospace: { bg: 'rgba(133, 72, 54, 0.08)', color: '#854836', border: 'rgba(133, 72, 54, 0.20)', accent: '#854836' },
  materials: { bg: 'rgba(255, 178, 44, 0.12)', color: '#854836', border: 'rgba(255, 178, 44, 0.28)', accent: '#FFB22C' },
  textile:   { bg: 'rgba(155, 85, 66, 0.08)', color: '#9B5542', border: 'rgba(155, 85, 66, 0.20)', accent: '#9B5542' },
  general:   { bg: 'rgba(110, 110, 110, 0.08)', color: '#6E6E6E', border: 'rgba(110, 110, 110, 0.18)', accent: '#6E6E6E' },
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
    <div className={styles.qualityBadge} style={{ borderColor: `${color}28` }} title={`TriField Quality Score: ${pct}%`}>
      <Zap size={11} style={{ color }} />
      <span className={styles.qualityText}>QS {pct}%</span>
      <span className={styles.qualityTrack}>
        <span className={styles.qualityFill} style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  )
}

function PaperCard({ paper, index }) {
  const [expanded, setExpanded] = useState(false)
  const [referenced, setReferenced] = useState(false)
  const hasAbstract = paper.abstract && paper.abstract.length > 10

  const handleCopyCitation = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const authorSeq = paper.authors?.length > 0
      ? paper.authors.slice(0, 3).map(a => a.name).join(', ') + (paper.authors.length > 3 ? ' et al.' : '')
      : 'Unknown Authors'
    const yearStr = paper.year ? ` (${paper.year})` : ''
    const journalStr = paper.journal ? `, *${paper.journal}*` : ''
    const urlStr = paper.url ? `. Available at: ${paper.url}` : ''
    const citationText = `${authorSeq}${yearStr}. "${paper.title}"${journalStr}${urlStr}`

    navigator.clipboard.writeText(citationText)
    setReferenced(true)
    setTimeout(() => setReferenced(false), 2000)
  }

  const dTag = paper.discipline_tag || 'general'
  const cardClass = `${styles.card} ${
    dTag === 'aerospace' ? styles.cardAerospace :
    dTag === 'materials' ? styles.cardMaterials :
    dTag === 'textile' ? styles.cardTextile : styles.cardGeneral
  }`

  return (
    <article className={cardClass} style={{ animationDelay: `${index * 55}ms` }}>
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <DisciplineBadge tag={paper.discipline_tag} />
          {paper.year && (
            <span className={styles.year}>
              <Calendar size={11} style={{ marginRight: 2 }} /> {paper.year}
            </span>
          )}
          {paper.citation_count > 0 && (
            <span className={styles.citations}>
              <BookOpen size={11} /> {paper.citation_count} cited
            </span>
          )}
          <QualityBar score={paper.quality_score} />
        </div>
        <div className={styles.cardActions}>
          <button 
            onClick={handleCopyCitation} 
            className={styles.copyCitationBtn} 
            title="Copy reference info"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {referenced ? <Check size={13} style={{ color: '#277A38' }} /> : <Copy size={13} />}
            <span>{referenced ? 'Copied' : 'Reference'}</span>
          </button>
          {paper.open_access_url && (
            <a href={paper.open_access_url} target="_blank" rel="noopener noreferrer"
               className={styles.oaBtn} title="Open Access PDF">
              <Download size={13} /><span>PDF</span>
            </a>
          )}
          <a href={paper.url} target="_blank" rel="noopener noreferrer"
             className={styles.doiBtn} title="View paper link">
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
      <div className={styles.streamHeader}>
        <div className={styles.streamPulseIndicator}>
          <span className={styles.livePulseDot} />
          <span className={styles.streamEngineTitle}>Academic Search Matrix</span>
        </div>
      </div>
      {(rewrittenQuery || intent) && (
        <div className={styles.rewriteBar}>
          {intent && (
            <span className={styles.intentTag}>
              <Brain size={11} /> {intent.replace(/_/g, ' ')}
            </span>
          )}
          {rewrittenQuery && (
            <span className={styles.rewriteText}>
              <Zap size={11} /> Expanded Query: <em>"{rewrittenQuery}"</em>
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
  const [sortBy,      setSortBy]      = useState('relevance')

  // streaming state
  const [sourceStatus,     setSourceStatus]     = useState({})
  const [rewrittenQuery,   setRewrittenQuery]   = useState('')
  const [intent,           setIntent]           = useState('')
  const [streamPhase,      setStreamPhase]      = useState('') // 'searching' | 'ranking' | ''

  const [discOpen, setDiscOpen] = useState(false)
  const discRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (discRef.current && !discRef.current.contains(event.target)) {
        setDiscOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const abortRef  = useRef(null)
  const inputRef  = useRef()

  const resetStreamState = () => {
    setSourceStatus({})
    setRewrittenQuery('')
    setIntent('')
    setStreamPhase('')
    setSortBy('relevance')
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
            setRewrittenQuery(data.expanded_query || data.interpreted_query || data.rewritten_query || '')
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

  // Active filter indicators
  const activeFilters = useMemo(() => {
    const list = []
    if (discipline !== 'all') {
      const label = DISCIPLINES.find(d => d.value === discipline)?.label || discipline
      list.push({ type: 'discipline', label: `${label}`, clear: () => { setDisc('all'); handleSearch(query, 'all') } })
    }
    if (yearFrom) {
      list.push({ type: 'yearFrom', label: `From: ${yearFrom}`, clear: () => setYearFrom('') })
    }
    if (yearTo) {
      list.push({ type: 'yearTo', label: `To: ${yearTo}`, clear: () => setYearTo('') })
    }
    if (limit !== 10) {
      list.push({ type: 'limit', label: `Limit: ${limit}`, clear: () => setLimit(10) })
    }
    return list
  }, [discipline, yearFrom, yearTo, limit, query, handleSearch])

  // Client-side instant sorting of returned papers
  const sortedPapers = useMemo(() => {
    if (!results?.papers) return []
    const papersCopy = [...results.papers]
    if (sortBy === 'year') {
      return papersCopy.sort((a, b) => (b.year || 0) - (a.year || 0))
    }
    if (sortBy === 'citations') {
      return papersCopy.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0))
    }
    if (sortBy === 'quality') {
      return papersCopy.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
    }
    return papersCopy // 'relevance' (as ranked by backend expansion algorithm)
  }, [results, sortBy])

  const isSearching = loading || streamPhase !== ''

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      {!results && !isSearching && (
        <header className={styles.hero}>
          <p className={styles.heroEyebrow}>Academic Knowledge Hub</p>
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
            <button onClick={clearSearch} className={styles.clearBtn} aria-label="Clear query"><X size={15} /></button>
          )}
          <div className={styles.customDiscDropdown} ref={discRef}>
            <button
              type="button"
              onClick={() => setDiscOpen(!discOpen)}
              className={`${styles.customDiscTrigger} ${styles[discipline]}`}
              aria-expanded={discOpen}
            >
              <span className={`${styles.discIndicatorDot} ${styles[discipline]}`} />
              <span className={styles.discTriggerText}>
                {DISCIPLINES.find(d => d.value === discipline)?.label}
              </span>
              <ChevronDown size={14} className={`${styles.discChevron} ${discOpen ? styles.open : ''}`} />
            </button>
            <AnimatePresence>
              {discOpen && (
                <motion.ul
                  className={styles.discDropdownList}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  {DISCIPLINES.map(d => (
                    <li
                      key={d.value}
                      onClick={() => {
                        setDisc(d.value)
                        setDiscOpen(false)
                      }}
                      className={`${styles.discOption} ${discipline === d.value ? styles.discOptionActive : ''}`}
                    >
                      <span className={`${styles.discIndicatorDot} ${styles[d.value]}`} />
                      <span className={styles.discOptionLabel}>{d.label}</span>
                      {discipline === d.value && <Check size={13} className={styles.discOptionCheck} />}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`${styles.filterBtn} ${showFilters ? styles.filterActive : ''}`}
            title="Advanced filters"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || isSearching}
            className={styles.searchBtn}
          >
            {isSearching ? (
              <>
                <Loader2 size={14} className={styles.spin} />
                <span>Searching</span>
              </>
            ) : (
              <>
                <Search size={14} />
                <span>Search</span>
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              className={styles.filters}
              initial={{ opacity: 0, height: 0, opacity: 0 }}
              animate={{ opacity: 1, height: 'auto', opacity: 1 }}
              exit={{ opacity: 0, height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
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
                  {[5, 10, 20, 30].map(n => <option key={n} value={n}>{n} papers</option>)}
                </select>
              </label>
              <label className={styles.streamToggle}>
                <input type="checkbox" checked={useStream} onChange={e => setUseStream(e.target.checked)} />
                <span>Live streaming</span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active filters bar ── */}
        {activeFilters.length > 0 && (
          <div className={styles.activeFiltersRow}>
            {activeFilters.map(f => (
              <span key={f.type} className={styles.filterChip}>
                {f.label}
                <button onClick={f.clear} className={styles.filterChipClose} title="Remove filter">
                  <X size={10} />
                </button>
              </span>
            ))}
            {(yearFrom || yearTo || discipline !== 'all') && (
              <button 
                onClick={() => { setDisc('all'); setYearFrom(''); setYearTo(''); setLimit(10); }} 
                className={styles.resetFiltersBtn}
              >
                Reset All
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Example queries ── */}
      {!results && !isSearching && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Quick Try:</span>
          {EXAMPLE_QUERIES.map((ex, i) => (
            <button key={i} onClick={() => handleExample(ex)} className={styles.exampleBtn}>
              <Search size={10} style={{ marginRight: 4, opacity: 0.6 }} />
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
            <div className={styles.resultsStatsLine}>
              <span className={styles.resultCount}>
                <strong>{results.total}</strong> paper{results.total !== 1 ? 's' : ''} found
              </span>
              <span className={styles.resultQuery}>for "{results.query}"</span>
              {results.discipline !== 'all' && <DisciplineBadge tag={results.discipline} />}
            </div>

            {/* Premium Client-Side Sort Panel */}
            {results.papers?.length > 0 && (
              <div className={styles.sortContainer}>
                <span className={styles.sortTitle}>Sort:</span>
                <div className={styles.sortButtonGroup}>
                  <button 
                    onClick={() => setSortBy('relevance')} 
                    className={`${styles.sortTab} ${sortBy === 'relevance' ? styles.sortTabActive : ''}`}
                    title="Sort by expand matches ranking"
                  >
                    <Sparkles size={11} />
                    <span>Relevance</span>
                  </button>
                  <button 
                    onClick={() => setSortBy('year')} 
                    className={`${styles.sortTab} ${sortBy === 'year' ? styles.sortTabActive : ''}`}
                    title="Sort by latest publication year"
                  >
                    <Calendar size={11} />
                    <span>Year</span>
                  </button>
                  <button 
                    onClick={() => setSortBy('citations')} 
                    className={`${styles.sortTab} ${sortBy === 'citations' ? styles.sortTabActive : ''}`}
                    title="Sort by citation intensity"
                  >
                    <Award size={11} />
                    <span>Influence</span>
                  </button>
                  <button 
                    onClick={() => setSortBy('quality')} 
                    className={`${styles.sortTab} ${sortBy === 'quality' ? styles.sortTabActive : ''}`}
                    title="Sort by TriField analytics quality score"
                  >
                    <Zap size={11} />
                    <span>Quality</span>
                  </button>
                </div>
              </div>
            )}

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
                    <Zap size={11} /> AI search extension: <em>"{rewrittenQuery}"</em>
                  </span>
                )}
              </div>
            )}
          </div>

          {sortedPapers.length === 0 ? (
            <div className={styles.empty}>
              <Search size={32} />
              <p>No papers matched your query. Try broader search terms.</p>
            </div>
          ) : (
            sortedPapers.map((paper, i) => (
              <PaperCard key={paper.paper_id} paper={paper} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
