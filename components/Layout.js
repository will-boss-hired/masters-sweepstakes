import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Layout({ children }) {
  const router = useRouter()
  const links = [
    { href: '/', label: 'Enter Picks' },
    { href: '/picks', label: 'All Picks' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ]
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-masters-dark text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-masters-gold text-xl">⛳</span>
            <div>
              <p className="font-semibold text-sm leading-none">The Masters 2026</p>
              <p className="text-green-300 text-xs">Sweepstakes</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  router.pathname === l.href
                    ? 'bg-masters-green text-white'
                    : 'text-green-200 hover:text-white hover:bg-white/10'
                }`}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-gray-400 py-6">
        The Masters 2026 Sweepstakes · Entry fee £20 · Good luck!
      </footer>
    </div>
  )
}
