import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { COLUMNS } from '../lib/golfers'
import './LeaderboardPage.css'

// ── Utilities ──────────────────────────────────────────────────────────────

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseScore(str) {
  if (!str || str === 'E' || str === 'Even') return 0
  if (str === '-' || str === '' || str === '--') return null
  const n = parseInt(str.replace('+', ''), 10)
  return isNaN(n) ? null : n
}

function formatScore(n) {
  if (n === null || n === undefined) return '—'
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : String(n)
}

const MISSED_CUT = new Set([
  'STATUS_MISSED_CUT',
  'STATUS_WITHDRAWN',
  'STATUS_DISQUALIFIED',
  'STATUS_CUT',
])

const PREVIOUS_WINNERS = new Map([
  ['rory mcilroy', 1], ['jon rahm', 1], ['scottie scheffler', 2],
  ['hideki matsuyama', 1], ['dustin johnson', 1], ['patrick reed', 1],
  ['sergio garcia', 1], ['danny willett', 1], ['jordan spieth', 1],
  ['bubba watson', 2], ['adam scott', 1], ['charl schwartzel', 1],
  ['angel cabrera', 1], ['mike weir', 1], ['zach johnson', 1],
  ['vijay singh', 1], ['jose maria olazabal', 1], ['fred couples', 1],
])

function winCount(name) {
  return PREVIOUS_WINNERS.get(normalizeName(name)) || 0
}

