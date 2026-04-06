import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { COLS } from '../lib/golfers'

const COL_COLORS = COLS.map(c => c.color)

export default function Picks() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'picks_visible').single()
      if (s?.value !== 'true') { setLoading(false); return }
      setVisible(true)
      const { data } = await supabase.from('entries').select('*').order('player_name')
      setEntries(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>

  if (!visible) return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">🙈</div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Picks are hidden until the deadline passes</h1>
      <p className="text-gray-500">Check back after entries are locked to see everyone's teams.</p>
    </div>
  )

  const filtered = entries.filter(e =>
    e.player_name.toLowerCase().includes(search.toLowerCase()) ||
    e.picks?.some(p => p?.name?.toLowerCase().includes(search.toLowerCase()))
  )

  // Find which golfer is most popular in each column
  const popularity = COLS.map((_, ci) => {
    const counts = {}
    entries.forEach(e => { const n = e.picks?.[ci]?.name; if (n) counts[n] = (counts[n] || 0) + 1 })
    return counts
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All picks</h1>
          <p className="text-sm text-gray-500">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} submitted</p>
        </div>
        <input
          type="text"
          placeholder="Search by name or golfer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:border-masters-green"
        />
      </div>

      {/* Quick popularity stats */}
      <div className="bg-masters-light border border-green-200 rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-masters-green mb-3">Most popular picks</p>
        <div className="grid grid-cols-3 gap-3">
          {COLS.map((col, ci) => {
            const counts = popularity[ci]
            const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]
            return (
              <div key={ci} className="pl-2 border-l-2" style={{ borderColor: col.color }}>
                <p className="text-[10px] text-gray-500">{col.name}</p>
                <p className="text-xs font-medium text-gray-800">{top ? top[0] : '—'}</p>
                {top && <p className="text-[10px] text-gray-400">{top[1]} pick{top[1]!==1?'s':''}</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Entries table */}
      <div className="space-y-2">
        {filtered.map(entry => (
          <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900">{entry.player_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${entry.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-600'}`}>
                {entry.is_paid ? '✓ Paid' : 'Awaiting payment'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {entry.picks?.map((pick, ci) => (
                <div key={ci} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COL_COLORS[ci] }} />
                  <span className="text-xs text-gray-700 truncate">{pick?.name || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No entries match your search.</div>
        )}
      </div>
    </div>
  )
}
