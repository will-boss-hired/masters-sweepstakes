export default async function handler(req, res) {
  try {
    // Fetch ESPN golf leaderboard — Masters event ID during Masters week
    const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const data = await espnRes.json()

    const events = data.events || []
    // Find The Masters, or fall back to most recent event
    const masters = events.find(e => e.name?.toLowerCase().includes('masters')) || events[0]

    if (!masters) return res.status(200).json({ scoreMap: {}, event: null })

    const competition = masters.competitions?.[0]
    const competitors = competition?.competitors || []

    const scoreMap = {}
    competitors.forEach(c => {
      const name = c.athlete?.displayName?.toLowerCase()
      if (!name) return
      const scoreStr = c.score || 'E'
      const score = parseScore(scoreStr)
      const status = c.status?.type?.name?.toLowerCase() || ''
      const madeCut = !['cut', 'wd', 'dq'].some(s => status.includes(s))
      scoreMap[name] = { score, madeCut, position: c.status?.displayValue || '—', rawScore: scoreStr }
    })

    // Also index by last name for fuzzy matching
    Object.keys(scoreMap).forEach(fullName => {
      const parts = fullName.split(' ')
      const last = parts[parts.length - 1]
      if (!scoreMap[last]) scoreMap[last] = scoreMap[fullName]
    })

    return res.status(200).json({
      scoreMap,
      event: masters.name,
      lastUpdated: new Date().toISOString()
    })
  } catch (err) {
    console.error('Scores fetch error:', err)
    return res.status(200).json({ scoreMap: {}, event: null, error: err.message })
  }
}

function parseScore(s) {
  if (!s || s === 'E') return 0
  if (s === '--' || s === '-') return null
  return parseInt(s.replace('+', ''), 10) || 0
}
