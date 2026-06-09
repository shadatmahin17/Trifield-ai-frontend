import { useState, useEffect } from 'react'
import { BarChart2, RefreshCw, Loader2, AlertCircle, Clock, Search,
         TrendingUp, CheckCircle, XCircle, Zap } from 'lucide-react'
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
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className={styles.hBar}>
      <span className={styles.hBarLabel}>{label}</span>
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
  if (ms == null || ms === 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await getAnalytics()
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Loading ──
  if (loading) return (
    <div className={styles.centered}>
      <Loader2 size={28} className={styles.spin} style={{ color: '#854836' }} />
      <p className={styles.loadingText}>Loading analytics…</p>
    </div>
  )

  // ── Error ──
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

  const {
    total_searches = 0,
    successful_searches = 0,
    failed_searches = 0,
    avg_latency_ms = 0,
    p95_latency_ms = 0,
    searches_last_hour = 0,
    discipline_distribution = {},
    intent_distribution = {},
    top_queries = [],
    source_success_rates = {},
    cache_hit_rate = 0,
    period_start,
    period_end,
  } = data

  const successRate = total_searches > 0
    ? Math.round((successful_searches / total_searches) * 100)
    : 0

  const discMax  = Math.max(1, ...Object.values(discipline_distribution))
  const intentMax = Math.max(1, ...Object.values(intent_distribution))
  const srcMax    = Math.max(1, ...Object.values(source_success_rates))

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
              {new Date(period_start).toLocaleDateString()} — {period_end ? new Date(period_end).toLocaleDateString() : 'now'}
            </p>
          )}
        </div>
        <button onClick={load} className={styles.refreshBtn}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className={styles.statsGrid}>
        <StatCard icon={Search}      label="Total Searches"   value={total_searches.toLocaleString()} accent="#854836" />
        <StatCard icon={CheckCircle} label="Success Rate"     value={`${successRate}%`} sub={`${successful_searches} ok · ${failed_searches} failed`} accent="#277A38" />
        <StatCard icon={Clock}       label="Avg Latency"      value={msToDisplay(avg_latency_ms)} sub={`p95: ${msToDisplay(p95_latency_ms)}`} accent="#FFB22C" />
        <StatCard icon={Zap}         label="Last Hour"        value={searches_last_hour} accent="#9B5542" />
        <StatCard icon={TrendingUp}  label="Cache Hit Rate"   value={`${Math.round((cache_hit_rate || 0) * 100)}%`} accent="#6E6E6E" />
      </div>

      <div className={styles.twoCol}>
        {/* ── Discipline distribution ── */}
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

        {/* ── Intent distribution ── */}
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
        <Section title="Source Success Rates">
          <div className={styles.sourceGrid}>
            {Object.entries(source_success_rates).map(([source, rate]) => {
              const pct = typeof rate === 'number' ? (rate <= 1 ? rate * 100 : rate) : 0
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

      {/* ── Top queries ── */}
      {top_queries?.length > 0 && (
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

      {/* Empty state */}
      {total_searches === 0 && (
        <div className={styles.empty}>
          <BarChart2 size={36} strokeWidth={1} />
          <p>No search data yet. Run a search to start collecting analytics.</p>
        </div>
      )}
    </div>
  )
}
