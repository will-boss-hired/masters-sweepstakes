import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

Admin.noLayout = true

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState('entries')
  const [entries, setEntries] = useState([])
  const [settings, setSettings] = useState({ locked: 'false', picks_visible: 'false' })
  const [saving, setSaving] = useState(false)

  async function login() {
    const res = await fetch('/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
    if (res.ok) { setAuthed(true); loadData() }
    else { setPwError(true); setTimeout(() => setPwError(false), 2000) }
  }

  async function loadData() {
    const { data: e } = await supabase.from('entries').select('*').order('submitted_at', { ascending: false })
    setEntries(e || [])
    const { data: s } = await supabase.from('settings').select('*')
    if (s) {
      const map = {}; s.forEach(r => { map[r.key] = r.value }); setSettings(map)
    }
  }

  async function toggleSetting(key) {
    const next = settings[key] === 'true' ? 'false' : 'true'
    setSettings(prev => ({ ...prev, [key]: next }))
    await supabase.from('settings').upsert({ key, value: next }, { onConflict: 'key' })
  }

  async function togglePaid(id, current) {
    await supabase.from('entries').update({ is_paid: !current }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_paid: !current } : e))
  }

  async function deleteEntry(id, name) {
    if (!confirm(`Delete entry for ${name}? This cannot be undone.`)) return
    await supabase.from('entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const paidCount = entries.filter(e => e.is_paid).length
  const pool = paidCount * 20

  if (!authed) return (
    <div className="min-h-screen bg-masters-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <span className="text-4xl">⛳</span>
          <h1 className="text-lg font-semibold text-gray-900 mt-2">Admin access</h1>
          <p className="text-sm text-gray-500">The Masters 2026 Sweepstakes</p>
        </div>
        <input
          type="password"
          placeholder="Password..."
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className={`w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none ${pwError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-masters-green'}`}
        />
        {pwError && <p className="text-xs text-red-500 mb-3 text-center">Incorrect password</p>}
        <button onClick={login} className="w-full bg-masters-green text-white rounded-lg py-2 text-sm font-medium hover:bg-masters-dark transition-colors">
          Log in
        </button>
      </div>
    </div>
  )

  const tabs = ['entries', 'settings']

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-masters-dark text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-masters-gold">⛳</span>
          <span className="font-semibold text-sm">Admin — The Masters 2026</span>
        </div>
        <div className="flex gap-3 text-xs text-green-300">
          <span>{entries.length} entries</span>
          <span>{paidCount} paid</span>
          <span>Pool: £{pool}</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-masters-green text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-masters-green'}`}>
              {t === 'entries' ? `Entries (${entries.length})` : t}
            </button>
          ))}
        </div>

        {/* Settings tab */}
        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Tournament controls</h2>
              {[
                { key: 'locked', label: 'Lock entries', desc: 'Prevents any new submissions or edits. Do this at the deadline.' },
                { key: 'picks_visible', label: 'Show picks & leaderboard', desc: 'Makes the picks page and leaderboard visible to everyone.' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <button onClick={() => toggleSetting(key)}
                    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${settings[key] === 'true' ? 'bg-masters-green' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow mt-1 transition-transform ${settings[key] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
            {pool > 0 && (
              <div className="bg-masters-light border border-green-200 rounded-xl p-5">
                <h2 className="font-semibold text-masters-green mb-3">Prize breakdown</h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {['🥇 1st (70%)', '🥈 2nd (20%)', '🥉 3rd (10%)'].map((label, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-lg font-bold text-masters-green">£{Math.floor(pool * [0.7, 0.2, 0.1][i])}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Based on {paidCount} paid entries × £20</p>
              </div>
            )}
          </div>
        )}

        {/* Entries tab */}
        {tab === 'entries' && (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{entry.player_name}</p>
                    <span className="text-xs text-gray-400">{new Date(entry.submitted_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePaid(entry.id, entry.is_paid)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${entry.is_paid ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-50' : 'bg-white border-amber-300 text-amber-600 hover:bg-amber-50'}`}>
                      {entry.is_paid ? '✓ Paid' : 'Mark paid'}
                    </button>
                    <button onClick={() => deleteEntry(entry.id, entry.player_name)}
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                  {entry.picks?.map((p, ci) => (
                    <div key={ci} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 w-20 truncate">{['Favs','Could Do','Possible','Bubble','Miracles','No Chance'][ci]}:</span>
                      <span className="text-xs text-gray-700">{p?.name || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {entries.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No entries yet.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
