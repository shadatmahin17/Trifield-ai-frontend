// ── Base config ────────────────────────────────────────────────────────────
const BASE    = (import.meta.env.VITE_API_URL || 'https://trifield-ai.up.railway.app').replace(/\/+$/, '')
const API_KEY = import.meta.env.VITE_API_KEY || ''

// BUG FIX: Every request was missing the X-API-Key header — the backend
// returned 401 for all /api/* calls. All helpers now inject it.
function authHeaders(extra = {}) {
  return {
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...extra,
  }
}

// ── Core fetch helpers ─────────────────────────────────────────────────────
async function get(path, params = {}) {
  const url = new URL(BASE + path)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url.toString(), { headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// ── PDF proxy (fetch a remote PDF through our own backend, avoiding public
// CORS proxies which are unreliable and frequently blocked/down) ──────────
export const fetchPDFBlob = async (pdfUrl) => {
  const url = new URL(BASE + '/api/pdf/proxy')
  url.searchParams.set('url', pdfUrl)
  const res = await fetch(url.toString(), { headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `PDF proxy request failed (${res.status})`)
  }
  return res.blob()
}

// ── Search ─────────────────────────────────────────────────────────────────
export const searchPapers = ({ query, discipline = 'all', yearFrom, yearTo, limit = 10 }) =>
  get('/api/search/', { query, discipline, year_from: yearFrom, year_to: yearTo, limit })

/**
 * SSE streaming search.
 * BUG FIX: was missing X-API-Key header on the fetch call — got 401.
 * BUG FIX: 'rewrite' event field was data.rewritten_query but backend sends
 *          data.expanded_query — fixed field name.
 *
 * Events: start | rewrite | source_complete | source_error | ranking | results | done | error
 * Returns AbortController — call .abort() to cancel.
 */
export function streamSearch({ query, discipline = 'all', yearFrom, yearTo, limit = 10 }, onEvent) {
  const url = new URL(BASE + '/api/search/stream')
  const params = { query, discipline, year_from: yearFrom, year_to: yearTo, limit }
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v)
  })

  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(url.toString(), {
        signal:  controller.signal,
        headers: authHeaders(),   // BUG FIX: was missing
      })
      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()
        for (const part of parts) {
          const lines = part.split('\n')
          let eventName = 'message'
          let dataStr   = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            if (line.startsWith('data: '))  dataStr   = line.slice(6).trim()
          }
          if (dataStr) {
            try { onEvent(eventName, JSON.parse(dataStr)) } catch {}
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') onEvent('error', { message: e.message })
    }
  })()

  return controller
}

export const getSearchHistory = (limit = 50, discipline = null) =>
  get('/api/search/history', { limit, ...(discipline ? { discipline } : {}) })

// ── Copilot ────────────────────────────────────────────────────────────────
export const copilotAnalyse = ({ query, discipline = 'all', limit = 10 }) =>
  post('/api/copilot/analyse', { query, discipline, limit })

export const copilotSummary = ({ query, discipline = 'all', limit = 6 }) =>
  post('/api/copilot/summary', { query, discipline, limit })

// ── Citations ──────────────────────────────────────────────────────────────
export const getCitationStyles  = ()     => get('/api/citations/styles')
export const generateCitation   = (data) => post('/api/citations/', data)
export const getSavedCitations  = (style) =>
  get('/api/citations/saved', style ? { style } : {})
export const deleteSavedCitation = (id) =>
  fetch(`${BASE}/api/citations/saved/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }).then(r => r.json())

// ── PDF ────────────────────────────────────────────────────────────────────
export const uploadPDF = async (file) => {
  const form = new FormData()
  form.append('file', file)
  // BUG FIX: was missing X-API-Key header — upload returned 401
  const res = await fetch(`${BASE}/api/pdf/upload`, {
    method:  'POST',
    headers: authHeaders(),   // no Content-Type — FormData sets it with boundary
    body:    form,
  })
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

export const getPDFSessions    = (limit = 20) =>
  get('/api/pdf/sessions', { limit })

// ── Saved papers ───────────────────────────────────────────────────────────
export const getSavedPapers  = (discipline = null, limit = 50) =>
  get('/api/saved-papers/', { ...(discipline ? { discipline } : {}), limit })

export const savePaper = (paper) =>
  post('/api/saved-papers/', paper)

export const deleteSavedPaper = (paperId) =>
  fetch(`${BASE}/api/saved-papers/${encodeURIComponent(paperId)}`, {
    method: 'DELETE', headers: authHeaders(),
  }).then(r => r.json())

// ── Analytics ──────────────────────────────────────────────────────────────
export const getAnalytics      = ()            => get('/api/analytics/')
export const getRecentSearches = (limit = 50)  => get('/api/analytics/searches', { limit })
export const getTopQueries     = (limit = 10)  => get('/api/analytics/top-queries', { limit })

// ── Health ─────────────────────────────────────────────────────────────────
export const healthCheck = () => get('/health')

// ── Library ────────────────────────────────────────────────────────────────
export const getLibrary = (params = {}) => get('/api/library/', params)
export const getLibraryStats = () => get('/api/library/stats')
export const getLibraryColumnTypes = () => get('/api/library/columns')
export const getLibraryPaper = (paperId) => get(`/api/library/${paperId}`)
export const uploadToLibrary = async (file, discipline = 'general', uploadedBy = 'anonymous') => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(
    `${BASE}/api/library/upload?discipline=${discipline}&uploaded_by=${encodeURIComponent(uploadedBy)}`,
    { method: 'POST', headers: authHeaders(), body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}
export const extractColumn = (paperId, columnKey) => post(`/api/library/${paperId}/extract/${columnKey}`, {})
export const extractBatchColumns = (paperId, columnKeys) => post(`/api/library/${paperId}/extract-batch`, columnKeys)
export const deleteLibraryPaper = async (paperId) => {
  const res = await fetch(`${BASE}/api/library/${paperId}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Delete failed (${res.status})`)
  }
  return res.json()
}
