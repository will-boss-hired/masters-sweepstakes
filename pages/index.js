import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { COLS } from '../lib/golfers'

export default function Home() {
  const [name, setName] = useState('')
  const [picks, setPicks] = useState(new Array(6).fill(null))
  const [submitted, setSubmitted] = useState(false)
  const [entryId, setEntryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [locked, setLocked] = useState(false)
  const [checkingEntry, setCheckingEntry] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const hideTimer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    async function init() {
      // Check if entries are locked
      const { data: setting } = await supabase.from('settings').select('value').eq('key', 'locked').single()
      if (setting?.value === 'true') { setLocked(true); setCheckingEntry(false); return }

      // Restore existing entry from localStorage
      const stored = localStorage.getItem('entry_id')
      if (stored) {
        const { data } = await supabase.from('entries').select('*').eq('id', stored).single()
        if (data) {
          setName(data.player_name)
          setPicks(data.picks)
          setEntryId(stored)
          setSubmitted(true)
        }
      }
      setCheckingEntry(false)
    }
    init()
  }, [])

  function selectPick(ci, golfer) {
    const next = [...picks]
    next[ci] = golfer
    setPicks(next)
    setSubmitted(false)
  }

  async function handleSubmit() {
    if (!name.trim()) return setError('Please enter your name.')
    if (picks.some(p => !p)) return setError('Please pick one golfer from each column.')
    setLoading(true); setError(null)
    try {
      if (entryId) {
        const { error: e } = await supabase.from('entries').update({
          player_name: name.trim(), picks, updated_at: new Date().toISOString()
        }).eq('id', entryId)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('entries').insert({
          player_name: name.trim(), picks
        }).select().single()
        if (e) throw e
        setEntryId(data.id)
        localStorage.setItem('entry_id', data.id)
      }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function showTooltip(e, golfer, colColor) {
    clearTimeout(hideTimer.current)
    const wrap = wrapRef.current
    if (!wrap) return
    const wr = wrap.getBoundingClientRect()
    const rr = e.currentTarget.getBoundingClientRect()
    setTooltip({ name: golfer.name, fact: golfer.fact, color: colColor, top: rr.top - wr.top, left: rr.right - wr.left + 8, right: null })
  }
  function hideTooltip() { hideTimer.current = setTimeout(() => setTooltip(null), 250) }

  const pickCount = picks.filter(Boolean).length
  const allPicked = pickCount === 6

  if (checkingEntry) return <div className="text-center py-20 text-gray-400">Loading...</div>

  if (locked) return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">🔒</div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Entries are now closed</h1>
      <p className="text-gray-500">The deadline has passed. Check the <a href="/picks" className="text-masters-green underline">picks page</a> and <a href="/leaderboard" className="text-masters-green underline">leaderboard</a>.</p>
    </div>
  )

  return (
    <div ref={wrapRef} className="relative">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">The Masters 2026 — Sweepstakes entry</h1>
        <p className="text-sm text-gray-500 mt-1">Pick one golfer from each column. Hover any name for intel. Entry fee: £20.</p>
      </div>

      {/* Name input + progress */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Your name..."
          value={name}
          onChange={e => { setName(e.target.value); setSubmitted(false) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-masters-green"
        />
        <div className="flex items-center gap-1.5">
          {picks.map((p, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${p ? 'bg-masters-green' : 'bg-gray-200'}`} />
          ))}
          <span className="text-xs text-gray-400 ml-1">{pickCount} of 6 picked</span>
        </div>
      </div>

      {/* 6 columns grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {COLS.map((col, ci) => (
          <div key={ci} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200" style={{ borderTop: `3px solid ${col.color}` }}>
              <p className="text-xs font-semibold text-gray-700 text-center">{col.name}</p>
              <p className={`text-[10px] text-center mt-0.5 truncate ${picks[ci] ? 'text-masters-green' : 'text-gray-400'}`}>
                {picks[ci] ? `✓ ${picks[ci].name}` : 'Pick one'}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto col-scroll">
              {col.g.map((golfer, gi) => {
                const sel = picks[ci]?.name === golfer.name
                return (
                  <div
                    key={gi}
                    onClick={() => selectPick(ci, golfer)}
                    onMouseEnter={e => showTooltip(e, golfer, col.color)}
                    onMouseLeave={hideTooltip}
                    className={`flex justify-between items-center px-2.5 py-1.5 cursor-pointer border-b border-gray-100 last:border-0 transition-colors
                      ${sel ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`text-[11px] ${sel ? 'text-masters-green font-semibold' : 'text-gray-800'}`}>{golfer.name}</span>
                    <span className={`text-[10px] ml-2 flex-shrink-0 ${sel ? 'text-masters-green' : 'text-gray-400'}`}>{golfer.odds}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Your team summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Your team</p>
        <div className="grid grid-cols-3 gap-3">
          {COLS.map((col, ci) => (
            <div key={ci} className={`pl-2 border-l-2 ${picks[ci] ? 'border-masters-green' : 'border-gray-200'}`}>
              <p className="text-[10px] text-gray-400">{col.name}</p>
              <p className={`text-xs font-medium ${picks[ci] ? 'text-gray-800' : 'text-gray-300 italic'}`}>
                {picks[ci] ? picks[ci].name : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !allPicked || loading}
          className="px-5 py-2 bg-masters-green text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-masters-dark transition-colors"
        >
          {loading ? 'Saving...' : entryId ? 'Update my picks' : 'Submit entry'}
        </button>
        {submitted && (
          <span className="text-xs text-masters-green font-medium">✓ Entry saved! You can update your picks until the deadline.</span>
        )}
        {!submitted && (
          <span className="text-xs text-gray-400">
            {!name.trim() && !allPicked ? 'Enter your name and pick all 6 golfers.' :
             !name.trim() ? 'Enter your name to submit.' :
             !allPicked ? `${6 - pickCount} more pick${6 - pickCount !== 1 ? 's' : ''} to go.` : "You're good to go!"}
          </span>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="tooltip-enter absolute z-50 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3 pointer-events-none"
          style={{ top: tooltip.top, left: tooltip.left, borderTop: `3px solid ${tooltip.color}` }}
        >
          <p className="text-xs font-semibold text-gray-800 mb-1">{tooltip.name}</p>
          <p className="text-[11px] text-gray-600 leading-relaxed">{tooltip.fact}</p>
        </div>
      )}
    </div>
  )
}
