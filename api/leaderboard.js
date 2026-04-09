export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')

  try {
    const resp = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!resp.ok) throw new Error(`ESPN returned ${resp.status}`)

    const json = await resp.json()
    const event = json.events?.[0]

    if (!event) {
      return res.json({ golfers: [], eventName: null, roundInfo: null, eventStatus: null })
    }

    const comp = event.competitions?.[0]

    const golfers = (comp?.competitors || []).map(c => ({
      id: c.athlete?.id,
      name: c.athlete?.displayName || '',
      flag: c.athlete?.flag?.href || null,
      flagAlt: c.athlete?.flag?.alt || '',
      position: c.status?.position?.displayName || '—',
      score: c.score?.displayValue || 'E',
      teeTime: c.status?.teeTime || null,
      thru: c.status?.thru || '',
      round: c.status?.period || 1,
      status: c.status?.type?.name || 'STATUS_ACTIVE',
      linescores: (c.linescores || []).map(ls => ({
        value: ls.value,
        display: ls.displayValue || '—',
      })),
    }))

    return res.json({
      golfers,
      eventName: event.name || 'Masters Tournament',
      eventId: event.id || null,
      roundInfo: comp?.status?.type?.detail || '',
      eventStatus: comp?.status?.type?.name || '',
      lastUpdated: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[leaderboard]', err.message)
    return res.status(500).json({ error: err.message, golfers: [] })
  }
}
