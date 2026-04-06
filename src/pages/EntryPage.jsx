import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COLUMNS } from '../lib/golfers'
import './EntryPage.css'

const STORAGE_KEY = 'masters2026_edit_token'

export default function EntryPage() {
  const [name, setName] = useState('')
  const [picks, setPicks] = useState(Array(6).fill(null))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editToken, setEditToken] = useState(null)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    try {
      const { data: setting } = await supabase
        .from('settings').select('value').eq('key', 'locked').single()
      if (setting?.value === 'true') { setLocked(true); setLoading(false); return }

      const token = localStorage.getItem(STORAGE_KEY)
      if (token) {
        const { data: entry } = await supabase
          .from('entries').select('*').eq('edit_token', token).single()
        if (entry) {
          setName(entry.entrant_name)
          setPicks(entry.picks)
          setEditToken(token)
          setIsEditing(true)
        }
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function selectGolfer(ci, golfer) {
    const next = [...picks]
    next[ci] = { columnIndex: ci, columnName: COLUMNS[ci].name, ...golfer }
    setPicks(next)
  }

  function handleMouseEnter(e, golfer) {
    if (!golfer.fact) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ fact: golfer.fact, x: rect.right + 10, y: rect.top })
  }

  function handleMouseLeave() {
    setTooltip(null)
  }

  const allPicked = picks.every(p => p !== null)
  const pickedCount = picks.filter(p => p !== null).length

  async function handleSubmit() {
    if (!name.trim() || !allPicked) return
    setSubmitting(true)
    setError(null)
    try {
      if (isEditing && editToken) {
        const { error: err } = await supabase
          .from('entries')
          .update({ entrant_name: name.trim(), picks, updated_at: new Date().toISOString() })
          .eq('edit_token', editToken)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase
          .from('entries').insert({ entrant_name: name.trim(), picks })
          .select('edit_token').single()
        if (err) throw err
        localStorage.setItem(STORAGE_KEY, data.edit_token)
        setEditToken(data.edit_token)
        setIsEditing(true)
      }
      setSubmitted(true)
    } catch (e) {
      setError('Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) return <div className="loading">Loading...</div>

  if (locked) return (
    <div>
      <h1 className="page-title">The Masters 2026 Sweepstakes</h1>
      <p className="page-sub">Entries are now closed. Good luck everyone!</p>
      <div className="notice notice-warn" style={{ maxWidth: 480 }}>
        ⏰ The entry window has closed.{' '}
        <a href="/entries" style={{ color: 'inherit', fontWeight: 500 }}>View all entries →</a>
      </div>
    </div>
  )

  if (submitted) return (
    <div>
      <h1 className="page-title">The Masters 2026 Sweepstakes</h1>
      <p className="page-sub">Entry fee: £20 · Pay before the deadline to confirm your spot.</p>
      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>⛳</div>
          <h2 style={{ fontSize: 24, marginBottom: 6 }}>
            {isEditing ? 'Entry updated!' : 'Entry submitted!'}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {isEditing
              ? `Your picks have been updated, ${name}. You can keep editing until entries are locked.`
              : `You're in, ${name}! Don't forget to pay your £20 entry fee.`}
          </p>
        </div>
        <hr className="divider" />
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
          Your team
        </p>
        <div className="picks-summary">
          {picks.map((pick, i) => (
            <div key={i} className="picks-summary-item">
              <span className="picks-summary-col" style={{ borderLeftColor: COLUMNS[i].color }}>
                {COLUMNS[i].name}
              </span>
              <span className="picks-summary-name">{pick.name}</span>
              <span className="picks-summary-odds">{pick.odds}</span>
            </div>
          ))}
        </div>
        <hr className="divider" />
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          You can return to this page to edit your picks any time before entries are locked.
          Your entry is saved to this browser.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          style={{ fontSize: 13, padding: '7px 14px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ← Edit my picks
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">The Masters 2026 Sweepstakes</h1>
        <p className="page-sub">
          {isEditing
            ? `Welcome back, ${name}. Update your picks below.`
            : 'Pick one golfer from each column. Entry fee: £20.'}
        </p>
        {isEditing && (
          <div className="notice notice-info" style={{ maxWidth: 540, marginTop: 8 }}>
            ✏️ You're editing your existing entry. Changes save when you click Update.
          </div>
        )}
      </div>

      <div className="entry-topbar">
        <div style={{ flex: 1, maxWidth: 300 }}>
          <input
            type="text"
            placeholder="Your name..."
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isEditing}
          />
          {isEditing && (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Name can't be changed after first submission.
            </p>
          )}
        </div>
        <div className="progress-dots">
          {picks.map((p, i) => (
            <div key={i} className={`dot ${p ? 'on' : ''}`} title={COLUMNS[i].name} />
          ))}
          <span className="progress-label">{pickedCount} of 6 picked</span>
        </div>
      </div>

      <div className="columns-grid">
        {COLUMNS.map((col, ci) => (
          <div key={ci} className="column-card">
            <div className="column-header" style={{ borderTopColor: col.color }}>
              <p className="column-name">{col.name}</p>
              <p className={`column-pick-label ${picks[ci] ? 'chosen' : ''}`}>
                {picks[ci] ? `✓ ${picks[ci].name}` : 'Pick one'}
              </p>
            </div>
            <div className="column-body">
              {col.golfers.map((golfer, gi) => (
                <div
                  key={gi}
                  className={`golfer-row ${picks[ci]?.name === golfer.name ? 'selected' : ''}`}
                  onClick={() => selectGolfer(ci, golfer)}
                  onMouseEnter={e => handleMouseEnter(e, golfer)}
                  onMouseLeave={handleMouseLeave}
                >
                  <span className="golfer-name">{golfer.name}</span>
                  <span className="golfer-odds">{golfer.odds}</span>
                  {golfer.fact && (
                    <span className="golfer-info-icon">ℹ</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="golfer-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 1000,
          }}
        >
          {tooltip.fact}
        </div>
      )}

      <div className="team-summary">
        <p className="team-summary-title">Your team</p>
        <div className="team-summary-grid">
          {picks.map((pick, i) => (
            <div key={i} className={`team-pick ${pick ? 'filled' : ''}`}>
              <p className="team-pick-col">{COLUMNS[i].name}</p>
              <p className={`team-pick-name ${!pick ? 'empty' : ''}`}>
                {pick ? pick.name : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {error && <p style={{ color: '#dc3545', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <div className="submit-row">
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!name.trim() || !allPicked || submitting}
          style={{ minWidth: 160 }}
        >
          {submitting ? 'Saving...' : isEditing ? 'Update my picks' : 'Submit entry →'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {!name.trim() && !allPicked
            ? 'Enter your name and pick all 6 golfers.'
            : !name.trim()
            ? 'Enter your name to submit.'
            : !allPicked
            ? `${6 - pickedCount} more pick${6 - pickedCount !== 1 ? 's' : ''} to go.`
            : "You're good to go!"}
        </span>
      </div>
    </div>
  )
}
