import { createClient } from '@supabase/supabase-js'

const defaultUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tjyqlpuiesgazqfjrwuc.supabase.co'
const defaultAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const getSupabaseConfig = () => {
  const localUrl = localStorage.getItem('supabase_url') || defaultUrl
  const localKey = localStorage.getItem('supabase_anon_key') || defaultAnonKey
  return {
    url: localUrl,
    anonKey: localKey,
    isConfigured: !!localUrl && !!localKey
  }
}

export const saveSupabaseConfig = (url, anonKey) => {
  if (url) localStorage.setItem('supabase_url', url)
  if (anonKey) localStorage.setItem('supabase_anon_key', anonKey)
}

export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url')
  localStorage.removeItem('supabase_anon_key')
}

let supabaseInstance = null

export const getSupabase = () => {
  const { url, anonKey } = getSupabaseConfig()
  
  if (!url || !anonKey) {
    return null
  }

  if (supabaseInstance && supabaseInstance.supabaseUrl === url) {
    return supabaseInstance
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
    return supabaseInstance
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    return null
  }
}

export const resetSupabaseClient = () => {
  supabaseInstance = null
}
