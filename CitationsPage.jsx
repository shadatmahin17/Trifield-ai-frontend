import { useState } from 'react'
import { Quote, Copy, Check, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react'
import { generateCitation } from '../lib/api.js'
import styles from './CitationsPage.module.css'

const STYLES = [
  { value: 'apa',     label: 'APA 7th',           desc: 'Psychology, social sciences, most journals' },
  { value: 'ieee',    label: 'IEEE',               desc: 'Electrical engineering, computer science' },
  { value: 'aiaa',    label: 'AIAA',               desc: 'Aerospace engineering journals' },
  { value: 'harvard', label: 'Harvard',            desc: 'UK/Australian universities, materials' },
  { value: 'mla',     label: 'MLA 9th',            desc: 'Humanities' },
  { value: 'chicago', label: 'Chicago 17th',       desc: 'History, arts' },
]

function AuthorInput({ authors, onChange }) {
  const add    = () => onChange([...authors, ''])
  const remove = (i) => onChange(authors.filter((_, j) => j !== i))
  const update = (i, v) => { const a = [...authors]; a[i] = v; onChange(a) }
  return (
    <div className={styles.authorList}>
      {authors.map((a, i) => (
        <div key={i} className={styles.authorRow}>
          <input
            type="text"
            value={a}
            onChange={e => update(i, e.target.value)}
            placeholder={`Author ${i+1} (e.g. Mahin, S.H.)`}
            className={styles.authorInput}
          />
          {authors.length > 1 && (
            <button onClick={() => remove(i)} className={styles.removeBtn}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      <button onClick={add} className={styles.addAuthorBtn}>
        <Plus size={13} /> Add author
      </button>
    </div>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}>
      {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
    </button>
  )
}

export default function CitationsPage() {
  const [title,    setTitle]    = useState('')
  const [authors,  setAuthors]  = useState([''])
  const [year,     setYear]     = useState('')
  const [journal,  setJournal]  = useState('')
  const [volume,   setVolume]   = useState('')
  const [pages,    setPages]    = useState('')
  const [doi,      setDoi]      = useState('')
  const [style,    setStyle]    = useState('apa')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [allStyles,setAllStyles] = useState(false)

  const generate = async (targetStyle) => {
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      const stylesToGen = allStyles ? STYLES.map(s => s.value) : [targetStyle || style]
      const responses = await Promise.all(
        stylesToGen.map(s => generateCitation({
          title: title.trim(),
          authors: authors.filter(Boolean),
          year: year ? parseInt(year) : null,
          journal: journal || null,
          volume: volume || null,
          pages: pages || null,
          doi: doi || null,
          style: s,
        }))
      )
      setResults(responses.map((r, i) => ({
        style: r.style,
        label: STYLES.find(s => s.value === r.style)?.label || r.style,
        citation: r.citation,
      })))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setTitle(''); setAuthors(['']); setYear(''); setJournal('')
    setVolume(''); setPages(''); setDoi(''); setResults([]); setError(null)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Citation Generator</h1>
        <p className={styles.sub}>APA · IEEE · AIAA · Harvard · MLA · Chicago</p>
      </header>

      <div className={styles.layout}>
        {/* ── Form ── */}
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Paper title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Full paper title"
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Authors</label>
            <AuthorInput authors={authors} onChange={setAuthors} />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Year</label>
              <input
                type="number" value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2024" min="1800" max="2030"
                className={styles.input}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Volume</label>
              <input
                type="text" value={volume}
                onChange={e => setVolume(e.target.value)}
                placeholder="e.g. 250"
                className={styles.input}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Pages</label>
              <input
                type="text" value={pages}
                onChange={e => setPages(e.target.value)}
                placeholder="e.g. 110532"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Journal / Conference</label>
            <input
              type="text" value={journal}
              onChange={e => setJournal(e.target.value)}
              placeholder="e.g. Composites Science and Technology"
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>DOI</label>
            <input
              type="text" value={doi}
              onChange={e => setDoi(e.target.value)}
              placeholder="e.g. 10.1016/j.compscitech.2024.110532"
              className={styles.input}
            />
          </div>

          {/* Style selector */}
          <div className={styles.styleRow}>
            <div className={styles.styleGrid}>
              {STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`${styles.styleBtn} ${style === s.value ? styles.styleBtnActive : ''}`}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* All styles toggle */}
          <label className={styles.allStylesToggle}>
            <input
              type="checkbox"
              checked={allStyles}
              onChange={e => setAllStyles(e.target.checked)}
            />
            <span>Generate all 6 styles at once</span>
          </label>

          {error && (
            <p className={styles.error}>{error}</p>
          )}

          <div className={styles.formActions}>
            <button
              onClick={() => generate()}
              disabled={!title.trim() || loading}
              className={styles.generateBtn}
            >
              {loading
                ? <><Loader2 size={15} className={styles.spin} /> Generating…</>
                : <><Quote size={15} /> Generate Citation</>
              }
            </button>
            <button onClick={clear} className={styles.clearBtn}>Clear</button>
          </div>
        </div>

        {/* ── Results ── */}
        <div className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.emptyResults}>
              <Quote size={40} strokeWidth={1} />
              <p>Fill in the paper details and click Generate Citation</p>
              <p className={styles.emptyHint}>
                Tip: paste the DOI for the most accurate citation
              </p>
            </div>
          ) : (
            results.map((r, i) => (
              <div key={i} className={styles.citationCard} style={{ animationDelay: `${i*60}ms` }}>
                <div className={styles.citationHeader}>
                  <span className={styles.citationStyle}>{r.label}</span>
                  <CopyBtn text={r.citation} />
                </div>
                <p className={styles.citationText}>{r.citation}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
