import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COLUMNS } from '../lib/golfers'
import InsightsDashboard from '../components/InsightsDashboard'
import './EntriesPage.css'

export default function EntriesPage() {
  const [entries, setEntries] = useState([])
  const [visible, setVisible] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <div className="loading">Loading...</div>

  if (!visible) return (
    <div>
      <h1 className="page-title">All entries</h1>
      <p className="page-sub">Everyone's picks will appear here once entries are revealed.</p>
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

      {entries.length > 0 && <InsightsDashboard entries={entries} />}

      {entries.length === 0 ? (
        <div className="empty">
          <h3>No entries yet</h3>
          <p>Be the first to submit your picks.</p>
        </div>
      ) : (
        <div className="entries-grid">
          {entries.map((entry, idx) => (
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
    </div>
  )
}
