export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rankings, topGolfers, round, cutLine } = req.body

  if (!rankings || !topGolfers) {
    return res.status(400).json({ error: 'Missing data' })
  }

  const GROUP_CONTEXT = `
You are generating live commentary for a Masters golf sweepstake WhatsApp group. Be brutal, funny and specific. Never hold back.

GROUP HISTORY & RUNNING JOKES:
- Ollie Lewis missed the cut for his first 3 years in a row. He finally made it through in 2024. The group celebrated it like a major championship win.
- Gaz Thorpe set the all-time worst score record in 2024 with +30. He has since redeemed himself somewhat but the +30 will follow him forever.
- Mason is consistently roasted for his picks. Nobody in the group believes in his selections.
- Cameron M'Crystal is always convinced he's been cheated or the competition is rigged against him. He's finished 2nd or 3rd three times.
- Sam Iglesias (Sam 🥚) is the perennial contender — 4 podium finishes in 6 years. If he's doing badly, that's especially funny.
- Dave Cureton won 2024 on the absolute last putt of the tournament in a full tiebreaker. The most dramatic finish ever.
- Laing won 2025 (the defending champion). There has never been a back-to-back winner in the history of the competition.
- Will Boss is the commissioner who runs it all. He lost his laptop on a plane during the 2022 tournament. He is always a fair target.
- The competition has 43 entries in 2026 — the biggest field ever.
- Prize pot at 43 entries: 1st £602, 2nd £172, 3rd £86.
- No back-to-back winner has ever existed in this competition's history.

TONE: Brutal but affectionate. Like a group chat where everyone takes the piss out of each other. Specific callouts by name. Sharp observations. No corporate speak, no clichés.

CRITICAL FOCUS: The commentary MUST primarily be about the SWEEPSTAKE STANDINGS — who is leading the sweepstake, who is near the bottom, who has moved up or down. Name specific entrants and their positions. e.g. "Tom Arnold is sitting pretty at #1 on -15 thanks to Rory..." or "Sam Iglesias is absolutely rooted at the bottom on +6 and Jon Rahm is the reason why."

Only reference golfers in the context of how they are affecting specific entrants' positions. Keep it to 3-5 sentences. Always mention the leader, always mention someone near the bottom, and pick one interesting mid-table story.
`

  const standingsText = rankings.slice(0, 15).map(e => {
    const score = e.teamScore !== null ? (e.teamScore === 0 ? 'E' : e.teamScore > 0 ? `+${e.teamScore}` : String(e.teamScore)) : 'pending'
    const picks = (e.picks || []).filter(p => p.found).map(p => {
      const s = p.score === null ? '?' : p.score === 0 ? 'E' : p.score > 0 ? `+${p.score}` : String(p.score)
      return `${p.name} (${s})`
    }).join(', ')
    return `#${e.rank} ${e.entrant_name}: team score ${score} | picks: ${picks}`
  }).join('\n')

  const golfersText = topGolfers.slice(0, 10).map(g =>
    `${g.position} ${g.name}: ${g.score} (thru ${g.thru || 'F'}) R1:${g.linescores?.[0]?.display || '-'} R2:${g.linescores?.[1]?.display || '-'}`
  ).join('\n')

  const prompt = `${GROUP_CONTEXT}

Current round: ${round || 'In Progress'}
Cut line: approximately ${cutLine || '+4'}

SWEEPSTAKE TOP 15:
${standingsText}

MASTERS LEADERBOARD TOP 10:
${golfersText}

Write 3-4 sentences of brutal live commentary about what's happening right now in the sweepstake. Be specific — name names, mention actual scores, call people out. Make it funny.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[commentary] Claude API error:', err)
      return res.status(500).json({ error: 'Claude API failed' })
    }

    const data = await response.json()
    const commentary = data.content?.[0]?.text || ''
    return res.json({ commentary, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[commentary]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
