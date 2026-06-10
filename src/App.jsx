import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Search, FileText, Quote, Telescope, BarChart2, LogOut } from 'lucide-react'
import SearchPage    from './pages/SearchPage.jsx'
import PDFPage       from './pages/PDFPage.jsx'
import CitationsPage from './pages/CitationsPage.jsx'
import CopilotPage   from './pages/CopilotPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import ProfilePage   from './pages/ProfilePage.jsx'
import LoginPage     from './pages/LoginPage.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import styles from './App.module.css'
import logoUrl from '../logo.png'

function Sidebar() {
  const { user, signOut, profile, isAdmin } = useAuth()
  
  const links = [
    { to: '/',           icon: Search,    label: 'Search'    },
    { to: '/pdf',        icon: FileText,  label: 'PDF Chat'  },
    { to: '/citations',  icon: Quote,     label: 'Citations' },
    { to: '/copilot',    icon: Telescope, label: 'Copilot'   },
    ...(isAdmin ? [{ to: '/analytics',  icon: BarChart2, label: 'Analytics' }] : [])
  ]

  return (
    <aside className={styles.sidebar} aria-label="Primary navigation">
      <NavLink to="/" className={styles.logo} aria-label="TriField AI home">
        <img src={logoUrl} alt="TriField AI" className={styles.logoImage} />
      </NavLink>

      <nav className={styles.links}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={17} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Authenticated User Status Container */}
      {user && (
        <div className={styles.userSection}>
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `${styles.userCard} ${isActive ? styles.userCardActive : ''}`}
            title="Click to manage profile and view stats"
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="User Avatar" className={styles.userAvatar} />
            ) : (
              <div className={styles.userPlaceholder}>
                {profile.displayName ? profile.displayName[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
              </div>
            )}
            <div className={styles.userInfo}>
              <span className={styles.userName}>{profile.displayName || user.email.split('@')[0]}</span>
              <span className={styles.userRole}>
                <span className={styles.roleDot} style={{ background: isAdmin ? '#854836' : '#277A38' }} />
                {isAdmin ? 'Admin' : 'Researcher'}
              </span>
            </div>
          </NavLink>
          <button
            onClick={() => signOut()}
            className={styles.userSignOut}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  )
}

function AppContent() {
  const { user, loading, isAdmin, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#854836] border-t-transparent" />
          <p className="text-xs font-medium text-[#6E6E6E] tracking-widest uppercase">Initializing Portal...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <BrowserRouter>
      <div className={styles.shell}>
        <div className={styles.mobileHeader}>
          <NavLink to="/" className={styles.mobileLogo} aria-label="TriField AI home">
            <img src={logoUrl} alt="TriField AI" className={styles.mobileLogoImage} />
          </NavLink>
          {user && (
            <NavLink to="/profile" className={styles.mobileAvatarLink} title="View Profile">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className={styles.mobileAvatarImg} />
              ) : (
                <div className={styles.mobileAvatarPlaceholder}>
                  {profile.displayName ? profile.displayName[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
                </div>
              )}
            </NavLink>
          )}
        </div>
        <Sidebar />
        <main className={styles.main}>
          <Routes>
            <Route path="/"          element={<SearchPage />}    />
            <Route path="/pdf"       element={<PDFPage />}       />
            <Route path="/citations" element={<CitationsPage />} />
            <Route path="/copilot"   element={<CopilotPage />}   />
            <Route path="/profile"   element={<ProfilePage />}   />
            <Route path="/analytics" element={isAdmin ? <AnalyticsPage /> : <Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

