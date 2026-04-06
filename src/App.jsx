import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import EntryPage from './pages/EntryPage'
import AdminPage from './pages/AdminPage'
import EntriesPage from './pages/EntriesPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="header">
          <div className="header-inner">
            <Link to="/" className="header-logo">
              <span className="header-flag">⛳</span>
              <div>
                <p className="header-title">The Masters 2026</p>
                <p className="header-sub">Sweepstakes</p>
              </div>
            </Link>
            <nav className="header-nav">
              <NavLink to="/" end>Enter</NavLink>
              <NavLink to="/entries">Entries</NavLink>
              <NavLink to="/admin">Admin</NavLink>
            </nav>
          </div>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<EntryPage />} />
            <Route path="/entries" element={<EntriesPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
        <footer className="footer">
          <p>The Masters 2026 Sweepstakes &nbsp;·&nbsp; Entry fee £20 &nbsp;·&nbsp; Good luck</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}
