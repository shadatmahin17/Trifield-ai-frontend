import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FlaskConical, Search, Loader2, AlertCircle, ChevronDown,
         BookOpen, Lightbulb, TrendingUp, Microscope, Zap, Copy, Check } from 'lucide-react'
import { copilotAnalyse, copilotSummary } from '../lib/api.js'
import styles from './CopilotPage.module.css'

const DISCIPLINES = [
  { value: 'all',       label: 'All Disciplines'     },
  { value: 'aerospace', label: 'Aerospace'            },
  { value: 'materials', label: 'Materials Science'    },
  { value: 'textile',   label: 'Textile Engineering'  },
]

const LIMITS = [
  { value: 6,  label: '6 papers'  },
  { value: 10, label: '10 papers' },
  { value: 15, label: '15 papers' },
  { value: 20, label: '20 papers' },
]

const EXAMPLE_TOPICS = [
  { q: 'natural fibre composite fatigue behaviour',    d: 'textile'   },
  { q: 'ceramic matrix composites high temperature',   d: 'materials' },
  { q: 'UAV structural lightweight design',            d: 'aerospace' },
  { q: 'graphene reinforced polymer nanocomposites',   d: 'materials' },
]

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}>
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  )
}

function Section({ icon: Icon, title, children, accent }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.section} style={{ borderLeftColor: accent }}>
      <button
        className={styles.sectionHeader}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={styles.sectionIconWrap} style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
          <Icon size={14} style={{ color: accent }} />
        </span>
        <span className={styles.sectionTitle}>{title}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className={styles.sectionBody}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PaperRef({ paper, index }) {
  const url     = paper.url || null
  const oa_url  = paper.open_access_url || null
  const authors = paper.authors?.slice(0, 2).map(a => a.name || a).join(', ') || null

  return (
    <div className={styles.paperRef}>
      <span className={styles.paperIndex}>{index + 1}</span>
      <div className={styles.paperRefContent}>
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer" className={styles.paperRefTitle}>{paper.title}</a>
          : <span className={styles.paperRefTitle} style={{ cursor: 'default' }}>{paper.title}</span>
        }
        <span className={styles.paperRefMeta}>
          {authors && `${authors} · `}
          {paper.year && `${paper.year}`}
          {paper.citation_count > 0 && ` · ${paper.citation_count} citations`}
          {paper.significance && ` — ${paper.significance}`}
        </span>
      </div>
      {oa_url && (
        <a href={oa_url} target="_blank" rel="noopener noreferrer"
           className={styles.paperRefPdf}>PDF</a>
      )}
    </div>
  )
}

