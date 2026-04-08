import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COLUMNS } from '../lib/golfers'
import InsightsDashboard from '../components/InsightsDashboard'
import './EntriesPage.css'

const TEE_TIME = new Date('2026-04-09T13:00:00+01:00')

function useCountdown(target) {
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    function calc() {
      const diff = target - Date.now()
      if (diff <= 0) return setTimeLeft(null)
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft({ h, m, s, diff })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [target])

  return timeLeft
}

function Countdown() {
  const t = useCountdown(TEE_TIME)

  if (!t) return (
    <div className="countdown-banner">
      <span className="countdown-label">The Masters has begun</span>
      <span className="countdown-sub">Augusta National — Round 1 underway</span>
    </div>
  )

  const pad = n => String(n).padStart(2, '0')
  const days = Math.floor(t.diff / 86400000)

  return (
    <div className="countdown-banner">
      <span className="countdown-label">First tee time</span>
      <div className="countdown-timer">
        {days > 0 && (
          <div className="countdown-unit">
            <span className="countdown-digits">{days}</span>
            <span className="countdown-unit-label">day{days !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="countdown-unit">
          <span className="countdown-digits">{pad(t.h % 24)}</span>
          <span className="countdown-unit-label">hrs</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-digits">{pad(t.m)}</span>
          <span className="countdown-unit-label">min</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-digits">{pad(t.s)}</span>
          <span className="countdown-unit-label">sec</span>
        </div>
      </div>
      <span className="countdown-sub">Thu 9 Apr · 1:00 PM BST · Augusta National</span>
    </div>
  )
}

export default function EntriesPage() {
  const [entries, setEntries] = useState([])
  const [visible, setVisible] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: settingsData } = await supabase.from('settings').select('*')
    const map = {}
    settingsData?.forEach(s => { map[s.key] = s.value })
    setVisible(map.picks_visible === 'true')
    setLocked(map.locked === 'true')
    if (map.picks_visible === 'true') {
      const { data } = await supabase
        .from('entries')
        .select('*')
        .order('created_at', { ascending: true })
      setEntries(data || [])
    }
    setLoading(false)
  }

  const sortedEntries = [...entries].sort((a, b) =>
    a.entrant_name.localeCompare(b.entrant_name)
  )

  const filteredEntries = search.trim()
    ? sortedEntries.filter(entry => {
        const q = search.toLowerCase()
        const nameMatch = entry.entrant_name.toLowerCase().includes(q)
        const pickMatch = entry.picks?.some(p => p.name.toLowerCase().includes(q))
        return nameMatch || pickMatch
      })
    : sortedEntries

  if (loading) return <div className="loading">Loading...</div>

  if (!visible) return (
    <div>
      <h1 className="page-title">All entries</h1>
      <p className="page-sub">Everyone's picks will appear here once entries are revealed.</p>
      <Countdown />
      <div className="empty">
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h3>Not revealed yet</h3>
        <p>Check back once the entry window has closed.</p>
      </div>
    </div>
  )

  return (
    <div>
      <h1 className="page-title">All entries</h1>
      <p className="page-sub">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · £{entries.length * 20} prize pool
        {locked ? ' · Entries are closed.' : ' · Entries still open.'}
      </p>

      <Countdown />

      {entries.length > 0 && <InsightsDashboard entries={entries} />}

      {entries.length === 0 ? (
        <div className="empty">
          <h3>No entries yet</h3>
          <p>Be the first to submit your picks.</p>
        </div>
      ) : (
        <>
          <div className="entries-search-row">
            <input
              className="entries-search"
              type="text"
              placeholder="Search by name or player…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span className="entries-search-count">
                {filteredEntries.length} of {entries.length}
              </span>
            )}
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty">
              <p>No entries match "{search}".</p>
            </div>
          ) : (
            <div className="entries-grid">
              {filteredEntries.map((entry, idx) => (
                <div key={entry.id} className="entry-card">
                  <div className="entry-card-header">
                    <div className="entry-number">#{idx + 1}</div>
                    <div className="entry-name">{entry.entrant_name}</div>
                    {entry.is_paid && <span className="badge badge-green">Paid</span>}
                  </div>
                  <div className="entry-card-picks">
                    {entry.picks.map((pick, i) => (
                      <div key={i} className="entry-card-pick">
                        <div
                          className="entry-card-pick-bar"
                          style={{ background: COLUMNS[pick.columnIndex]?.color || '#ccc' }}
                        />
                        <div>
                          <p className="entry-card-pick-col">{pick.columnName}</p>
                          <p className="entry-card-pick-name">{pick.name}</p>
                        </div>
                        <span className="entry-card-pick-odds">{pick.odds}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
