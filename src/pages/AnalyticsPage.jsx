import { useState, useEffect } from 'react'
import { BarChart2, RefreshCw, Loader2, AlertCircle, Clock, Search,
         TrendingUp, CheckCircle, Zap, FileText } from 'lucide-react'
import { getAnalytics } from '../lib/api.js'
import styles from './AnalyticsPage.module.css'

function StatCard({ icon: Icon, label, value, sub, accent = '#854836' }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIconWrap} style={{ background: `${accent}14`, border: `1px solid ${accent}28` }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  )
}

function HBar({ label, value, max, color = '#854836' }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0
  return (
    <div className={styles.hBar}>
      <span className={styles.hBarLabel} title={label}>{label}</span>
      <div className={styles.hBarTrack}>
        <div className={styles.hBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.hBarValue}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </div>
  )
}

function msToDisplay(ms) {
  if (!ms) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function tsToDate(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleString()
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getAnalytics())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className={styles.centered}>
      <Loader2 size={28} className={styles.spin} style={{ color: '#854836' }} />
      <p className={styles.loadingText}>Loading analytics…</p>
    </div>
  )

  if (error) return (
    <div className={styles.errorWrap}>
      <AlertCircle size={18} />
      <div>
        <strong>Could not load analytics</strong>
        <p>{error}</p>
      </div>
      <button onClick={load} className={styles.retryBtn}><RefreshCw size={13} /> Retry</button>
    </div>
  )

  if (!data) return null

  // Normalise — backend now returns correct keys; fall back gracefully for
  // any older deployment still returning the old tuple-list format.
  const total_searches      = data.total_searches      ?? 0
  const successful_searches = data.successful_searches ?? 0
  const failed_searches     = data.failed_searches     ?? 0
  const avg_latency_ms      = data.avg_latency_ms      ?? 0
  const p95_latency_ms      = data.p95_latency_ms      ?? 0
  const searches_last_hour  = data.searches_last_hour  ?? 0
  const avg_results         = data.avg_results_per_search ?? 0
  const total_pdf_uploads   = data.total_pdf_uploads   ?? 0
  const period_start        = data.period_start
  const period_end          = data.period_end

  // discipline_distribution — backend returns {str:int}, old backend returns [[str,int],…]
  const discipline_distribution = (() => {
    const raw = data.discipline_distribution ?? data.top_disciplines
    if (!raw) return {}
    if (Array.isArray(raw)) return Object.fromEntries(raw)
    return raw
  })()

  // intent_distribution — same normalisation
  const intent_distribution = (() => {
    const raw = data.intent_distribution ?? data.top_intents
    if (!raw) return {}
    if (Array.isArray(raw)) return Object.fromEntries(raw)
    return raw
  })()

  // top_queries — backend returns [{query,count,avg_latency_ms}]
  // old backend returns [[str,int]]
  const top_queries = (() => {
    const raw = data.top_queries ?? []
    if (!raw.length) return []
    if (Array.isArray(raw[0])) {
      // old tuple format [[str,int],…]
      return raw.map(([q, c]) => ({ query: q, count: c, avg_latency_ms: null }))
    }
    return raw
  })()

  // top_failed_queries
  const top_failed_queries = (() => {
    const raw = data.top_failed_queries ?? []
    if (!raw.length) return []
    if (Array.isArray(raw[0])) return raw.map(([q, c]) => ({ query: q, count: c }))
    return raw
  })()

  // source_success_rates — {source: 0-1 float}
  const source_success_rates = data.source_success_rates ?? {}

  const successRate = total_searches > 0
    ? Math.round((successful_searches / total_searches) * 100)
    : 0

  const discMax   = Math.max(1, ...Object.values(discipline_distribution))
  const intentMax = Math.max(1, ...Object.values(intent_distribution))

  const DISC_COLORS = {
    aerospace: '#854836',
    materials: '#FFB22C',
    textile:   '#9B5542',
    general:   '#6E6E6E',
    all:       '#6E6E6E',
  }

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Analytics</h1>
          {period_start && (
            <p className={styles.pageSub}>
              Since {tsToDate(period_start)}
              {period_end ? ` · updated ${tsToDate(period_end)}` : ''}
            </p>
          )}
        </div>
        <button onClick={load} className={styles.refreshBtn}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* No data yet */}
      {total_searches === 0 && (
        <div className={styles.empty}>
          <BarChart2 size={36} strokeWidth={1} />
          <p>No search data yet — run a search to start collecting analytics.</p>
        </div>
      )}

      {total_searches > 0 && (<>

        {/* ── Stat cards ── */}
        <div className={styles.statsGrid}>
          <StatCard icon={Search}      label="Total Searches"      value={total_searches.toLocaleString()}   accent="#854836" />
          <StatCard icon={CheckCircle} label="Success Rate"        value={`${successRate}%`}
            sub={`${successful_searches} ok · ${failed_searches} failed`}                                    accent="#277A38" />
          <StatCard icon={Clock}       label="Avg Latency"         value={msToDisplay(avg_latency_ms)}
            sub={`p95: ${msToDisplay(p95_latency_ms)}`}                                                     accent="#FFB22C" />
          <StatCard icon={Zap}         label="Last Hour"           value={searches_last_hour}                accent="#9B5542" />
          <StatCard icon={TrendingUp}  label="Avg Results"         value={avg_results.toFixed(1)}            accent="#6E6E6E" />
          <StatCard icon={FileText}    label="PDF Uploads"         value={total_pdf_uploads}                 accent="#854836" />
        </div>

        {/* ── Two column charts ── */}
        <div className={styles.twoCol}>

          {Object.keys(discipline_distribution).length > 0 && (
            <Section title="Searches by Discipline">
              <div className={styles.barList}>
                {Object.entries(discipline_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([disc, count]) => (
                    <HBar key={disc} label={disc} value={count} max={discMax}
                      color={DISC_COLORS[disc] || '#6E6E6E'} />
                  ))}
              </div>
            </Section>
          )}

          {Object.keys(intent_distribution).length > 0 && (
            <Section title="Query Intents">
              <div className={styles.barList}>
                {Object.entries(intent_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([intent, count]) => (
                    <HBar key={intent} label={intent.replace(/_/g, ' ')} value={count} max={intentMax}
                      color="#854836" />
                  ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── Source success rates ── */}
        {Object.keys(source_success_rates).length > 0 && (
          <Section title="Search Source Breakdown">
            <div className={styles.sourceGrid}>
              {Object.entries(source_success_rates).map(([source, rate]) => {
                const pct   = typeof rate === 'number' ? (rate <= 1 ? rate * 100 : rate) : 0
                const color = pct >= 80 ? '#277A38' : pct >= 50 ? '#FFB22C' : '#B42318'
                return (
                  <div key={source} className={styles.sourceCard}>
                    <div className={styles.sourceName}>{source}</div>
                    <div className={styles.sourceRateWrap}>
                      <div className={styles.sourceTrack}>
                        <div className={styles.sourceFill} style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className={styles.sourceRate} style={{ color }}>{Math.round(pct)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Top queries table ── */}
        {top_queries.length > 0 && (
          <Section title="Top Queries">
            <div className={styles.queryTable}>
              <div className={styles.queryHeader}>
                <span>Query</span>
                <span>Count</span>
                <span>Avg latency</span>
              </div>
              {top_queries.slice(0, 15).map((q, i) => (
                <div key={i} className={styles.queryRow}>
                  <span className={styles.queryText}>
                    <span className={styles.queryRank}>{i + 1}</span>
                    {q.query}
                  </span>
                  <span className={styles.queryCount}>{q.count}</span>
                  <span className={styles.queryLatency}>{msToDisplay(q.avg_latency_ms)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Top failed queries ── */}
        {top_failed_queries.length > 0 && (
          <Section title="Failed Queries">
            <div className={styles.queryTable}>
              <div className={styles.queryHeader}>
                <span>Query</span>
                <span>Failures</span>
                <span></span>
              </div>
              {top_failed_queries.map((q, i) => (
                <div key={i} className={`${styles.queryRow} ${styles.queryRowFailed}`}>
                  <span className={styles.queryText}>
                    <span className={styles.queryRank}>{i + 1}</span>
                    {q.query}
                  </span>
                  <span className={styles.queryCount} style={{ color: '#B42318' }}>{q.count}</span>
                  <span />
                </div>
              ))}
            </div>
          </Section>
        )}

      </>)}
    </div>
  )
}
