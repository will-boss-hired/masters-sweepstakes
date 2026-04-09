export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=15')

  const { player, event } = req.query
  if (!player || !event) {
    return res.status(400).json({ error: 'Missing player or event param' })
  }

  try {
    const url = `https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard/playersummary?event=${event}&player=${player}`
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!resp.ok) throw new Error(`ESPN returned ${resp.status}`)

    const json = await resp.json()

    // Extract rounds with hole-by-hole linescores
    const rounds = (json.rounds || []).map(round => {
      const holes = (round.linescores || []).map(ls => ({
        number: ls.hole?.number ?? null,
        par: ls.hole?.par ?? null,
        score: ls.value ?? null,
        toPar: ls.score?.value ?? null,
        displayScore: ls.displayValue ?? '—',
        type: ls.type?.displayName ?? null, // BIRDIE, EAGLE, PAR, BOGEY, etc.
      }))
      return {
        period: round.period,
        displayScore: round.displayScore ?? '—',
        toPar: round.linescores?.reduce((s, ls) => {
          const v = ls.score?.value
          return v != null ? s + v : s
        }, 0) ?? null,
        holes,
      }
    }).filter(r => r.holes.length > 0)

    return res.json({
      playerId: player,
      name: json.athlete?.displayName ?? '',
      rounds,
    })
  } catch (err) {
    console.error('[scorecard]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
