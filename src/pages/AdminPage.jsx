import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COLUMNS } from '../lib/golfers'
import './AdminPage.css'

const ADMIN_KEY = 'masters2026_admin'

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(ADMIN_KEY) === 'true')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)
  const [entries, setEntries] = useState([])
  const [settings, setSettings] = useState({ locked: false, entries_visible: false })
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => { if (authed) loadData() }, [authed])

  async function loadData() {
    setLoading(true)
    const [{ data: entriesData }, { data: settingsData }] = await Promise.all([
      supabase.from('entries').select('*').order('created_at', { ascending: true }),
      supabase.from('settings').select('*'),
    ])
    if (entriesData) setEntries(entriesData)
    if (settingsData) {
      const map = {}
      settingsData.forEach(s => { map[s.key] = s.value === 'true' })
      setSettings(map)
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
    await supabase
      .from('settings')
      .update({ value: String(newVal), updated_at: new Date().toISOString() })
      .eq('key', key)
  }

async function toggleis_is_paid(entry) {
    setTogglingId(entry.id)
    const newVal = !entry.is_is_paid
    const { data, error } = await supabase.from('entries').update({ is_is_paid: newVal }).eq('id', entry.id)
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

  // Stats
  const totalEntries = entries.length
  const is_paidEntries = entries.filter(e => e.is_paid).length
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
        {authError && (
          <p style={{ color: '#dc3545', fontSize: 13 }}>Incorrect password.</p>
        )}
        <button className="btn-primary" type="submit">Sign in →</button>
      </form>
    </div>
  )

  if (loading) return <div className="loading">Loading entries...</div>

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
          <p className="stat-label">is_paid</p>
          <p className="stat-value">{is_paidEntries} / {totalEntries}</p>
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

      {/* Settings */}
      <h2 className="admin-section-title">Tournament controls</h2>
      <div className="settings-grid" style={{ marginBottom: '2rem' }}>
        <div className="setting-card">
          <div className="setting-info">
            <p>Lock entries</p>
            <p>{settings.locked ? 'Entries are locked — no new submissions.' : 'Entries are open.'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              className="toggle"
              checked={settings.locked}
              onChange={() => toggleSetting('locked')}
            />
          </div>
        </div>
        <div className="setting-card">
          <div className="setting-info">
            <p>Show entries publicly</p>
            <p>{settings.entries_visible ? 'All picks are visible to everyone.' : 'Picks are hidden from the public.'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              className="toggle"
              checked={settings.entries_visible}
              onChange={() => toggleSetting('entries_visible')}
            />
          </div>
        </div>
      </div>

      {/* Entries table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="admin-section-title" style={{ marginBottom: 0 }}>
          Entries ({totalEntries})
        </h2>
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
                <th>is_paid</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id}>
                  <td style={{ color: 'var(--muted)', width: 32 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {entry.entrant_name}
                  </td>
                  <td>
                    <div className="entry-picks-list">
                      {entry.picks.map((pick, i) => (
                        <div key={i} className="entry-pick-item">
                          <div
                            className="entry-pick-dot"
                            style={{ background: COLUMNS[pick.columnIndex]?.color || '#999' }}
                          />
                          <span className="entry-pick-col">{pick.columnName}</span>
                          <span className="entry-pick-name">{pick.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>{pick.odds}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="is_paid-toggle-cell">
                      <input
                        type="checkbox"
                        className="toggle"
                        checked={entry.is_paid}
                        onChange={() => toggleis_paid(entry)}
                        disabled={togglingId === entry.id}
                      />
                      <span className={`is_paid-label ${entry.is_paid ? 'yes' : ''}`}>
                        {entry.is_paid ? 'is_paid' : 'Unis_paid'}
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
