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
    const golfers = (comp?.competitors || []).map(c => {
      const linescores = (c.linescores || []).map(ls => ({
        value: ls.value,
        display: ls.displayValue || '—',
      }))

      // Sum the to-par displayValue of each completed/active round linescore.
      // c.score.displayValue only reflects R1 and doesn't update across rounds.
      // linescore displayValues (e.g. "-1", "+2", "E") are correct per round.
      function parseTopar(str) {
        if (!str || str === '—' || str === 'E' || str === 'Even') return 0
        const n = parseInt(str.replace('+', ''), 10)
        return isNaN(n) ? 0 : n
      }

      const scoringLinescores = linescores.filter(ls => ls.display && ls.display !== '—')
      let overallScore = 'E'
      if (scoringLinescores.length > 0) {
        const total = scoringLinescores.reduce((sum, ls) => sum + parseTopar(ls.display), 0)
        overallScore = total === 0 ? 'E' : total > 0 ? `+${total}` : String(total)
      }

      return {
        id: c.athlete?.id,
        name: c.athlete?.displayName || '',
        flag: c.athlete?.flag?.href || null,
        flagAlt: c.athlete?.flag?.alt || '',
        position: c.status?.position?.displayName || '—',
        score: overallScore,
        teeTime: c.status?.teeTime || null,
        thru: c.status?.thru != null ? String(c.status.thru) : '',
        round: c.status?.period || 1,
        status: c.status?.type?.name || 'STATUS_ACTIVE',
        sortOrder: c.sortOrder || 999,
        linescores,
      }
    })

    golfers.sort((a, b) => {
      const aScheduled = a.status === 'STATUS_SCHEDULED'
      const bScheduled = b.status === 'STATUS_SCHEDULED'
      if (!aScheduled && !bScheduled) return a.sortOrder - b.sortOrder
      if (!aScheduled && bScheduled) return -1
      if (aScheduled && !bScheduled) return 1
      if (a.teeTime && b.teeTime) return new Date(a.teeTime) - new Date(b.teeTime)
      return 0
    })

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
