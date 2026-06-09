import { useState, useEffect } from 'react'
import { BarChart2, Loader2, AlertCircle, TrendingUp, Search, Clock, CheckCircle, XCircle } from 'lucide-react'
import { getAnalytics } from '../lib/api.js'
import styles from './AnalyticsPage.module.css'

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ color }}>
        <Icon size={18} strokeWidth={1.5}/>
      </div>
      <div className={styles.statBody}>
        <div className={styles.statValue} style={{ color }}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  )
}

function TopList({ title, icon: Icon, color, items, valueKey, labelKey }) {
  if (!items?.length) return null
  const max = items[0]?.[1] || 1
  return (
    <div className={styles.topList}>
      <div className={styles.topListHeader}>
        <Icon size={14} style={{ color }}/>
        <span>{title}</span>
      </div>
      {items.map(([label, count], i) => (
        <div key={i} className={styles.topRow}>
          <span className={styles.topRank}>{i+1}</span>
          <div className={styles.topBarWrap}>
            <div className={styles.topBar}
              style={{ width:`${(count/max)*100}%`, background:color }}/>
            <span className={styles.topLabel}>{label}</span>
          </div>
          <span className={styles.topCount}>{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      setData(await getAnalytics())
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}><BarChart2 size={24} strokeWidth={1.5}/> Analytics</h1>
          <button onClick={load} className={styles.refreshBtn} disabled={loading}>
            {loading ? <Loader2 size={14} className={styles.spin}/> : '↻ Refresh'}
          </button>
        </div>
        <p className={styles.sub}>Search usage, latency, and top queries</p>
      </header>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={16}/> {error}
        </div>
      )}

      {loading && !data && (
        <div className={styles.loading}>
          <Loader2 size={28} className={styles.spin}/>
          <p>Loading analytics…</p>
        </div>
      )}

      {data?.message && (
        <div className={styles.empty}>
          <BarChart2 size={40} strokeWidth={1}/>
          <p>{data.message}</p>
          <p className={styles.emptySub}>Run some searches first to see analytics here</p>
        </div>
      )}

      {data && !data.message && (
        <>
          {/* Stat cards */}
          <div className={styles.statsGrid}>
            <StatCard icon={Search}      label="Total searches"    value={data.total_searches}      color="#1A6FC4"/>
            <StatCard icon={CheckCircle} label="Success rate"      value={`${data.success_rate_pct}%`} color="#277A38"/>
            <StatCard icon={Clock}       label="Avg latency"       value={`${data.avg_latency_ms}ms`}  color="#C4860A" sub={`p95: ${data.p95_latency_ms}ms`}/>
            <StatCard icon={TrendingUp}  label="Avg results"       value={data.avg_results_per_search?.toFixed(1)} color="#854836"/>
            <StatCard icon={XCircle}     label="Failed searches"   value={data.failed_searches}     color="#C04040"/>
            <StatCard icon={BarChart2}   label="PDF uploads"       value={data.total_pdf_uploads}   color="#7B3FA8"/>
          </div>

          {/* Top lists */}
          <div className={styles.listsGrid}>
            <TopList title="Top queries"     icon={Search}     color="#1A6FC4" items={data.top_queries}/>
            <TopList title="Top disciplines" icon={TrendingUp} color="#277A38" items={data.top_disciplines}/>
            <TopList title="Top intents"     icon={BarChart2}  color="#C4860A" items={data.top_intents}/>
            <TopList title="Failed queries"  icon={XCircle}    color="#C04040" items={data.top_failed_queries}/>
          </div>
        </>
      )}
    </div>
  )
}
