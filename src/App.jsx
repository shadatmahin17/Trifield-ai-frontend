import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Search, FileText, Quote, Telescope, BarChart2, LogOut, PanelLeftClose, PanelLeft, Plus, BookOpen } from 'lucide-react'
import Lottie from 'lottie-react'
import SearchPage    from './pages/SearchPage.jsx'
import LibraryPage   from './pages/LibraryPage.jsx'
import PDFPage       from './pages/PDFPage.jsx'
import CitationsPage from './pages/CitationsPage.jsx'
import CopilotPage   from './pages/CopilotPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import ProfilePage   from './pages/ProfilePage.jsx'
import LoginPage     from './pages/LoginPage.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import styles from './App.module.css'
import logoUrl from '../logo.png'
import loadingAnimation from './assets/loading-animation.json'

function Sidebar({ collapsed, onToggle }) {
  const { user, signOut, profile, isAdmin } = useAuth()
  
  const links = [
    { to: '/',           icon: Search,    label: 'Search'    },
    { to: '/library',    icon: BookOpen,  label: 'Library'   },
    { to: '/pdf',        icon: FileText,  label: 'PDF Chat'  },
    { to: '/citations',  icon: Quote,     label: 'Citations' },
    { to: '/copilot',    icon: Telescope, label: 'Copilot'   },
    ...(isAdmin ? [{ to: '/analytics',  icon: BarChart2, label: 'Analytics' }] : [])
  ]

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`} aria-label="Primary navigation">
      <div className={styles.sidebarHeader}>
        {!collapsed ? (
          <>
            <NavLink to="/" className={styles.logo} aria-label="TriField AI home">
              <img src={logoUrl} alt="TriField AI" className={styles.logoImage} />
            </NavLink>
            <button 
              onClick={onToggle}
              className={styles.collapseButton}
              title="Minimize sidebar"
              aria-label="Minimize sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        ) : (
          <button 
            onClick={onToggle}
            className={styles.collapseButton}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeft size={18} />
          </button>
        )}
      </div>

      <nav className={styles.links}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={17} strokeWidth={2} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Authenticated User Status Container */}
      {user && (
        <div className={styles.userSection}>
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `${styles.userCard} ${isActive ? styles.userCardActive : ''}`}
            title={collapsed ? "Manage Profile" : "Click to manage profile and view stats"}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="User Avatar" className={styles.userAvatar} />
            ) : (
              <div className={styles.userPlaceholder}>
                {profile.displayName ? profile.displayName[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>{profile.displayName || user.email.split('@')[0]}</span>
                <span className={styles.userRole}>
                  <span className={styles.roleDot} style={{ background: isAdmin ? '#854836' : '#277A38' }} />
                  {isAdmin ? 'Admin' : 'Researcher'}
                </span>
              </div>
            )}
          </NavLink>
          <button
            onClick={() => signOut()}
            className={styles.userSignOut}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut size={14} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </aside>
  )
}

function AppContent() {
  const { user, loading, isAdmin, profile } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    }
    return false
  })

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  if (loading) {
    return (
      <div className={`${styles.loadingOverlay} ${sidebarCollapsed ? styles.loadingOverlayCollapsed : ''}`}>
        <div className="flex flex-col items-center justify-center">
          <div style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lottie animationData={loadingAnimation} loop={true} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <BrowserRouter>
      <div className={`${styles.shell} ${sidebarCollapsed ? styles.shellCollapsed : ''}`}>
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

        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main className={styles.main}>
          <Routes>
            <Route path="/"          element={<SearchPage />}    />
            <Route path="/library"   element={<LibraryPage />}   />
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