function GolferMeta({ name, flag, flagAlt }) {
  const wins = winCount(name)
  return (
    <span className="golfer-meta">
      {flag && (
        <img
          src={flag}
          alt={flagAlt}
          className="golfer-flag"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      {wins > 0 && (
        <span className="golfer-jacket" title="Former Masters champion">
          {'🏆'.repeat(wins)}
        </span>
      )}
    </span>
  )
}

// ── Scoring engine ─────────────────────────────────────────────────────────

function calculateEntry(entry, golferMap) {
  const picks = (entry.picks || []).map(pick => {
    const golfer = golferMap.get(normalizeName(pick.name))
    if (!golfer) {
      return { ...pick, score: null, found: false, madeCut: true, thru: '', position: '-', statusName: null }
    }
    const score = parseScore(golfer.score)
    const madeCut = !MISSED_CUT.has(golfer.status)
    return { ...pick, score, found: true, madeCut, thru: golfer.thru || '', position: golfer.position || '-', statusName: golfer.status }
  })

  const withScores = picks.filter(p => p.found && p.score !== null)
  const madeCutPicks = picks.filter(p => p.found && p.madeCut)
  const missedCount = picks.filter(p => p.found && !p.madeCut).length

  const sorted = [...withScores].sort((a, b) => a.score - b.score)
  const counting = sorted.slice(0, 3)
  const countingNames = new Set(counting.map(p => p.name))

  const teamScore = counting.length >= 3
    ? counting.reduce((sum, p) => sum + p.score, 0)
    : null

  const qualified = madeCutPicks.length >= 3 || missedCount === 0

  return {
    ...entry,
    picks: picks.map(p => ({ ...p, counting: countingNames.has(p.name) })),
    teamScore,
    qualified,
    madeCutCount: madeCutPicks.length,
    sortedPicks: sorted,
  }
}

function rankEntries(calculated) {
  const sorted = [...calculated].sort((a, b) => {
    const aElim = !a.qualified
    const bElim = !b.qualified
    if (aElim && !bElim) return 1
    if (!aElim && bElim) return -1
    if (aElim && bElim) return (b.madeCutCount || 0) - (a.madeCutCount || 0)

    if (a.teamScore === null && b.teamScore === null) return a.entrant_name.localeCompare(b.entrant_name)
    if (a.teamScore === null) return 1
    if (b.teamScore === null) return -1

    if (a.teamScore !== b.teamScore) return a.teamScore - b.teamScore
    if (a.madeCutCount !== b.madeCutCount) return b.madeCutCount - a.madeCutCount

    for (let i = 3; i < 6; i++) {
      const aScore = a.sortedPicks?.[i]?.score ?? 999
      const bScore = b.sortedPicks?.[i]?.score ?? 999
      if (aScore !== bScore) return aScore - bScore
    }

    return a.entrant_name.localeCompare(b.entrant_name)
  })

  let displayRank = 1
  return sorted.map((entry, idx) => {
    if (idx > 0) {
      const prev = sorted[idx - 1]
      const tied =
        entry.teamScore !== null &&
        entry.teamScore === prev.teamScore &&
        entry.qualified === prev.qualified
      if (!tied) displayRank = idx + 1
    }
    return { ...entry, rank: displayRank, position: idx + 1 }
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MovementBadge({ delta }) {
  if (!delta) return <span className="mv mv-flat">—</span>
  if (delta > 0) return <span className="mv mv-up">▲{delta}</span>
  return <span className="mv mv-down">▼{Math.abs(delta)}</span>
}

function ScorePill({ score }) {
  const n = typeof score === 'string' ? parseScore(score) : score
  if (n === null) return <span className="score-pill even">—</span>
  const cls = n < 0 ? 'under' : n > 0 ? 'over' : 'even'
  return <span className={`score-pill ${cls}`}>{formatScore(n)}</span>
}

function ThruCell({ thru, status }) {
  if (MISSED_CUT.has(status)) return <span className="thru-cut">CUT</span>
  if (!thru || thru === '*') return <span className="thru-dim">—</span>
  if (thru === 'F') return <span className="thru-done">F</span>
  return <span className="thru-dim">{thru}</span>
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([])
  const [golfers, setGolfers] = useState([])
  const [eventInfo, setEventInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [sweepstakeOnly, setSweepstakeOnly] = useState(false)
  const [expandedGolferIds, setExpandedGolferIds] = useState(new Set())
  const [scorecardCache, setScorecardCache] = useState({})
  const [loadingScorecards, setLoadingScorecards] = useState(new Set())
  const prevPositionsRef = useRef({})

  useEffect(() => {
    initialLoad()
    const timer = setInterval(backgroundRefresh, 60_000)
    return () => clearInterval(timer)
  }, [])

  async function initialLoad() {
    setLoading(true)
    await Promise.all([fetchEntries(), fetchScores()])
    setLoading(false)
  }

  async function fetchEntries() {
    const { data } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: true })
    setEntries(data || [])
  }

  async function fetchScores() {
    try {
      const res = await fetch('/api/leaderboard')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGolfers(data.golfers || [])
      setEventInfo({ name: data.eventName, round: data.roundInfo, status: data.eventStatus, id: data.eventId })
      setLastUpdated(new Date())
      setError(null)
    } catch {
      setError('Scores temporarily unavailable — retrying shortly')
    }
  }

  async function backgroundRefresh() {
    setRefreshing(true)
    await fetchScores()
    setRefreshing(false)
  }

  const golferMap = useMemo(() => {
    const m = new Map()
    golfers.forEach(g => m.set(normalizeName(g.name), g))
    return m
  }, [golfers])

  const sweepstakeNames = useMemo(() => {
    const s = new Set()
    entries.forEach(e => e.picks?.forEach(p => s.add(normalizeName(p.name))))
    return s
  }, [entries])

  const rankings = useMemo(() => {
    const calculated = entries.map(e => calculateEntry(e, golferMap))
    const ranked = rankEntries(calculated)

    const withMovement = ranked.map(e => {
      const prev = prevPositionsRef.current[e.id]
      const delta = prev !== undefined ? prev - e.position : 0
      return { ...e, delta }
    })

    const newMap = {}
    ranked.forEach(e => { newMap[e.id] = e.position })
    prevPositionsRef.current = newMap

    return withMovement
  }, [entries, golferMap])

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function toggleGolfer(golferId, eventId) {
    setExpandedGolferIds(prev => {
      const next = new Set(prev)
      next.has(golferId) ? next.delete(golferId) : next.add(golferId)
      return next
    })
    if (!scorecardCache[golferId]) {
      setLoadingScorecards(prev => new Set(prev).add(golferId))
      try {
        const res = await fetch(`/api/scorecard?player=${golferId}&event=${eventId}`)
        const data = await res.json()
        setScorecardCache(prev => ({ ...prev, [golferId]: data }))
      } catch {
        setScorecardCache(prev => ({ ...prev, [golferId]: { error: true } }))
      } finally {
        setLoadingScorecards(prev => {
          const next = new Set(prev)
          next.delete(golferId)
          return next
        })
      }
    }
  }

  if (loading) return <div className="loading">Loading leaderboard…</div>

  const hasScores = golfers.length > 0

  return (
    <div className="lb-wrap">

      {/* ── Event banner ─────────────────────────────── */}
      <div className="lb-banner">
        <div className="lb-banner-logo-wrap">
          <img
            src="/masters-logo.png"
            alt="The Masters"
            className="lb-banner-logo"
          />
        </div>
        <div className="lb-banner-center">
          <div className="lb-banner-title">
            {eventInfo?.name || 'Masters Tournament 2026'}
          </div>
          <div className="lb-banner-round">
            {eventInfo?.round || 'Apr 9–12 · Augusta National'}
          </div>
        </div>
        <div className="lb-banner-right">
          {lastUpdated && (
            <span className="lb-refresh-status">
              {refreshing
                ? 'Updating…'
                : `Updated ${lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          )}
        </div>
      </div>

      {error && <div className="lb-error">{error}</div>}

      {/* ── Sweepstake standings ──────────────────────── */}
      <section className="lb-section">
        <h2 className="lb-section-title">Sweepstake standings</h2>
        <p className="lb-section-sub">
          Tap an entry to see all 6 picks · Top 3 scores count toward the team total
        </p>

        <div className="sw-list">
          {rankings.map(entry => {
            const isExpanded = expandedIds.has(entry.id)
            const isElim = !entry.qualified && entry.madeCutCount < 3 && hasScores

            return (
              <div
                key={entry.id}
                className={`sw-card${isExpanded ? ' sw-card--open' : ''}${isElim ? ' sw-card--elim' : ''}`}
              >
                <button className="sw-header" onClick={() => toggleExpand(entry.id)}>
                  <span className="sw-pos">
                    {entry.teamScore !== null && entry.qualified ? `#${entry.rank}` : '—'}
                  </span>
                  <MovementBadge delta={entry.delta} />
                  <span className="sw-name">{entry.entrant_name}</span>
                  {isElim
                    ? <span className="sw-elim">Elim.</span>
                    : entry.teamScore !== null
                      ? <ScorePill score={entry.teamScore} />
                      : <span className="sw-pending">—</span>}
                  <span className="sw-chevron" aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="sw-body">
                    <div className="sw-picks">
                      {entry.picks.map((pick, i) => {
                        const golferData = golferMap.get(normalizeName(pick.name))
                        return (
                          <div
                            key={i}
                            className={`sw-pick${pick.counting ? ' sw-pick--counting' : ''}`}
                          >
                            <div
                              className="sw-pick-accent"
                              style={{ background: COLUMNS[pick.columnIndex]?.color || '#1a472a' }}
                            />
                            <div className="sw-pick-tier">{pick.columnName}</div>
                            <div className={`sw-pick-name${pick.counting ? ' sw-pick-name--bold' : ''}`}>
                              {pick.name}
                              <GolferMeta
                                name={pick.name}
                                flag={golferData?.flag || null}
                                flagAlt={golferData?.flagAlt || ''}
                              />
                            </div>
                            <div className="sw-pick-right">
                              {pick.found ? (
                                <>
                                  <ScorePill score={pick.score} />
                                  <ThruCell thru={pick.thru} status={pick.statusName} />
                                </>
                              ) : (
                                <span className="sw-unmatched">not started</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="sw-footer">
                      <span>{entry.madeCutCount} of 6 through cut</span>
                      <span>
                        Team score:{' '}
                        <strong>{entry.teamScore !== null ? formatScore(entry.teamScore) : 'pending'}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Masters field leaderboard ────────────────── */}
      {hasScores && (
        <section className="lb-section">
          <div className="lb-section-header">
            <div>
              <h2 className="lb-section-title">Masters leaderboard</h2>
              <p className="lb-section-sub">
                <span className="legend-dot" /> Picked in sweepstake · Tap a row to see hole-by-hole scorecard
              </p>
            </div>
            <button
              className={`lb-toggle${sweepstakeOnly ? ' lb-toggle--on' : ''}`}
              onClick={() => setSweepstakeOnly(prev => !prev)}
            >
              {sweepstakeOnly ? 'Sweepstake picks only' : 'Show all golfers'}
            </button>
          </div>
          <div className="masters-wrap">
            <table className="masters-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Thru</th>
                  <th>R1</th>
                  <th>R2</th>
                  <th>R3</th>
                  <th>R4</th>
                </tr>
              </thead>
              <tbody>
                {golfers
                  .filter(g => !sweepstakeOnly || sweepstakeNames.has(normalizeName(g.name)))
                  .map((g, i) => {
                    const inSweepstake = sweepstakeNames.has(normalizeName(g.name))
                    const missed = MISSED_CUT.has(g.status)
                    const scoreNum = parseScore(g.score)
                    const isGolferExpanded = expandedGolferIds.has(g.id)
                    const isLoadingCard = loadingScorecards.has(g.id)
                    const scorecard = scorecardCache[g.id]
                    const eventId = eventInfo?.id || '401811941'

                    return (
                      <>
                        <tr
                          key={g.id || i}
                          className={`masters-row--clickable${inSweepstake ? ' masters-row--highlight' : ''}${missed ? ' masters-row--cut' : ''}${isGolferExpanded ? ' masters-row--open' : ''}`}
                          onClick={() => toggleGolfer(g.id, eventId)}
                        >
                          <td className="masters-pos">{missed ? 'CUT' : g.position}</td>
                          <td className="masters-player">
                            {inSweepstake && <span className="masters-dot" />}
                            {g.name}
                            <GolferMeta name={g.name} flag={g.flag} flagAlt={g.flagAlt} />
                            <span className="masters-chevron">{isGolferExpanded ? '▲' : '▼'}</span>
                          </td>
                          <td><ScorePill score={scoreNum} /></td>
                          <td className="masters-thru">
                            <ThruCell thru={g.thru} status={g.status} />
                          </td>
                          {[0, 1, 2, 3].map(r => (
                            <td key={r} className="masters-round">
                              {g.linescores?.[r]?.display || '—'}
                            </td>
                          ))}
                        </tr>
                        {isGolferExpanded && (
                          <tr key={`${g.id}-card`} className="masters-scorecard-row">
                            <td colSpan={8} className="masters-scorecard-cell">
                              {isLoadingCard && (
                                <div className="sc-loading">Loading scorecard…</div>
                              )}
                              {!isLoadingCard && scorecard?.error && (
                                <div className="sc-loading">Scorecard unavailable</div>
                              )}
                              {!isLoadingCard && scorecard && !scorecard.error && scorecard.rounds?.length === 0 && (
                                <div className="sc-loading">No scores yet — round hasn't started</div>
                              )}
                              {!isLoadingCard && scorecard && !scorecard.error && scorecard.rounds?.length > 0 && (
                                <div className="sc-wrap">
                                  {scorecard.rounds.map(round => (
                                    <div key={round.period} className="sc-round">
                                      <div className="sc-round-label">Round {round.period}</div>
                                      <div className="sc-grid">
                                        <div className="sc-row sc-row--header">
                                          <div className="sc-corner">Hole</div>
                                          {round.holes.map(h => (
                                            <div key={h.number} className={`sc-cell sc-cell--head${h.number === 9 ? ' sc-cell--nine' : ''}`}>
                                              {h.number}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="sc-row sc-row--par">
                                          <div className="sc-corner">Par</div>
                                          {round.holes.map(h => (
                                            <div key={h.number} className={`sc-cell sc-cell--par${h.number === 9 ? ' sc-cell--nine' : ''}`}>
                                              {h.par ?? '—'}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="sc-row sc-row--scores">
                                          <div className="sc-corner">{g.name.split(' ').pop()}</div>
                                          {round.holes.map(h => {
                                            const t = h.toPar
                                            const cls = t == null ? ''
                                              : t <= -2 ? 'sc-eagle'
                                              : t === -1 ? 'sc-birdie'
                                              : t === 0 ? 'sc-par'
                                              : t === 1 ? 'sc-bogey'
                                              : 'sc-double'
                                            return (
                                              <div key={h.number} className={`sc-cell sc-cell--score ${cls}${h.number === 9 ? ' sc-cell--nine' : ''}`}>
                                                {h.score ?? '—'}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Pre-tournament placeholder ────────────────── */}
      {!hasScores && !loading && (
        <div className="lb-pre-tourney">
          <div className="lb-pre-icon">⛳</div>
          <p>Scores will appear here once the tournament begins.</p>
        </div>
      )}

    </div>
  )
}
