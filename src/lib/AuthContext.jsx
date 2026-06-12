import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  auth,
  db,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword
} from './firebase'
import { doc, getDoc, setDoc, increment, getDocFromServer } from 'firebase/firestore'

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
}

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isConfigured: true,
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
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
  changePassword: async () => {},
  configureSupabase: () => {},
  updateProfile: async () => {},
  incrementSearchCount: () => {},
  incrementPdfCount: () => {}
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Local state for profile and stats
  const [profile, setProfile] = useState({ displayName: '', bio: '', avatarUrl: '' })
  const [stats, setStats] = useState({ searchesCount: 0, pdfsCount: 0 })

  // Validate Connection to Firestore on startup
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'))
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.")
          }
        }
      }
      testConnection()
    }
  }, [])

  // Check if current user is admin (defaults to current user email, any email containing 'admin' or explicit metadata role)
  const isAdmin = user ? (
    user.email === 'mahinaurwave12@gmail.com' || 
    user.email === 'shadatmahin681@gmail.com' || 
    user.email?.toLowerCase().includes('admin') || 
    user.user_metadata?.role === 'admin'
  ) : false

  // Load profile and stats for the authenticated user
  const syncProfileAndStats = async (currentUser) => {
    if (!currentUser) {
      setProfile({ displayName: '', bio: '', avatarUrl: '' })
      setStats({ searchesCount: 0, pdfsCount: 0 })
      return
    }

    const email = currentUser.email || 'anon'
    const userId = currentUser.uid || currentUser.id || email.toLowerCase()

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', userId)
        const userDoc = await getDoc(userDocRef)
        if (userDoc.exists()) {
          const data = userDoc.data()
          setProfile({
            displayName: data.displayName || currentUser.displayName || email.split('@')[0],
            bio: data.bio || 'Aerospace & Materials researcher at TriField AI.',
            avatarUrl: data.avatarUrl || currentUser.photoURL || ''
          })
          setStats({
            searchesCount: data.searchesCount || 0,
            pdfsCount: data.pdfsCount || 0
          })
          return
        } else {
          // Initialize user document in firestore
          const initialProfile = {
            email: email,
            displayName: currentUser.displayName || email.split('@')[0],
            bio: 'Aerospace & Materials researcher at TriField AI.',
            avatarUrl: currentUser.photoURL || '',
            searchesCount: 0,
            pdfsCount: 0
          }
          await setDoc(userDocRef, initialProfile)
          setProfile({
            displayName: initialProfile.displayName,
            bio: initialProfile.bio,
            avatarUrl: initialProfile.avatarUrl
          })
          setStats({
            searchesCount: 0,
            pdfsCount: 0
          })
          return
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, 'users/' + userId)
        } catch (handleErr) {
          console.warn('Firestore load failed (using sandbox storage as fallback):', handleErr)
        }
      }
    }

    // Local Storage Fallback if Firebase is not fully configured or throws on reads
    const metaName = currentUser.user_metadata?.display_name || currentUser.displayName
    const metaBio = currentUser.user_metadata?.bio
    const metaAvatar = currentUser.user_metadata?.avatar_url || currentUser.photoURL

    const localName = localStorage.getItem(`profile_display_name_${email}`) || ''
    const localBio = localStorage.getItem(`profile_bio_${email}`) || ''
    const localAvatar = localStorage.getItem(`profile_avatar_url_${email}`) || ''

    setProfile({
      displayName: metaName || localName || email.split('@')[0],
      bio: localBio || metaBio || 'Aerospace & Materials researcher at TriField AI.',
      avatarUrl: metaAvatar || localAvatar || ''
    })

    const searches = parseInt(localStorage.getItem(`stats_searches_${email}`) || '0', 10)
    const pdfs = parseInt(localStorage.getItem(`stats_pdfs_${email}`) || '0', 10)
    
    setStats({
      searchesCount: searches,
      pdfsCount: pdfs
    })
  }

  // --- RECONCILE AUTHENTICATION FLOW ---
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const emailLower = firebaseUser.email?.toLowerCase() || '';
          const role = (emailLower.includes('admin') || emailLower === 'mahinaurwave12@gmail.com' || emailLower === 'shadatmahin681@gmail.com') ? 'admin' : 'user';
          
          const mappedUser = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            user_metadata: {
              role: role,
              display_name: firebaseUser.displayName || emailLower.split('@')[0],
              bio: localStorage.getItem(`profile_bio_${firebaseUser.email}`) || 'Aerospace & Materials researcher at TriField AI.',
              avatar_url: firebaseUser.photoURL || ''
            }
          }
          setUser(mappedUser)
          setSession({ user: mappedUser })
          await syncProfileAndStats(mappedUser)
        } else {
          setUser(null)
          setSession(null)
          await syncProfileAndStats(null)
        }
        setLoading(false)
      })
      return () => unsubscribe()
    } else {
      // Sandbox fallback mode
      try {
        const storedSession = localStorage.getItem('trifield_session')
        if (storedSession) {
          const sessionData = JSON.parse(storedSession)
          const lowerEmail = sessionData.email?.toLowerCase() || ''
          
          const users = JSON.parse(localStorage.getItem('trifield_users') || '{}')
          const userRecord = users[lowerEmail]

          if (userRecord) {
            const mockUser = {
              id: lowerEmail,
              email: userRecord.email,
              user_metadata: {
                role: userRecord.meta.role || 'user',
                display_name: userRecord.meta.display_name || userRecord.email.split('@')[0],
                bio: userRecord.meta.bio || 'Aerospace & Materials researcher at TriField AI.',
                avatar_url: userRecord.meta.avatar_url || ''
              }
            }
            setUser(mockUser)
            setSession({ user: mockUser })
            syncProfileAndStats(mockUser)
          } else {
            const role = (lowerEmail.includes('admin') || lowerEmail === 'mahinaurwave12@gmail.com' || lowerEmail === 'shadatmahin681@gmail.com') ? 'admin' : 'user'
            const newUserRecord = {
              email: lowerEmail,
              password: 'password123',
              meta: {
                role,
                display_name: lowerEmail.split('@')[0],
                bio: 'Aerospace & Materials researcher at TriField AI.',
                avatar_url: ''
              }
            }
            users[lowerEmail] = newUserRecord
            localStorage.setItem('trifield_users', JSON.stringify(users))

            const mockUser = {
              id: lowerEmail,
              email: lowerEmail,
              user_metadata: {
                role,
                display_name: lowerEmail.split('@')[0],
                bio: 'Aerospace & Materials researcher at TriField AI.',
                avatar_url: ''
              }
            }
            setUser(mockUser)
            setSession({ user: mockUser })
            syncProfileAndStats(mockUser)
          }
        } else {
          setUser(null)
          setSession(null)
          syncProfileAndStats(null)
        }
      } catch (err) {
        console.error('Error restoring local workspace session:', err)
        setUser(null)
        setSession(null)
      } finally {
        setLoading(false)
      }
    }
  }, [refreshTrigger])

  const configureSupabase = () => {
    // No-op mock config keeping legacy triggers intact
  }

  const signUp = async (email, password) => {
    const lowerEmail = email.toLowerCase()

    if (isFirebaseConfigured && auth) {
      const credentials = await createUserWithEmailAndPassword(auth, email, password)
      const role = (lowerEmail.includes('admin') || lowerEmail === 'mahinaurwave12@gmail.com' || lowerEmail === 'shadatmahin681@gmail.com') ? 'admin' : 'user';
      
      await firebaseUpdateProfile(credentials.user, {
        displayName: email.split('@')[0]
      })

      // Initialize Firestore document immediately
      if (db) {
        try {
          await setDoc(doc(db, 'users', credentials.user.uid), {
            email: email,
            displayName: email.split('@')[0],
            bio: 'Aerospace & Materials researcher at TriField AI.',
            avatarUrl: '',
            searchesCount: 0,
            pdfsCount: 0
          })
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.CREATE, 'users/' + credentials.user.uid)
          } catch (handlerErr) {
            console.error('Quietly logged write rejection on signup:', handlerErr)
          }
        }
      }

      return credentials.user
    } else {
      await new Promise(resolve => setTimeout(resolve, 800))
      const users = JSON.parse(localStorage.getItem('trifield_users') || '{}')

      if (users[lowerEmail]) {
        throw new Error('This email address is already registered in the workspace.')
      }

      const role = (lowerEmail.includes('admin') || lowerEmail === 'mahinaurwave12@gmail.com' || lowerEmail === 'shadatmahin681@gmail.com') ? 'admin' : 'user'
      const newUser = {
        email: lowerEmail,
        password: password,
        meta: {
          role: role,
          display_name: email.split('@')[0],
          bio: 'Aerospace & Materials researcher at TriField AI.',
          avatar_url: ''
        }
      }

      users[lowerEmail] = newUser
      localStorage.setItem('trifield_users', JSON.stringify(users))

      localStorage.setItem('trifield_session', JSON.stringify({ email: lowerEmail }))
      setRefreshTrigger(prev => prev + 1)
      
      return { email: lowerEmail }
    }
  }

  const signIn = async (email, password) => {
    const lowerEmail = email.toLowerCase()

    if (isFirebaseConfigured && auth) {
      const credentials = await signInWithEmailAndPassword(auth, email, password)
      return credentials
    } else {
      await new Promise(resolve => setTimeout(resolve, 750))
      let users = JSON.parse(localStorage.getItem('trifield_users') || '{}')

      if (!users[lowerEmail]) {
        const role = (lowerEmail.includes('admin') || lowerEmail === 'mahinaurwave12@gmail.com' || lowerEmail === 'shadatmahin681@gmail.com') ? 'admin' : 'user'
        const newUser = {
          email: lowerEmail,
          password: password,
          meta: {
            role: role,
            display_name: email.split('@')[0],
            bio: 'Aerospace & Materials researcher at TriField AI.',
            avatar_url: ''
          }
        }
        users[lowerEmail] = newUser
        localStorage.setItem('trifield_users', JSON.stringify(users))
      }

      const userRecord = users[lowerEmail]
      if (userRecord.password !== password) {
        throw new Error('Invalid authentication credentials. Please try again.')
      }

      localStorage.setItem('trifield_session', JSON.stringify({ email: lowerEmail }))
      setRefreshTrigger(prev => prev + 1)

      return { user: { email: lowerEmail } }
    }
  }

  const signOut = async () => {
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth)
    } else {
      await new Promise(resolve => setTimeout(resolve, 250))
      localStorage.removeItem('trifield_session')
      setUser(null)
      setSession(null)
      await syncProfileAndStats(null)
      setRefreshTrigger(prev => prev + 1)
    }
  }

  const signInWithGoogle = async () => {
    if (isFirebaseConfigured && auth) {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      return result.user
    } else {
      await new Promise(resolve => setTimeout(resolve, 800))
      const mockEmail = 'shadatmahin681@gmail.com'
      const lowerEmail = mockEmail.toLowerCase()
      const users = JSON.parse(localStorage.getItem('trifield_users') || '{}')
      if (!users[lowerEmail]) {
        const role = 'user'
        const newUser = {
          email: lowerEmail,
          password: 'password123',
          meta: {
            role: role,
            display_name: 'Shadat Mahin (Google)',
            bio: 'Aerospace & Materials researcher at TriField AI.',
            avatar_url: ''
          }
        }
        users[lowerEmail] = newUser
        localStorage.setItem('trifield_users', JSON.stringify(users))
      }
      localStorage.setItem('trifield_session', JSON.stringify({ email: lowerEmail }))
      setRefreshTrigger(prev => prev + 1)
      return { email: lowerEmail, displayName: 'Shadat Mahin (Google)' }
    }
  }

  const resetPassword = async (email) => {
    const lowerEmail = email.toLowerCase()
    if (isFirebaseConfigured && auth) {
      await sendPasswordResetEmail(auth, email)
    } else {
      await new Promise(resolve => setTimeout(resolve, 750))
      const users = JSON.parse(localStorage.getItem('trifield_users') || '{}')
      if (!users[lowerEmail]) {
        throw new Error('This email address is not registered in the workspace.')
      }
      console.log(`[SIMULATION] Password reset email sent to: ${email}`)
    }
  }

  const changePassword = async (newPassword) => {
    if (!user) throw new Error('User is not authenticated')
    const email = user.email || 'anon'
    const lowerEmail = email.toLowerCase()

    if (isFirebaseConfigured && auth && auth.currentUser) {
      await updatePassword(auth.currentUser, newPassword)
    } else {
      await new Promise(resolve => setTimeout(resolve, 500))
      const users = JSON.parse(localStorage.getItem('trifield_users') || '{}')
      if (users[lowerEmail]) {
        users[lowerEmail].password = newPassword
        localStorage.setItem('trifield_users', JSON.stringify(users))
      } else {
        throw new Error('User record not found in sandbox storage.')
      }
    }
  }

  const updateProfile = async ({ displayName, bio, avatarUrl }) => {
    if (!user) throw new Error('User is not authenticated')

    const email = user.email || 'anon'
    const lowerEmail = email.toLowerCase()
    const userId = user.uid || user.id || lowerEmail

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', userId)
        const updateData = {}
        if (displayName !== undefined) updateData.displayName = displayName
        if (bio !== undefined) updateData.bio = bio
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

        await setDoc(userDocRef, updateData, { merge: true })
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'users/' + userId)
      }
    }

    if (displayName !== undefined) localStorage.setItem(`profile_display_name_${email}`, displayName)
    if (bio !== undefined) localStorage.setItem(`profile_bio_${email}`, bio)
    if (avatarUrl !== undefined) localStorage.setItem(`profile_avatar_url_${email}`, avatarUrl)

    const users = JSON.parse(localStorage.getItem('trifield_users') || '{}')
    if (users[lowerEmail]) {
      if (displayName !== undefined) users[lowerEmail].meta.display_name = displayName
      if (bio !== undefined) users[lowerEmail].meta.bio = bio
      if (avatarUrl !== undefined) users[lowerEmail].meta.avatar_url = avatarUrl
      localStorage.setItem('trifield_users', JSON.stringify(users))
    }

    setProfile(prev => ({
      displayName: displayName !== undefined ? displayName : prev.displayName,
      bio: bio !== undefined ? bio : prev.bio,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : prev.avatarUrl
    }))

    setUser(prev => {
      if (!prev) return null
      const updatedMeta = { ...(prev.user_metadata || {}) }
      if (displayName !== undefined) updatedMeta.display_name = displayName
      if (bio !== undefined) updatedMeta.bio = bio
      if (avatarUrl !== undefined) updatedMeta.avatar_url = avatarUrl
      return {
        ...prev,
        displayName: displayName !== undefined ? displayName : prev.displayName,
        photoURL: avatarUrl !== undefined ? avatarUrl : prev.photoURL,
        user_metadata: updatedMeta
      }
    })

    if (isFirebaseConfigured && auth && auth.currentUser) {
      try {
        const authUpdates = {}
        if (displayName !== undefined && displayName !== null) {
          authUpdates.displayName = displayName
        }
        // Base64 data URLs are stored in Firestore/local storage, not in Firebase auth photoURL (which has tight length bounds)
        if (avatarUrl !== undefined && avatarUrl !== null && !avatarUrl.startsWith('data:')) {
          authUpdates.photoURL = avatarUrl
        }
        if (Object.keys(authUpdates).length > 0) {
          await firebaseUpdateProfile(auth.currentUser, authUpdates)
        }
      } catch (err) {
        console.warn('Failed to update live Firebase Authentication details:', err)
      }
    }
  }

  const incrementSearchCount = async () => {
    if (!user) return
    const email = user.email || 'anon'
    const userId = user.uid || user.id || email.toLowerCase()

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'users', userId), { searchesCount: increment(1) }, { merge: true })
        setStats(prev => ({ ...prev, searchesCount: prev.searchesCount + 1 }))
        return
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'users/' + userId)
        } catch (handleErr) {
          console.warn('Firestore write failed (falling back to storage):', handleErr)
        }
      }
    }

    const current = parseInt(localStorage.getItem(`stats_searches_${email}`) || '0', 10)
    const next = current + 1
    localStorage.setItem(`stats_searches_${email}`, String(next))
    setStats(prev => ({ ...prev, searchesCount: next }))
  }

  const incrementPdfCount = async () => {
    if (!user) return
    const email = user.email || 'anon'
    const userId = user.uid || user.id || email.toLowerCase()

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'users', userId), { pdfsCount: increment(1) }, { merge: true })
        setStats(prev => ({ ...prev, pdfsCount: prev.pdfsCount + 1 }))
        return
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'users/' + userId)
        } catch (handleErr) {
          console.warn('Firestore write failed (falling back to storage):', handleErr)
        }
      }
    }

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
      isConfigured: isFirebaseConfigured,
      profile,
      isAdmin,
      stats,
      signUp,
      signIn,
      signOut,
      signInWithGoogle,
      resetPassword,
      changePassword,
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
