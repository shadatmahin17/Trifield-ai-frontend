import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Search, FileText, Quote, FlaskConical, Layers } from 'lucide-react'
import SearchPage     from './pages/SearchPage.jsx'
import PDFPage        from './pages/PDFPage.jsx'
import CitationsPage  from './pages/CitationsPage.jsx'
import styles from './App.module.css'

function Nav() {
  const loc = useLocation()
  const links = [
    { to: '/',          icon: Search,       label: 'Search'    },
    { to: '/pdf',       icon: FileText,     label: 'PDF Chat'  },
    { to: '/citations', icon: Quote,        label: 'Citations' },
  ]
  return (
    <nav className={styles.nav}>
      <NavLink to="/" className={styles.logo}>
        <Layers size={22} strokeWidth={1.5} />
        <span>TriField<em>AI</em></span>
      </NavLink>

      <div className={styles.links}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={15} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className={styles.disciplines}>
        <span>Aerospace</span>
        <span className={styles.dot}>·</span>
        <span>Materials</span>
        <span className={styles.dot}>·</span>
        <span>Textile</span>
      </div>
    </nav>
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