function RichTextWithPaperLinks({ text, papers }) {
  if (!text) return null;
  if (!papers || papers.length === 0) {
    return <span>{text}</span>;
  }

  // Regex to split on [1], [2], etc.
  const parts = text.split(/(\[\d+\])/g);

  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const index = parseInt(match[1], 10) - 1;
          if (index >= 0 && index < papers.length) {
            const paper = papers[index];
            const title = paper.title || 'Untitled Paper';
            
            // Format authors
            let authorStr = '';
            if (paper.authors && paper.authors.length > 0) {
              const names = paper.authors.map(a => a.name || a);
              if (names.length > 1) {
                authorStr = `${names[0]} et al.`;
              } else {
                authorStr = names[0];
              }
            }
            const yearStr = paper.year ? `, ${paper.year}` : '';
            const paperData = [authorStr, yearStr].filter(Boolean).join('');
            
            // Handle URL / DOI URL
            const url = paper.url || paper.open_access_url || null;

            // Check if title is already mentioned in the preceding text to prevent repetition
            const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const precedingText = parts[i - 1] || '';
            const cleanPreceding = precedingText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const titleAlreadyInText = cleanTitle.length > 10 && cleanPreceding.includes(cleanTitle);

            if (titleAlreadyInText) {
              // Highlight [N] with just metadata & DOI link to be concise
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    background: 'rgba(39, 122, 56, 0.08)',
                    border: '1px solid rgba(39, 122, 56, 0.22)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    margin: '0 2px',
                    fontSize: '11px',
                    verticalAlign: 'middle',
                    color: '#277A38',
                    fontWeight: 500
                  }}
                >
                  {paperData && <span>({paperData})</span>}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#277A38',
                        fontWeight: '700',
                        textDecoration: 'underline',
                        marginLeft: '4px'
                      }}
                      title={`Find study: ${title}`}
                    >
                      [DOI/Link]
                    </a>
                  )}
                </span>
              );
            } else {
              // Full inline card with title, author, year, and direct DOI/Link
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '4px',
                    background: 'rgba(133, 72, 54, 0.08)',
                    border: '1px solid rgba(133, 72, 54, 0.22)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    margin: '0 4px',
                    fontSize: '12px',
                    verticalAlign: 'middle',
                    color: '#222'
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#854836' }}>"{title}"</span>
                  {paperData && <span style={{ color: '#555', fontSize: '11px' }}>({paperData})</span>}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        color: '#277A38',
                        fontWeight: '700',
                        textDecoration: 'underline',
                        fontSize: '11px',
                        marginLeft: '4px'
                      }}
                      title={`Find study: ${title}`}
                    >
                      [DOI/Link]
                    </a>
                  )}
                </span>
              );
            }
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function BulletList({ items, papers }) {
  if (!items?.length) return <p className={styles.emptySection}>None identified.</p>
  return (
    <ul className={styles.bulletList}>
      {items.map((item, i) => (
        <li key={i} className={styles.bulletItem}>
          <span className={styles.bullet} />
          <span>
            <RichTextWithPaperLinks text={item} papers={papers} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function AnalysisReport({ data }) {
  const summary             = data.summary
  const papers              = (data.papers && data.papers.length > 0) ? data.papers : (data.key_papers || [])
  const trends              = data.research_trends      || data.trends              || []
  const gaps                = data.research_gaps        || data.gaps                || []
  const future_directions   = data.future_directions    || []
  const suggested_exps      = data.suggested_experiments|| []
  const methodology_notes   = data.methodology_notes    || null
  const papers_analysed     = data.search_meta?.papers_analysed
                           ?? data.papers_analysed
                           ?? data.paper_count
                           ?? papers.length
                           ?? 0
  const discipline          = data.search_meta?.discipline ?? data.discipline ?? null

  const fullText = [
    summary,
    trends.join('\n'),
    gaps.join('\n'),
    future_directions.join('\n'),
    suggested_exps.join('\n'),
  ].filter(Boolean).join('\n\n')

  return (
    <div className={styles.report}>
      <div className={styles.reportHeader}>
        <div className={styles.reportMeta}>
          <span className={styles.reportQuery}>"{data.query}"</span>
          {discipline && discipline !== 'all' && (
            <span className={styles.disciplineTag}>{discipline}</span>
          )}
          {papers_analysed > 0 && (
            <span className={styles.paperCount}>{papers_analysed} papers analysed</span>
          )}
        </div>
        <CopyBtn text={fullText} />
      </div>

      {summary && (
        <div className={styles.summaryBlock}>
          <p className={styles.summaryText}>
            <RichTextWithPaperLinks text={summary} papers={papers} />
          </p>
        </div>
      )}

      {papers.length > 0 && (
        <Section icon={BookOpen} title="Papers Analysed" accent="#854836">
          <div className={styles.paperList}>
            {papers.map((p, i) => <PaperRef key={i} paper={p} index={i} />)}
          </div>
        </Section>
      )}

      {trends.length > 0 && (
        <Section icon={TrendingUp} title="Research Trends" accent="#FFB22C">
          <BulletList items={trends} papers={papers} />
        </Section>
      )}

      {gaps.length > 0 && (
        <Section icon={Microscope} title="Research Gaps" accent="#9B5542">
          <BulletList items={gaps} papers={papers} />
        </Section>
      )}

      {future_directions.length > 0 && (
        <Section icon={Lightbulb} title="Future Directions" accent="#277A38">
          <BulletList items={future_directions} papers={papers} />
        </Section>
      )}

      {suggested_exps.length > 0 && (
        <Section icon={FlaskConical} title="Suggested Experiments" accent="#6E6E6E">
          <BulletList items={suggested_exps} papers={papers} />
        </Section>
      )}

      {methodology_notes && (
        <Section icon={Zap} title="Methodology Notes" accent="#854836">
          <p className={styles.methodNote}>
            <RichTextWithPaperLinks text={methodology_notes} papers={papers} />
          </p>
        </Section>
      )}
    </div>
  )
}

function SummaryReport({ data }) {
  const text         = data.summary ?? data.landscape_summary ?? ''
  const papers       = (data.papers && data.papers.length > 0) ? data.papers : (data.key_papers || [])
  const paper_count  = data.paper_count ?? papers.length ?? 0

  return (
    <div className={styles.report}>
      <div className={styles.reportHeader}>
        <div className={styles.reportMeta}>
          <span className={styles.reportQuery}>"{data.query}"</span>
          {paper_count > 0 && (
            <span className={styles.paperCount}>{paper_count} papers analysed</span>
          )}
        </div>
        <CopyBtn text={text} />
      </div>

      {text ? (
        <>
          <div className={styles.summaryBlock}>
            <div className={styles.summaryText} style={{ whiteSpace: 'pre-wrap' }}>
              <RichTextWithPaperLinks text={text} papers={papers} />
            </div>
          </div>
          {papers.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <Section icon={BookOpen} title="Papers Analysed" accent="#854836">
                <div className={styles.paperList}>
                  {papers.map((p, i) => <PaperRef key={i} paper={p} index={i} />)}
                </div>
              </Section>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyReport}>
          <AlertCircle size={18} />
          <p>The summary returned no content. Try a different query or switch to Deep Analysis.</p>
        </div>
      )}
    </div>
  )
}

export default function CopilotPage() {
  const [query,      setQuery]      = useState('')
  const [discipline, setDisc]       = useState('all')
  const [limit,      setLimit]      = useState(10)
  const [mode,       setMode]       = useState('analyse')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [result,     setResult]     = useState(null)

  const [discOpen, setDiscOpen] = useState(false)
  const [limitOpen, setLimitOpen] = useState(false)
  const discRef = useRef(null)
  const limitRef = useRef(null)
  const inputRef = useRef()

  useEffect(() => {
    function handleClickOutside(event) {
      if (discRef.current && !discRef.current.contains(event.target)) {
        setDiscOpen(false)
      }
      if (limitRef.current && !limitRef.current.contains(event.target)) {
        setLimitOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const run = async (q = query, d = discipline) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fn   = mode === 'analyse' ? copilotAnalyse : copilotSummary
      const data = await fn({ query: trimmed, discipline: d, limit })
      setResult({ mode, data })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExample = (ex) => {
    setQuery(ex.q)
    setDisc(ex.d)
    const fn = mode === 'analyse' ? copilotAnalyse : copilotSummary
    const trimmed = ex.q.trim()
    setLoading(true)
    setError(null)
    setResult(null)
    fn({ query: trimmed, discipline: ex.d, limit })
      .then(data  => setResult({ mode, data }))
      .catch(e    => setError(e.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className={styles.page}>

      {!result && !loading && (
        <header className={styles.hero}>
          <p className={styles.heroEyebrow}>AI Research Intelligence</p>
          <h1 className={styles.heroTitle}>
            Understand any field<br />
            <em>in minutes</em>
          </h1>
          <p className={styles.heroSub}>
            Trends · Gaps · Key papers · Suggested experiments — synthesised by AI
          </p>
        </header>
      )}

      {/* ── Controls ── */}
      <div className={styles.controlsWrap}>
        <div className={styles.modeTabs}>
          <button
            className={`${styles.modeTab} ${mode === 'analyse' ? styles.modeTabActive : ''}`}
            onClick={() => setMode('analyse')}
          >
            <FlaskConical size={14} /> Deep Analysis
          </button>
          <button
            className={`${styles.modeTab} ${mode === 'summary' ? styles.modeTabActive : ''}`}
            onClick={() => setMode('summary')}
          >
            <Zap size={14} /> Quick Summary
          </button>
        </div>

        <div className={styles.searchBar}>
          <Search size={17} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Research topic… e.g. carbon fibre fatigue in aerospace"
            className={styles.input}
            autoFocus
          />
          
          <div className={styles.dropdownsGroup}>
            {/* Custom Interactive Discipline Dropdown */}
            <div className={styles.customDropdown} ref={discRef}>
              <button
                type="button"
                onClick={() => {
                  setDiscOpen(!discOpen)
                  setLimitOpen(false)
                }}
                className={`${styles.customDropTrigger} ${styles[discipline]}`}
                aria-expanded={discOpen}
              >
                <span className={`${styles.indicatorDot} ${styles[discipline]}`} />
                <span className={styles.dropTriggerText}>
                  {DISCIPLINES.find(d => d.value === discipline)?.label}
                </span>
                <ChevronDown size={14} className={`${styles.dropChevron} ${discOpen ? styles.open : ''}`} />
              </button>
              <AnimatePresence>
                {discOpen && (
                  <motion.ul
                    className={styles.dropdownList}
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
                        className={`${styles.dropOption} ${discipline === d.value ? styles.dropOptionActive : ''}`}
                      >
                        <span className={`${styles.indicatorDot} ${styles[d.value]}`} />
                        <span className={styles.dropOptionLabel}>{d.label}</span>
                        {discipline === d.value && <Check size={13} className={styles.dropOptionCheck} />}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Interactive Limit Dropdown */}
            <div className={styles.customDropdown} ref={limitRef}>
              <button
                type="button"
                onClick={() => {
                  setLimitOpen(!limitOpen)
                  setDiscOpen(false)
                }}
                className={styles.customDropTrigger}
                aria-expanded={limitOpen}
              >
                <span className={styles.dropTriggerText}>
                  {LIMITS.find(l => l.value === limit)?.label || `${limit} papers`}
                </span>
                <ChevronDown size={14} className={`${styles.dropChevron} ${limitOpen ? styles.open : ''}`} />
              </button>
              <AnimatePresence>
                {limitOpen && (
                  <motion.ul
                    className={styles.dropdownList}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    {LIMITS.map(l => (
                      <li
                        key={l.value}
                        onClick={() => {
                          setLimit(l.value)
                          setLimitOpen(false)
                        }}
                        className={`${styles.dropOption} ${limit === l.value ? styles.dropOptionActive : ''}`}
                      >
                        <span className={styles.dropOptionLabel}>{l.label}</span>
                        {limit === l.value && <Check size={13} className={styles.dropOptionCheck} />}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button onClick={() => run()} disabled={!query.trim() || loading} className={styles.runBtn}>
            {loading ? (
              <>
                <Loader2 size={14} className={styles.spin} />
                <span>Analysing</span>
              </>
            ) : (
              <>
                <FlaskConical size={14} />
                <span>Analyse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Examples ── */}
      {!result && !loading && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLE_TOPICS.map((ex, i) => (
            <button key={i} onClick={() => handleExample(ex)} className={styles.exampleBtn}>
              {ex.q}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <div className={styles.loadingText}>
            <p className={styles.loadingTitle}>
              {mode === 'analyse' ? 'Running deep analysis…' : 'Generating summary…'}
            </p>
            <p className={styles.loadingSubtitle}>
              Fetching papers · Ranking · Synthesising with AI
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className={styles.error}>
          <AlertCircle size={18} />
          <div>
            <strong>Analysis failed</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && !loading && (
        <div className={styles.reportWrap}>
          {result.mode === 'analyse'
            ? <AnalysisReport data={result.data} />
            : <SummaryReport  data={result.data} />
          }
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <button
              className={styles.resetBtn}
              onClick={() => { setResult(null); setError(null); setQuery(''); inputRef.current?.focus() }}
            >
              ← New analysis
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
