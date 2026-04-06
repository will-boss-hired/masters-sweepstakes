import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Check not locked
    const { data: s } = await supabase.from('settings').select('value').eq('key', 'locked').single()
    if (s?.value === 'true') return res.status(403).json({ error: 'Entries are locked.' })

    const { player_name, picks } = req.body
    if (!player_name || !picks || picks.length !== 6) return res.status(400).json({ error: 'Invalid entry.' })

    const { data, error } = await supabase.from('entries').insert({ player_name, picks }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, player_name, picks } = req.body
    const { data: s } = await supabase.from('settings').select('value').eq('key', 'locked').single()
    if (s?.value === 'true') return res.status(403).json({ error: 'Entries are locked.' })
    const { error } = await supabase.from('entries').update({ player_name, picks, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
