import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Search, FileText, Quote, Menu, X, Compass } from 'lucide-react'
import SearchPage     from './pages/SearchPage.jsx'
import PDFPage        from './pages/PDFPage.jsx'
import CitationsPage  from './pages/CitationsPage.jsx'
import styles from './App.module.css'
import logoUrl from '../logo.png'
import faviconUrl from '../favicon.png'

function Nav() {
  const loc = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false)
  }, [loc.pathname])

  const links = [
    { to: '/',          icon: Search,       label: 'Search'    },
    { to: '/pdf',       icon: FileText,     label: 'PDF Chat'  },
    { to: '/citations', icon: Quote,        label: 'Citations' },
  ]

  const disciplines = [
    { name: 'Aerospace', color: '#3AA0FF' },
    { name: 'Materials Science', color: '#E8C87A' },
    { name: 'Textile Engineering', color: '#7BC4FF' },
  ]

  return (
    <>
      {/* Mobile Top Header */}
      <header className={styles.mobileHeader}>
        <NavLink to="/" className={styles.logoMobile}>
         <img
            src={logoUrl}
            alt="TriField AI logo"
            className={styles.logoMobileImage}
          />
        </NavLink>
        <button 
          className={styles.menuToggle} 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Overlay Backdrop for Mobile */}
      {isOpen && (
        <div 
          className={styles.backdrop} 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <NavLink to="/" className={styles.logo}>
            <img
              src={logoUrl}
              alt="TriField AI logo"
              className={styles.logoImage}
            />
            <img
              src={faviconUrl}
              alt="TriField AI logo"
              className={styles.logoCompactImage}
            />
          </NavLink>
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
            >
              <Icon size={16} strokeWidth={2} className={styles.linkIcon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer / Context panel inside sidebar */}
        <div className={styles.sidebarFooter}>
          <div className={styles.disciplinesHeader}>
            <Compass size={12} className={styles.compassIcon} />
            <span>DISCIPLINES</span>
          </div>
          <div className={styles.disciplinesList}>
            {disciplines.map((d, i) => (
              <div key={i} className={styles.disciplineItem}>
                <span className={styles.bullet} style={{ background: d.color }} />
                <span className={styles.disciplineName}>{d.name}</span>
              </div>
            ))}
          </div>
          <div className={styles.copyright}>
            <p>TriField AI Project</p>
            <p className={styles.version}>v1.1.0 · Connected</p>
          </div>
        </div>
      </aside>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className={styles.shell}>
        <Nav />
        <main className={styles.main}>
          <Routes>
            <Route path="/"          element={<SearchPage />} />
            <Route path="/pdf"       element={<PDFPage />} />
            <Route path="/citations" element={<CitationsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
