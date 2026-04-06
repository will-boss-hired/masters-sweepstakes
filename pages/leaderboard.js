import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function parseScore(s) {
  if (!s || s === 'E') return 0
  if (s === '-') return null
  return parseInt(s.replace('+', ''), 10)
}

function calcEntry(entry, scoreMap) {
  const picks = entry.picks || []
  const results = picks.map(p => {
    if (!p) return null
    const d = scoreMap[p.name?.toLowerCase()]
    return d ? { name: p.name, score: d.score, madeCut: d.madeCut, position: d.position } : { name: p.name, score: null, madeCut: null, position: null }
  })

  const cutPlayers = results.filter(r => r?.madeCut === true)
  const dq = cutPlayers.length < 3
  const scored = cutPlayers.filter(r => r.score !== null).sort((a, b) => a.score - b.score)
  const teamScore = dq ? null : scored.slice(0, 3).reduce((s, r) => s + r.score, 0)

  return { ...entry, results, cutCount: cutPlayers.length, teamScore, dq }
}

function fmtScore(s) {
  if (s === null || s === undefined) return '—'
  if (s === 0) return 'E'
  return s > 0 ? `+${s}` : `${s}`
}

export default function Leaderboard() {
  const [entries, setEntries] = useState([])
  const [scores, setScores] = useState({})
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  async function fetchScores() {
    try {
      const res = await fetch('/api/scores')
      const data = await res.json()
      if (data.scoreMap) { setScores(data.scoreMap); setEvent(data.event); setLastUpdate(new Date()) }
    } catch {}
  }

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'picks_visible').single()
      if (s?.value !== 'true') { setLoading(false); return }
      setVisible(true)
      const { data } = await supabase.from('entries').select('*').order('player_name')
      setEntries(data || [])
      await fetchScores()
      setLoading(false)
    }
    load()
    const interval = setInterval(fetchScores, 60000) // refresh every 60s
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>

  if (!visible) return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">⛳</div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Leaderboard not yet available</h1>
      <p className="text-gray-500">The leaderboard will go live once entries close and the tournament begins.</p>
    </div>
  )

  const calculated = entries.map(e => calcEntry(e, scores))
  calculated.sort((a, b) => {
    if (a.dq && b.dq) return a.player_name.localeCompare(b.player_name)
    if (a.dq) return 1
    if (b.dq) return -1
    if (a.teamScore === null && b.teamScore === null) return a.player_name.localeCompare(b.player_name)
    if (a.teamScore === null) return 1
    if (b.teamScore === null) return -1
    if (a.teamScore !== b.teamScore) return a.teamScore - b.teamScore
    // Tiebreaker 1: most cuts made
    if (a.cutCount !== b.cutCount) return b.cutCount - a.cutCount
    // Tiebreaker 2: 4th, 5th, 6th pick scores
    for (let i = 3; i < 6; i++) {
      const aS = a.results[i]?.score ?? 99; const bS = b.results[i]?.score ?? 99
      if (aS !== bS) return aS - bS
    }
    return 0
  })

  const prizes = [70, 20, 10]
  const totalPool = entries.filter(e => e.is_paid).length * 20

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leaderboard</h1>
          {event && <p className="text-sm text-gray-500">{event}</p>}
        </div>
        <div className="text-right">
          {totalPool > 0 && (
            <div className="flex gap-3 text-xs text-gray-500">
              <span>🥇 £{Math.floor(totalPool * 0.70)}</span>
              <span>🥈 £{Math.floor(totalPool * 0.20)}</span>
              <span>🥉 £{Math.floor(totalPool * 0.10)}</span>
            </div>
          )}
          {lastUpdate && <p className="text-[10px] text-gray-400 mt-1">Updated {lastUpdate.toLocaleTimeString()}</p>}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {calculated.map((entry, idx) => {
          const pos = entry.dq ? null : idx + 1
          const medals = ['🥇','🥈','🥉']
          return (
            <div key={entry.id} className={`bg-white border rounded-xl p-4 ${entry.dq ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base w-6 text-center">{pos && pos <= 3 ? medals[pos-1] : pos ? <span className="text-sm text-gray-400 font-semibold">{pos}</span> : '❌'}</span>
                  <p className="font-semibold text-gray-900">{entry.player_name}</p>
                  {entry.dq && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">DQ — fewer than 3 through cut</span>}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${entry.teamScore < 0 ? 'text-masters-green' : entry.teamScore > 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {entry.teamScore !== null ? fmtScore(entry.teamScore) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">team score (best 3)</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {entry.results.map((r, ri) => (
                  <div key={ri} className={`rounded-lg px-2 py-1.5 text-[11px] flex justify-between items-center
                    ${r?.madeCut === false ? 'bg-red-50 text-red-400' :
                      r?.madeCut === true ? 'bg-green-50 text-gray-700' : 'bg-gray-50 text-gray-500'}`}>
                    <span className="truncate">{r?.name || '—'}</span>
                    <span className="ml-2 font-semibold flex-shrink-0">
                      {r?.score !== null && r?.score !== undefined ? fmtScore(r.score) : r?.madeCut === false ? 'CUT' : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">{entry.cutCount} player{entry.cutCount !== 1 ? 's' : ''} through the cut</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
