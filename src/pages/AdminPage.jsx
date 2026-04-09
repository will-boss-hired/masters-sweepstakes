import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COLUMNS } from '../lib/golfers'
import './AdminPage.css'

const ADMIN_KEY = 'masters2026_admin'

const MISSED_CUT = new Set([
  'STATUS_MISSED_CUT', 'STATUS_WITHDRAWN', 'STATUS_DISQUALIFIED', 'STATUS_CUT',
])

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseScore(str) {
  if (!str || str === 'E' || str === 'Even') return 0
  if (str === '-' || str === '' || str === '--') return null
  const n = parseInt(str.replace('+', ''), 10)
  return isNaN(n) ? null : n
}

function formatScore(n) {
  if (n === null || n === undefined) return '—'
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : String(n)
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(ADMIN_KEY) === 'true')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)
  const [entries, setEntries] = useState([])
  const [golfers, setGolfers] = useState([])
  const [settings, setSettings] = useState({ locked: false, picks_visible: false })
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (authed) loadData() }, [authed])

  async function loadData() {
    setLoading(true)
    const [{ data: entriesData }, { data: settingsData }, scoresRes] = await Promise.all([
      supabase.from('entries').select('*').order('created_at', { ascending: true }),
      supabase.from('settings').select('*'),
      fetch('/api/leaderboard'),
    ])
    if (entriesData) setEntries(entriesData)
    if (settingsData) {
      const map = {}
      settingsData.forEach(s => { map[s.key] = s.value === 'true' })
      setSettings(map)
    }
    if (scoresRes.ok) {
      const scoresData = await scoresRes.json()
      setGolfers(scoresData.golfers || [])
    }
    setLoading(false)
  }

  function handleLogin(e) {
    e.preventDefault()
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_KEY, 'true')
      setAuthed(true)
    } else {
      setAuthError(true)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_KEY)
    setAuthed(false)
  }

  async function toggleSetting(key) {
    const newVal = !settings[key]
    setSettings(prev => ({ ...prev, [key]: newVal }))
    await supabase.from('settings').update({ value: String(newVal) }).eq('key', key)
  }

  async function togglePaid(entry) {
    setTogglingId(entry.id)
    const newVal = !entry.is_paid
    const { data, error } = await supabase.from('entries').update({ is_paid: newVal }).eq('id', entry.id)
    console.log('Update result:', { data, error, id: entry.id, newVal })
    if (!error) {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_paid: newVal } : e))
    }
    setTogglingId(null)
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    await supabase.from('entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // ── Scoring engine (mirrors LeaderboardPage) ──────────────────

  function buildRankings() {
    const golferMap = new Map()
    golfers.forEach(g => golferMap.set(normalizeName(g.name), g))

    const calculated = entries.map(entry => {
      const picks = (entry.picks || []).map(pick => {
        const golfer = golferMap.get(normalizeName(pick.name))
        if (!golfer) return { ...pick, score: null, found: false, madeCut: true }
        const score = parseScore(golfer.score)
        const madeCut = !MISSED_CUT.has(golfer.status)
        return { ...pick, score, found: true, madeCut, thru: golfer.thru || '', position: golfer.position || '-' }
      })

      const withScores = picks.filter(p => p.found && p.score !== null)
      const madeCutPicks = picks.filter(p => p.found && p.madeCut)
      const sorted = [...withScores].sort((a, b) => a.score - b.score)
      const counting = sorted.slice(0, 3)
      const teamScore = counting.length >= 3 ? counting.reduce((s, p) => s + p.score, 0) : null
      const allSixScore = withScores.length > 0 ? withScores.reduce((s, p) => s + p.score, 0) : null
      const qualified = madeCutPicks.length >= 3

      return { ...entry, picks, teamScore, allSixScore, qualified, madeCutCount: madeCutPicks.length, sortedPicks: sorted }
    })

    const sorted = [...calculated].sort((a, b) => {
      const aElim = !a.qualified, bElim = !b.qualified
      if (aElim && !bElim) return 1
      if (!aElim && bElim) return -1
      if (a.teamScore === null && b.teamScore === null) return 0
      if (a.teamScore === null) return 1
      if (b.teamScore === null) return -1
      if (a.teamScore !== b.teamScore) return a.teamScore - b.teamScore
      if (a.madeCutCount !== b.madeCutCount) return b.madeCutCount - a.madeCutCount
      const aAll = a.allSixScore ?? 999, bAll = b.allSixScore ?? 999
      if (aAll !== bAll) return aAll - bAll
      for (let i = 3; i < 6; i++) {
        const aS = a.sortedPicks?.[i]?.score ?? 999
        const bS = b.sortedPicks?.[i]?.score ?? 999
        if (aS !== bS) return aS - bS
      }
      return a.entrant_name.localeCompare(b.entrant_name)
    })

    let displayRank = 1
    return sorted.map((entry, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1]
        const tied = entry.teamScore !== null && entry.teamScore === prev.teamScore && entry.qualified === prev.qualified
        if (!tied) displayRank = idx + 1
      }
      return { ...entry, rank: displayRank }
    })
  }

  // ── Generate export text ──────────────────────────────────────

  function generateExportText() {
    const rankings = buildRankings()
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const lines = []

    lines.push(`MASTERS 2026 — STANDINGS (as of ${now})`)
    lines.push(`${'─'.repeat(50)}`)
    lines.push('')

    rankings.forEach((entry, idx) => {
      const rank = entry.teamScore !== null && entry.qualified ? `#${entry.rank}` : '—'
      const team = entry.teamScore !== null ? formatScore(entry.teamScore) : 'pending'
      const allSix = entry.allSixScore !== null ? formatScore(entry.allSixScore) : '—'
      const cutInfo = `${entry.madeCutCount}/6 through cut`

      lines.push(`${rank.padEnd(4)} ${entry.entrant_name.padEnd(22)} Team: ${team.padEnd(6)} All-6: ${allSix.padEnd(6)} (${cutInfo})`)

      entry.picks.forEach(pick => {
        const score = pick.found ? formatScore(pick.score) : 'n/a'
        const thru = pick.thru ? `thru ${pick.thru}` : ''
        const pos = pick.position || ''
        lines.push(`      • ${pick.name.padEnd(24)} ${score.padEnd(6)} ${pos.padEnd(6)} ${thru}`)
      })

      lines.push('')
    })

    return lines.join('\n')
  }

  function handleCopy() {
    const text = generateExportText()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Stats
  const totalEntries = entries.length
  const paidEntries = entries.filter(e => e.is_paid).length
  const prizePool = totalEntries * 20
  const prizes = {
    first: Math.round(prizePool * 0.70),
    second: Math.round(prizePool * 0.20),
    third: Math.round(prizePool * 0.10),
  }

  if (!authed) return (
    <div className="admin-login">
      <h2>Admin login</h2>
      <p>Enter the admin password to manage entries.</p>
      <form onSubmit={handleLogin}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setAuthError(false) }}
          autoFocus
        />
        {authError && <p style={{ color: '#dc3545', fontSize: 13 }}>Incorrect password.</p>}
        <button className="btn-primary" type="submit">Sign in →</button>
      </form>
    </div>
  )

  if (loading) return <div className="loading">Loading entries...</div>

  const exportText = generateExportText()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Admin panel</h1>
          <p className="page-sub">Manage entries, payments and tournament settings.</p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Sign out</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Total entries</p>
          <p className="stat-value">{totalEntries}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Paid</p>
          <p className="stat-value">{paidEntries} / {totalEntries}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Prize pool</p>
          <p className="stat-value">£{prizePool}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Prizes (1st / 2nd / 3rd)</p>
          <p className="stat-value" style={{ fontSize: 16, paddingTop: 4 }}>
            £{prizes.first} / £{prizes.second} / £{prizes.third}
          </p>
        </div>
      </div>

      {/* ── Round summary export ────────────────────────────── */}
      <h2 className="admin-section-title">Round summary export</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Copy this and paste into the chat to generate a WhatsApp update.
      </p>
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <textarea
          readOnly
          value={exportText}
          style={{
            width: '100%',
            height: 320,
            fontFamily: 'monospace',
            fontSize: 12,
            padding: '12px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--card)',
            color: 'var(--text)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          onClick={e => e.target.select()}
        />
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontSize: 12,
            padding: '5px 12px',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: copied ? '#27ae60' : 'var(--card)',
            color: copied ? '#fff' : 'var(--text)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy all'}
        </button>
      </div>

      {/* Settings */}
      <h2 className="admin-section-title">Tournament controls</h2>
      <div className="settings-grid" style={{ marginBottom: '2rem' }}>
        <div className="setting-card">
          <div className="setting-info">
            <p>Lock entries</p>
            <p>{settings.locked ? 'Entries are locked — no new submissions.' : 'Entries are open.'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" className="toggle" checked={settings.locked} onChange={() => toggleSetting('locked')} />
          </div>
        </div>
        <div className="setting-card">
          <div className="setting-info">
            <p>Show entries publicly</p>
            <p>{settings.picks_visible ? 'All picks are visible to everyone.' : 'Picks are hidden from the public.'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" className="toggle" checked={settings.picks_visible} onChange={() => toggleSetting('picks_visible')} />
          </div>
        </div>
      </div>

      {/* Entries table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="admin-section-title" style={{ marginBottom: 0 }}>Entries ({totalEntries})</h2>
        <button
          className="btn-secondary btn-sm"
          onClick={loadData}
          style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ↻ Refresh
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <h3>No entries yet</h3>
          <p>Share the link with your group to start collecting picks.</p>
        </div>
      ) : (
        <div className="entries-table-wrap">
          <table className="entries-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Picks</th>
                <th>Paid</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id}>
                  <td style={{ color: 'var(--muted)', width: 32 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{entry.entrant_name}</td>
                  <td>
                    <div className="entry-picks-list">
                      {entry.picks.map((pick, i) => (
                        <div key={i} className="entry-pick-item">
                          <div className="entry-pick-dot" style={{ background: COLUMNS[pick.columnIndex]?.color || '#999' }} />
                          <span className="entry-pick-col">{pick.columnName}</span>
                          <span className="entry-pick-name">{pick.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>{pick.odds}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="paid-toggle-cell">
                      <input
                        type="checkbox"
                        className="toggle"
                        checked={entry.is_paid}
                        onChange={() => togglePaid(entry)}
                        disabled={togglingId === entry.id}
                      />
                      <span className={`paid-label ${entry.is_paid ? 'yes' : ''}`}>
                        {entry.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {new Date(entry.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      style={{ fontSize: 11, color: '#dc3545', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
