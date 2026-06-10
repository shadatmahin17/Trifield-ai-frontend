import React, { createContext, useContext, useEffect, useState } from 'react'
import { getSupabase, getSupabaseConfig, saveSupabaseConfig, resetSupabaseClient } from './supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  profile: {
    displayName: '',
    bio: '',
    avatarUrl: ''
  },
  isAdmin: false,
  stats: {
    searchesCount: 0,
    pdfsCount: 0
  },
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  configureSupabase: () => {},
  updateProfile: async () => {},
  incrementSearchCount: () => {},
  incrementPdfCount: () => {}
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(getSupabaseConfig().isConfigured)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Local state for profile and stats
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '' })
  const [stats, setStats] = useState({ searchesCount: 0, pdfsCount: 0 })

  // Check if current user is admin (defaults to current user email, any email containing 'admin' or explicit metadata role)
  const isAdmin = user ? (
    user.email === 'mahinaurwave12@gmail.com' || 
    user.email === 'shadatmahin681@gmail.com' || 
    user.email?.toLowerCase().includes('admin') || 
    user.user_metadata?.role === 'admin'
  ) : false

  // Load profile and stats for the authenticated user
  const syncProfileAndStats = (currentUser) => {
    if (!currentUser) {
      setProfile({ displayName: '', bio: '', avatarUrl: '' })
      setStats({ searchesCount: 0, pdfsCount: 0 })
      return
    }

    const email = currentUser.email || 'anon'
    
    // Retrieve metadata with Supabase Auth Meta as primary, fallback to localStorage
    const metaName = currentUser.user_metadata?.display_name
    const metaBio = currentUser.user_metadata?.bio
    const metaAvatar = currentUser.user_metadata?.avatar_url

    const localName = localStorage.getItem(`profile_display_name_${email}`) || ''
    const localBio = localStorage.getItem(`profile_bio_${email}`) || ''
    const localAvatar = localStorage.getItem(`profile_avatar_url_${email}`) || ''

    setProfile({
      displayName: metaName || localName || email.split('@')[0],
      bio: metaBio || localBio || 'Aerospace & Materials researcher at TriField AI.',
      avatarUrl: metaAvatar || localAvatar || ''
    })

    const searches = parseInt(localStorage.getItem(`stats_searches_${email}`) || '0', 10)
    const pdfs = parseInt(localStorage.getItem(`stats_pdfs_${email}`) || '0', 10)
    
    setStats({
      searchesCount: searches,
      pdfsCount: pdfs
    })
  }

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      setIsConfigured(false)
      return
    }

    setIsConfigured(true)

    // Get current session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      const curUser = currentSession?.user || null
      setUser(curUser)
      syncProfileAndStats(curUser)
      setLoading(false)
    }).catch(err => {
      console.error('Error getting session:', err)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      const curUser = currentSession?.user || null
      setUser(curUser)
      syncProfileAndStats(curUser)
      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [isConfigured, refreshTrigger])

  const configureSupabase = (url, anonKey) => {
    saveSupabaseConfig(url, anonKey)
    resetSupabaseClient()
    const config = getSupabaseConfig()
    setIsConfigured(config.isConfigured)
    setRefreshTrigger(prev => prev + 1)
  }

  const signUp = async (email, password) => {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase client not initialized')
    // Set custom role admin metadata if register contains 'admin'
    const role = email.toLowerCase().includes('admin') ? 'admin' : 'user'
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          role: role,
          display_name: email.split('@')[0]
        }
      }
    })
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setSession(null)
    syncProfileAndStats(null)
  }

  // Update profile handler (local fallback + Supabase user metadata update)
  const updateProfile = async ({ displayName, bio, avatarUrl }) => {
    if (!user) throw new Error('User is not authenticated')

    const email = user.email || 'anon'

    // Update fallback storage
    if (displayName !== undefined) localStorage.setItem(`profile_display_name_${email}`, displayName)
    if (bio !== undefined) localStorage.setItem(`profile_bio_${email}`, bio)
    if (avatarUrl !== undefined) localStorage.setItem(`profile_avatar_url_${email}`, avatarUrl)

    // Update memory merging existing keys
    setProfile(prev => {
      const nextProfile = {
        displayName: displayName !== undefined ? displayName : prev.displayName,
        bio: bio !== undefined ? bio : prev.bio,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : prev.avatarUrl
      }
      return nextProfile
    })

    // Try to update on Supabase Auth Meta
    const supabase = getSupabase()
    if (supabase) {
      try {
        const currentMetadata = user.user_metadata || {}
        const updateData = { ...currentMetadata }

        if (displayName !== undefined) updateData.display_name = displayName
        if (bio !== undefined) updateData.bio = bio
        if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl

        const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({
          data: updateData
        })
        
        if (error) throw error
        if (updatedUser) {
          setUser(updatedUser)
        }
      } catch (err) {
        console.warn('Failed to update Supabase metadata (will rely on local storage fallback):', err)
        throw err
      }
    }
  }

  // Increment local stats count
  const incrementSearchCount = () => {
    if (!user) return
    const email = user.email || 'anon'
    const current = parseInt(localStorage.getItem(`stats_searches_${email}`) || '0', 10)
    const next = current + 1
    localStorage.setItem(`stats_searches_${email}`, String(next))
    setStats(prev => ({ ...prev, searchesCount: next }))
  }

  const incrementPdfCount = () => {
    if (!user) return
    const email = user.email || 'anon'
    const current = parseInt(localStorage.getItem(`stats_pdfs_${email}`) || '0', 10)
    const next = current + 1
    localStorage.setItem(`stats_pdfs_${email}`, String(next))
    setStats(prev => ({ ...prev, pdfsCount: next }))
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isConfigured,
      profile,
      isAdmin,
      stats,
      signUp,
      signIn,
      signOut,
      configureSupabase,
      updateProfile,
      incrementSearchCount,
      incrementPdfCount
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
