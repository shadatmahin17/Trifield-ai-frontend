const BASE = import.meta.env.VITE_API_URL || 'https://trifield-ai.up.railway.app'

async function get(path, params = {}) {
  const url = new URL(BASE + path)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// ── Search (v1 — regular) ─────────────────────────────────────────
export const searchPapers = ({ query, discipline = 'all', yearFrom, yearTo, limit = 10 }) =>
  get('/api/search/', { query, discipline, year_from: yearFrom, year_to: yearTo, limit })

// ── Search (v2 — streaming SSE) ───────────────────────────────────
export function searchStream({ query, discipline = 'all', yearFrom, yearTo, limit = 10, onEvent }) {
  const url = new URL(`${BASE}/api/search/stream`)
  url.searchParams.set('query', query)
  url.searchParams.set('discipline', discipline)
  url.searchParams.set('limit', limit)
  if (yearFrom) url.searchParams.set('year_from', yearFrom)
  if (yearTo)   url.searchParams.set('year_to',   yearTo)

  const es = new EventSource(url.toString())

  const events = ['start','rewrite','source_complete','ranking','results','done','source_error']
  events.forEach(evt => {
    es.addEventListener(evt, e => {
      try { onEvent(evt, JSON.parse(e.data)) }
      catch { onEvent(evt, { raw: e.data }) }
    })
  })

  es.onerror = () => {
    onEvent('error', { message: 'Stream connection lost' })
    es.close()
  }

  // Auto-close after done
  es.addEventListener('done', () => es.close())

  return () => es.close()   // returns cleanup function
}

// ── Copilot (v2) ──────────────────────────────────────────────────
export const copilotAnalyse = ({ query, discipline = 'all', limit = 10 }) =>
  post('/api/copilot/analyse', { query, discipline, limit })

export const copilotSummary = ({ query, discipline = 'all' }) =>
  post('/api/copilot/summary', { query, discipline, limit: 6 })

// ── Analytics (v2) ────────────────────────────────────────────────
export const getAnalytics = () => get('/api/analytics/')

// ── Citations ─────────────────────────────────────────────────────
export const getCitationStyles = () => get('/api/citations/styles')
export const generateCitation  = (data) => post('/api/citations/', data)

// ── PDF ───────────────────────────────────────────────────────────
export const uploadPDF = async (file) => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/pdf/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export const chatWithPDF      = (sessionId, question) =>
  post('/api/pdf/chat', { session_id: sessionId, question })

export const extractProperties = (sessionId) =>
  get(`/api/pdf/extract-properties/${sessionId}`)

// ── Health ────────────────────────────────────────────────────────
export const healthCheck = () => get('/health')
