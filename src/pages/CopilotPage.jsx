import { useState, useRef } from 'react'
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

const EXAMPLE_TOPICS = [
  { q: 'natural fibre composite fatigue behaviour',    d: 'textile'   },
  { q: 'ceramic matrix composites high temperature',   d: 'materials' },
  { q: 'UAV structural lightweight design',            d: 'aerospace' },
  { q: 'graphene reinforced polymer nanocomposites',   d: 'materials' },
]

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
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
      <button className={styles.sectionHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionIconWrap} style={{ background: `${accent}18`, border: `1px solid ${accent}33` }}>
          <Icon size={14} style={{ color: accent }} />
        </span>
        <span className={styles.sectionTitle}>{title}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

function PaperRef({ paper, index }) {
  return (
    <div className={styles.paperRef}>
      <span className={styles.paperIndex}>{index + 1}</span>
      <div className={styles.paperRefContent}>
        <a href={paper.url} target="_blank" rel="noopener noreferrer" className={styles.paperRefTitle}>
          {paper.title}
        </a>
        {paper.authors?.length > 0 && (
          <span className={styles.paperRefMeta}>
            {paper.authors.slice(0, 2).map(a => a.name).join(', ')}
            {paper.authors.length > 2 && ` et al.`}
            {paper.year && ` · ${paper.year}`}
            {paper.citation_count > 0 && ` · ${paper.citation_count} citations`}
          </span>
        )}
      </div>
      {paper.open_access_url && (
        <a href={paper.open_access_url} target="_blank" rel="noopener noreferrer"
           className={styles.paperRefPdf} title="Open Access PDF">PDF</a>
      )}
    </div>
  )
}

function BulletList({ items }) {
  if (!items?.length) return <p className={styles.emptySection}>None identified.</p>
  return (
    <ul className={styles.bulletList}>
      {items.map((item, i) => (
        <li key={i} className={styles.bulletItem}>
          <span className={styles.bullet} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function AnalysisReport({ data }) {
  const fullText = JSON.stringify(data, null, 2)

  return (
    <div className={styles.report}>
      <div className={styles.reportHeader}>
        <div className={styles.reportMeta}>
          <span className={styles.reportQuery}>"{data.query}"</span>
          {data.discipline && data.discipline !== 'all' && (
            <span className={styles.disciplineTag}>{data.discipline}</span>
          )}
          {data.papers_analysed > 0 && (
            <span className={styles.paperCount}>{data.papers_analysed} papers analysed</span>
          )}
        </div>
        <CopyBtn text={fullText} />
      </div>

      {/* Summary */}
      {data.summary && (
        <div className={styles.summaryBlock}>
          <p className={styles.summaryText}>{data.summary}</p>
        </div>
      )}

      {/* Key papers */}
      {data.key_papers?.length > 0 && (
        <Section icon={BookOpen} title="Key Papers" accent="#854836">
          <div className={styles.paperList}>
            {data.key_papers.map((p, i) => <PaperRef key={i} paper={p} index={i} />)}
          </div>
        </Section>
      )}

      {/* Trends */}
      {data.trends?.length > 0 && (
        <Section icon={TrendingUp} title="Research Trends" accent="#FFB22C">
          <BulletList items={data.trends} />
        </Section>
      )}

      {/* Gaps */}
      {data.gaps?.length > 0 && (
        <Section icon={Microscope} title="Research Gaps" accent="#9B5542">
          <BulletList items={data.gaps} />
        </Section>
      )}

      {/* Future directions */}
      {data.future_directions?.length > 0 && (
        <Section icon={Lightbulb} title="Future Directions" accent="#277A38">
          <BulletList items={data.future_directions} />
        </Section>
      )}

      {/* Suggested experiments */}
      {data.suggested_experiments?.length > 0 && (
        <Section icon={FlaskConical} title="Suggested Experiments" accent="#6E6E6E">
          <BulletList items={data.suggested_experiments} />
        </Section>
      )}

      {/* Methodology notes */}
      {data.methodology_notes && (
        <Section icon={Zap} title="Methodology Notes" accent="#854836">
          <p className={styles.methodNote}>{data.methodology_notes}</p>
        </Section>
      )}
    </div>
  )
}

function SummaryReport({ data }) {
  return (
    <div className={styles.report}>
      <div className={styles.reportHeader}>
        <div className={styles.reportMeta}>
          <span className={styles.reportQuery}>"{data.query}"</span>
          {data.discipline && data.discipline !== 'all' && (
            <span className={styles.disciplineTag}>{data.discipline}</span>
          )}
        </div>
        <CopyBtn text={data.landscape_summary || ''} />
      </div>
      <div className={styles.summaryBlock}>
        <p className={styles.summaryText}>{data.landscape_summary}</p>
      </div>
      {data.key_themes?.length > 0 && (
        <Section icon={TrendingUp} title="Key Themes" accent="#FFB22C">
          <BulletList items={data.key_themes} />
        </Section>
      )}
      {data.notable_authors?.length > 0 && (
        <Section icon={BookOpen} title="Notable Authors / Groups" accent="#854836">
          <ul className={styles.bulletList}>
            {data.notable_authors.map((a, i) => (
              <li key={i} className={styles.bulletItem}>
                <span className={styles.bullet} />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

export default function CopilotPage() {
  const [query,      setQuery]      = useState('')
  const [discipline, setDisc]       = useState('all')
  const [limit,      setLimit]      = useState(10)
  const [mode,       setMode]       = useState('analyse') // 'analyse' | 'summary'
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [result,     setResult]     = useState(null)
  const inputRef = useRef()

  const run = async (q = query, d = discipline) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fn = mode === 'analyse' ? copilotAnalyse : copilotSummary
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
    run(ex.q, ex.d)
  }

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      {!result && !loading && (
        <header className={styles.hero}>
          <p className={styles.heroEyebrow}>AI Research Intelligence</p>
          <h1 className={styles.heroTitle}>
            Understand a field<br />
            <em>in minutes</em>
          </h1>
          <p className={styles.heroSub}>
            Trends · Gaps · Key papers · Suggested experiments — synthesised by AI
          </p>
        </header>
      )}

      {/* ── Controls ── */}
      <div className={styles.controlsWrap}>
        {/* Mode tabs */}
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

        {/* Search row */}
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
          <select value={discipline} onChange={e => setDisc(e.target.value)} className={styles.discSelect}>
            {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className={styles.discSelect}>
            {[6, 10, 15, 20].map(n => <option key={n} value={n}>{n} papers</option>)}
          </select>
          <button onClick={() => run()} disabled={!query.trim() || loading} className={styles.runBtn}>
            {loading
              ? <><Loader2 size={15} className={styles.spin} /> Analysing…</>
              : <><FlaskConical size={15} /> Analyse</>
            }
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
        <>
          {result.mode === 'analyse'
            ? <AnalysisReport data={result.data} />
            : <SummaryReport data={result.data} />
          }
          <button
            className={styles.resetBtn}
            onClick={() => { setResult(null); setError(null); setQuery(''); inputRef.current?.focus() }}
          >
            ← New analysis
          </button>
        </>
      )}
    </div>
  )
}
