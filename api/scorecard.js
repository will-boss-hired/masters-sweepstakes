export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=15')

  const { player, event } = req.query

  if (!player || !event) {
    return res.status(400).json({ error: 'Missing player or event param' })
  }

  try {
    const url = `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${event}/competitions/${event}/competitors/${player}/linescores?lang=en&region=us`

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (!resp.ok) {
      console.error(`[scorecard] ESPN returned ${resp.status} for event=${event}&player=${player}`)
      return res.status(resp.status).json({ error: `ESPN API returned ${resp.status}` })
    }

    const json = await resp.json()

    // Each item in json.items is a round
    const rounds = (json.items || [])
      .filter(round => round.linescores && round.linescores.length > 0)
      .map(round => {
        const holes = round.linescores.map(ls => ({
          number: ls.period ?? null,
          par: ls.par ?? null,
          score: ls.value ?? null,
          displayScore: ls.displayValue ?? '—',
          type: ls.scoreType?.name ?? null,         // PAR, BIRDIE, EAGLE, BOGEY etc.
          typeDisplay: ls.scoreType?.displayName ?? null,
        }))

        // Calculate round to-par from hole scoretypes
        const toPar = holes.reduce((sum, h) => {
          if (h.score != null && h.par != null) return sum + (h.score - h.par)
          return sum
        }, 0)

        // Pull out round-level stats if available
        const stats = {}
        const categories = round.statistics?.categories ?? []
        for (const cat of categories) {
          for (const stat of cat.stats ?? []) {
            stats[stat.name] = stat.displayValue
          }
        }

        return {
          period: round.period,
          teeTime: round.teeTime ?? null,
          displayScore: round.displayValue ?? '—',
          toPar,
          holes,
          stats,
        }
      })

    return res.json({
      playerId: player,
      rounds,
    })
  } catch (err) {
    console.error('[scorecard]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
