import { useState } from 'react'
import { Telescope, Loader2, AlertCircle, ChevronDown, ChevronUp, Lightbulb, TrendingUp, Search, FlaskConical } from 'lucide-react'
import { copilotAnalyse } from '../lib/api.js'
import styles from './CopilotPage.module.css'

const DISCIPLINES = [
  { value:'all',       label:'All Disciplines'    },
  { value:'aerospace', label:'Aerospace'           },
  { value:'materials', label:'Materials Science'  },
  { value:'textile',   label:'Textile Engineering'},
]

const EXAMPLES = [
  { q:'natural fibre composites for aerospace structures',   d:'all'       },
  { q:'3D woven carbon epoxy damage tolerance',             d:'aerospace'  },
  { q:'jute flax hybrid composite mechanical properties',   d:'textile'    },
  { q:'piezoresistive strain sensing composites',           d:'materials'  },
]

function Section({ icon: Icon, title, color, items }) {
  const [open, setOpen] = useState(true)
  if (!items?.length) return null
  return (
    <div className={styles.section} style={{ borderLeftColor: color }}>
      <button className={styles.sectionHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.sectionTitle}>
          <Icon size={15} style={{ color }} />
          <span>{title}</span>
          <span className={styles.count}>{items.length}</span>
        </div>
        {open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
      </button>
      {open && (
        <ul className={styles.sectionList}>
          {items.map((item, i) => (
            <li key={i} className={styles.sectionItem}>
              <span className={styles.bullet} style={{ background: color }}/>
              {typeof item === 'string' ? item : (
                <div>
                  <strong>{item.title}</strong>
                  {item.year && <span className={styles.year}> ({item.year})</span>}
                  {item.significance && <p className={styles.sig}>{item.significance}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CopilotPage() {
  const [query,      setQuery]    = useState('')
  const [discipline, setDisc]     = useState('all')
  const [loading,    setLoading]  = useState(false)
  const [report,     setReport]   = useState(null)
  const [error,      setError]    = useState(null)

  const run = async (q = query, d = discipline) => {
    if (!q.trim()) return
    setLoading(true); setError(null); setReport(null)
    try {
      const data = await copilotAnalyse({ query: q.trim(), discipline: d, limit: 10 })
      setReport(data)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}><Telescope size={26} strokeWidth={1.5}/> Research Copilot</h1>
        <p className={styles.sub}>Searches papers then generates trends, gaps, and experiment suggestions automatically</p>
      </header>

      {/* Input */}
      <div className={styles.inputWrap}>
        <div className={styles.inputRow}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key==='Enter' && run()}
            placeholder="e.g. natural fibre composites for aerospace structures"
            className={styles.input} autoFocus/>
          <select value={discipline} onChange={e => setDisc(e.target.value)} className={styles.select}>
            {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <button onClick={() => run()} disabled={!query.trim()||loading} className={styles.btn}>
            {loading ? <Loader2 size={16} className={styles.spin}/> : <><Telescope size={15}/> Analyse</>}
          </button>
        </div>
        <div className={styles.examples}>
          {EXAMPLES.map((ex,i) => (
            <button key={i} onClick={() => { setQuery(ex.q); setDisc(ex.d); run(ex.q, ex.d) }}
              className={styles.exBtn}>{ex.q}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className={styles.error}><AlertCircle size={16}/> {error}</div>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <Loader2 size={32} className={styles.spin}/>
          <p>Searching papers and generating intelligence report…</p>
          <p className={styles.loadingSub}>This takes 10–20 seconds</p>
        </div>
      )}

      {report && !loading && (
        <div className={styles.report}>
          {/* Meta bar */}
          <div className={styles.metaBar}>
            <span className={styles.metaItem}>
              <Search size={12}/> {report.paper_count} papers analysed
            </span>
            {report.search_meta?.interpreted_query && (
              <span className={styles.metaItem}>
                Query: <em>{report.search_meta.interpreted_query}</em>
              </span>
            )}
          </div>

          {/* Summary */}
          {report.summary && (
            <div className={styles.summary}>
              <p>{report.summary}</p>
            </div>
          )}

          {/* Sections */}
          <div className={styles.sections}>
            <Section icon={BookmarkIcon} title="Key Papers"       color="#854836" items={report.key_papers}/>
            <Section icon={TrendingUp}  title="Research Trends"   color="#277A38" items={report.research_trends}/>
            <Section icon={SearchGap}   title="Research Gaps"     color="#C4860A" items={report.research_gaps}/>
            <Section icon={Lightbulb}   title="Future Directions" color="#1A6FC4" items={report.future_directions}/>
            <Section icon={FlaskConical} title="Suggested Experiments" color="#7B3FA8" items={report.suggested_experiments}/>
          </div>
        </div>
      )}

      {!report && !loading && !error && (
        <div className={styles.empty}>
          <Telescope size={40} strokeWidth={1}/>
          <p>Enter a research topic above to generate an intelligence report</p>
          <p className={styles.emptySub}>Key papers · Trends · Gaps · Future directions · Experiments</p>
        </div>
      )}
    </div>
  )
}

// Icon aliases
function BookmarkIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={props.size} height={props.size}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function SearchGap(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={props.size} height={props.size}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6" strokeLinecap="round"/></svg>
}
