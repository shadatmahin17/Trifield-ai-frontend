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

// ── Search ────────────────────────────────────────────────────────
export const searchPapers = ({ query, discipline = 'all', yearFrom, yearTo, limit = 10 }) =>
  get('/api/search/', { query, discipline, year_from: yearFrom, year_to: yearTo, limit })

/**
 * SSE streaming search.
 * Calls onEvent(eventName, data) for each SSE event.
 * Returns an abort controller — call controller.abort() to cancel.
 *
 * Events: start | rewrite | source_complete | source_error | ranking | results | done
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
      const res = await fetch(url.toString(), { signal: controller.signal })
      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() // keep incomplete chunk
        for (const part of parts) {
          const lines = part.split('\n')
          let eventName = 'message'
          let dataStr = ''
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

// ── Copilot ───────────────────────────────────────────────────────
export const copilotAnalyse = ({ query, discipline = 'all', limit = 10 }) =>
  post('/api/copilot/analyse', { query, discipline, limit })

export const copilotSummary = ({ query, discipline = 'all', limit = 6 }) =>
  post('/api/copilot/summary', { query, discipline, limit })

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

export const chatWithPDF     = (sessionId, question) =>
  post('/api/pdf/chat', { session_id: sessionId, question })

export const extractProperties = (sessionId) =>
  get(`/api/pdf/extract-properties/${sessionId}`)

// ── Analytics ─────────────────────────────────────────────────────
export const getAnalytics = () => get('/api/analytics/')

// ── Health ────────────────────────────────────────────────────────
export const healthCheck = () => get('/health')
