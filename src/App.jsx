import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Search, FileText, Quote, FlaskConical, BarChart2 } from 'lucide-react'
import SearchPage    from './pages/SearchPage.jsx'
import PDFPage       from './pages/PDFPage.jsx'
import CitationsPage from './pages/CitationsPage.jsx'
import CopilotPage   from './pages/CopilotPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import styles from './App.module.css'
import logoUrl from '../logo.png'

function Sidebar() {
  const links = [
    { to: '/',          icon: Search,       label: 'Search'    },
    { to: '/copilot',   icon: FlaskConical, label: 'Copilot'   },
    { to: '/pdf',       icon: FileText,     label: 'PDF Chat'  },
    { to: '/citations', icon: Quote,        label: 'Citations' },
    { to: '/analytics', icon: BarChart2,    label: 'Analytics' },
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

      <div className={styles.disciplines} aria-label="Research disciplines">
        <span>Aerospace</span>
        <span className={styles.dot}>·</span>
        <span>Materials</span>
        <span className={styles.dot}>·</span>
        <span>Textile</span>
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>
          <Routes>
            <Route path="/"          element={<SearchPage />}    />
            <Route path="/copilot"   element={<CopilotPage />}   />
            <Route path="/pdf"       element={<PDFPage />}       />
            <Route path="/citations" element={<CitationsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
