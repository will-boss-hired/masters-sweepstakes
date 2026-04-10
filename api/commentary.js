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

GROUP HISTORY (use sparingly — only drop a reference if it's genuinely relevant to what's happening right now, not as a default):
- Ollie Lewis missed the cut 3 years running. First made it in 2024.
- Gaz Thorpe set the all-time worst score of +30 in 2024.
- Sam Iglesias has 4 podium finishes in 6 years.
- Laing is the defending champion. No back-to-back winner has ever existed.
- Will Boss is the commissioner.
- Prize pot: 1st £602, 2nd £172, 3rd £86.

TONE: Brutal but affectionate. Like a group chat where everyone takes the piss out of each other. Specific callouts by name. Sharp observations. No corporate speak, no clichés.

CRITICAL FOCUS: Commentary must be about what's happening RIGHT NOW in the standings. Who's leading, who's bombing, who's on the move. Name entrants and their current position and score. Reference golfers only to explain why someone is where they are.

Keep it tight — 3 punchy sentences. One about the leader. One about the bottom. One mid-table observation. No recycling the same backstory jokes every update — just call it as it is.
`

  function fmtS(n) {
    if (n === null || n === undefined) return 'pending'
    if (n === 0) return 'E'
    return n > 0 ? `+${n}` : String(n)
  }

  // Use pre-ranked standings passed from the app (already correctly scored)
  const sorted = (rankings || []).slice().sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return (a.entrant_name || '').localeCompare(b.entrant_name || '')
  })

  const standingsText = sorted.slice(0, 15).map(e => {
    const picks = (e.picks || []).map(p => {
      const s = fmtS(p.score)
      return `${p.name} (${s})`
    }).join(', ')
    return `#${e.rank} ${e.entrant_name}: team ${fmtS(e.teamScore)} all-6 ${fmtS(e.allSixScore)} | ${picks}`
  }).join('\n')

    const bottomText = sorted.slice(-5).reverse().map(e =>
    `#${e.rank} ${e.entrant_name}: team ${fmtS(e.teamScore)}`
  ).join('\n')

  const golfersText = topGolfers.slice(0, 10).map(g =>
    `${g.position} ${g.name}: ${g.score} (thru ${g.thru || 'F'}) R1:${g.linescores?.[0]?.display || '-'} R2:${g.linescores?.[1]?.display || '-'}`
  ).join('\n')

  const prompt = `${GROUP_CONTEXT}

Current round: ${round || 'In Progress'}
Cut line: approximately ${cutLine || '+4'}

SWEEPSTAKE TOP 15:
${standingsText}

SWEEPSTAKE BOTTOM 5:
${bottomText}

MASTERS LEADERBOARD TOP 10:
${golfersText}

Write 3-5 sentences of brutal live commentary about what's happening right now in the sweepstake. Be specific — name names, mention actual scores, call people out. Make it funny. Use plain text only — no markdown, no asterisks, no bold formatting. Use dashes or commas to separate clauses instead.`

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
