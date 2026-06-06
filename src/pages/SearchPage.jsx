import { useState, useRef, useCallback } from 'react'
import { Search, SlidersHorizontal, ExternalLink, BookOpen,
         FileText, ChevronDown, X, Loader2, AlertCircle, Download } from 'lucide-react'
import { searchPapers } from '../lib/api.js'
import styles from './SearchPage.module.css'

const DISCIPLINES = [
  { value: 'all',       label: 'All Disciplines' },
  { value: 'aerospace', label: 'Aerospace'        },
  { value: 'materials', label: 'Materials Science'},
  { value: 'textile',   label: 'Textile Engineering'},
]

const DISC_COLORS = {
  aerospace: { bg: 'rgba(26,111,196,0.15)', color: '#3AA0FF', border: 'rgba(58,160,255,0.3)' },
  materials: { bg: 'rgba(201,168,76,0.12)', color: '#E8C87A', border: 'rgba(201,168,76,0.3)' },
  textile:   { bg: 'rgba(46,141,232,0.12)', color: '#7BC4FF', border: 'rgba(46,141,232,0.3)' },
  general:   { bg: 'rgba(107,130,168,0.12)', color: '#8BA0C0', border: 'rgba(107,130,168,0.3)' },
}

const EXAMPLE_QUERIES = [
  { q: 'jute flax hybrid composite mechanical properties', d: 'textile'   },
  { q: 'carbon fibre laminate fatigue damage',             d: 'aerospace' },
  { q: '3D woven composites progressive damage',           d: 'materials' },
  { q: 'piezoresistive strain sensing smart composites',   d: 'materials' },
]

function DisciplineBadge({ tag }) {
  const c = DISC_COLORS[tag] || DISC_COLORS.general
  return (
    <span className={styles.badge} style={{ background: c.bg, color: c.color, borderColor: c.border }}>
      {tag}
    </span>
  )
}

function PaperCard({ paper, index }) {
  const [expanded, setExpanded] = useState(false)
  const hasAbstract = paper.abstract && paper.abstract.length > 10

  return (
    <article
      className={styles.card}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <DisciplineBadge tag={paper.discipline_tag} />
          {paper.year && <span className={styles.year}>{paper.year}</span>}
          {paper.citation_count > 0 && (
            <span className={styles.citations}>
              <BookOpen size={11} /> {paper.citation_count} cited
            </span>
          )}
        </div>
        <div className={styles.cardActions}>
          {paper.open_access_url && (
            <a
              href={paper.open_access_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.oaBtn}
              title="Open Access PDF"
            >
              <Download size={13} />
              <span>PDF</span>
            </a>
          )}
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.doiBtn}
            title="View paper"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <h2 className={styles.title}>
        <a href={paper.url} target="_blank" rel="noopener noreferrer">
          {paper.title}
        </a>
      </h2>

      {paper.authors?.length > 0 && (
        <p className={styles.authors}>
          {paper.authors.slice(0, 4).map(a => a.name).join(', ')}
          {paper.authors.length > 4 && ` +${paper.authors.length - 4} more`}
        </p>
      )}

      {paper.journal && (
        <p className={styles.journal}>
          <FileText size={12} />
          {paper.journal}
        </p>
      )}

      {hasAbstract && (
        <div className={styles.abstractWrap}>
          <p className={`${styles.abstract} ${expanded ? styles.expanded : ''}`}>
            {paper.abstract}
          </p>
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Show less' : 'Read abstract'}
            <ChevronDown
              size={13}
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
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

export default function SearchPage() {
  const [query,      setQuery]      = useState('')
  const [discipline, setDisc]       = useState('all')
  const [yearFrom,   setYearFrom]   = useState('')
  const [yearTo,     setYearTo]     = useState('')
  const [limit,      setLimit]      = useState(10)
  const [showFilters,setShowFilters] = useState(false)
  const [results,    setResults]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const inputRef = useRef()

  const handleSearch = useCallback(async (q = query, d = discipline) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const data = await searchPapers({
        query: trimmed,
        discipline: d,
        yearFrom: yearFrom || null,
        yearTo:   yearTo   || null,
        limit,
      })
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [query, discipline, yearFrom, yearTo, limit])

  const handleExample = (ex) => {
    setQuery(ex.q)
    setDisc(ex.d)
    handleSearch(ex.q, ex.d)
  }

  const clearSearch = () => {
    setQuery('')
    setResults(null)
    setError(null)
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      {!results && !loading && (
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
            <button onClick={clearSearch} className={styles.clearBtn}>
              <X size={15} />
            </button>
          )}
          <select
            value={discipline}
            onChange={e => setDisc(e.target.value)}
            className={styles.discSelect}
          >
            {DISCIPLINES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
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
            disabled={!query.trim() || loading}
            className={styles.searchBtn}
          >
            {loading ? <Loader2 size={16} className={styles.spin} /> : 'Search'}
          </button>
        </div>

        {/* ── Filters panel ── */}
        {showFilters && (
          <div className={styles.filters}>
            <label>
              <span>From year</span>
              <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                placeholder="e.g. 2010" min="1900" max="2025" />
            </label>
            <label>
              <span>To year</span>
              <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)}
                placeholder="e.g. 2024" min="1900" max="2025" />
            </label>
            <label>
              <span>Results</span>
              <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
                {[5,10,20,30].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* ── Example queries ── */}
      {!results && !loading && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLE_QUERIES.map((ex, i) => (
            <button key={i} onClick={() => handleExample(ex)} className={styles.exampleBtn}>
              {ex.q}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 4 }} />
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
      {results && !loading && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultCount}>
              {results.total} paper{results.total !== 1 ? 's' : ''} found
            </span>
            <span className={styles.resultQuery}>"{results.query}"</span>
            {results.discipline !== 'all' && (
              <DisciplineBadge tag={results.discipline} />
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
