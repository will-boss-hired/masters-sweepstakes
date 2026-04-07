import { useMemo } from 'react'
import { COLUMNS } from '../lib/golfers'
import './InsightsDashboard.css'

export default function InsightsDashboard({ entries }) {
  const stats = useMemo(() => {
    if (!entries.length) return null

    const golferCounts = {}
    const golfersByPot = {}

    entries.forEach(entry => {
      entry.picks.forEach(pick => {
        golferCounts[pick.name] = (golferCounts[pick.name] || 0) + 1
        if (!golfersByPot[pick.columnName]) golfersByPot[pick.columnName] = {}
        golfersByPot[pick.columnName][pick.name] = (golfersByPot[pick.columnName][pick.name] || 0) + 1
      })
    })

    const sortedGolfers = Object.entries(golferCounts).sort(([, a], [, b]) => b - a)
    const mostPicked = sortedGolfers[0]
    const roguePicks = sortedGolfers.filter(([, c]) => c === 1)
    const top10 = sortedGolfers.slice(0, 10)

    const potStats = Object.entries(golfersByPot).map(([pot, golfers]) => {
      const sorted = Object.entries(golfers).sort(([, a], [, b]) => b - a)
      return { pot, uniqueCount: Object.keys(golfers).length, topPick: sorted[0], golfers: sorted }
    })

    const teamSigs = entries.map(e => e.picks.map(p => p.name).sort().join('|'))
    const hasDupes = new Set(teamSigs).size < teamSigs.length

    return {
      mostPicked,
      maxCount: mostPicked[1],
      roguePicks,
      top10,
      potStats,
      hasDupes,
      totalUnique: Object.keys(golferCounts).length,
      total: entries.length,
      golferCounts,
    }
  }, [entries])

  if (!stats) return null

  const { mostPicked, roguePicks, potStats, hasDupes, totalUnique, total, top10, maxCount, golferCounts } = stats

  const wildestPot = [...potStats].sort((a, b) => b.uniqueCount - a.uniqueCount)[0]

  const commentary = [
    `${total} entries are locked and loaded for sweepstake glory.`,
    `🏆 ${mostPicked[0]} is the people's champion — picked by ${mostPicked[1]} out of ${total} entries. The weight of expectation is heavy.`,
    roguePicks.length > 0
      ? `👻 ${roguePicks.length} golfer${roguePicks.length > 1 ? 's were' : ' was'} picked just once — including ${roguePicks.slice(0, 3).map(([n]) => n).join(', ')}. If one of these sneaks into contention, the leaderboard flips upside down.`
      : null,
    hasDupes
      ? `⚠️ Some teams share identical picks — shared glory or shared heartbreak awaits.`
      : `🧠 Every single team is unique — no shared glory, no shared heartbreak. It's every person for themselves.`,
    `🎯 ${totalUnique} different golfers were chosen across all entries.`,
    wildestPot
      ? `🤠 ${wildestPot.pot} is the Wild West — ${wildestPot.uniqueCount} different golfers chosen. Could be the swing pot that decides it all.`
      : null,
  ].filter(Boolean)

  const potOrder = potStats.map(p => p.pot)
  const heatmapGolfers = Object.entries(golferCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([name]) => name)

  function getHeatColor(count, max) {
    if (count === 0) return 'var(--heat-0)'
    const ratio = count / max
    if (ratio > 0.6) return 'var(--heat-4)'
    if (ratio > 0.4) return 'var(--heat-3)'
    if (ratio > 0.2) return 'var(--heat-2)'
    return 'var(--heat-1)'
  }

  let heatMax = 1
  potStats.forEach(p => {
    p.golfers.forEach(([, c]) => { if (c > heatMax) heatMax = c })
  })

  return (
    <div className="insights-dashboard">
      <div className="insights-header">
        <h2 className="insights-title">Sweepstake Insights</h2>
        <p className="insights-sub">Auto-generated from {total} entries</p>
      </div>

      <div className="insights-commentary">
        {commentary.map((line, i) => (
          <p key={i} className="commentary-line">{line}</p>
        ))}
      </div>

      <div className="spotlight-card">
        <div className="spotlight-badge">PEOPLE'S CHAMPION</div>
        <div className="spotlight-name">{mostPicked[0]}</div>
        <div className="spotlight-stat">
          Picked by <strong>{mostPicked[1]}</strong> of {total} entries
          ({Math.round((mostPicked[1] / total) * 100)}%)
        </div>
      </div>

      <div className="insights-section">
        <h3 className="insights-section-title">Most Picked Golfers</h3>
        <div className="bar-chart">
          {top10.map(([name, count], i) => (
            <div key={name} className="bar-row">
              <div className="bar-label">{name}</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(count / maxCount) * 100}%`, animationDelay: `${i * 60}ms` }}
                />
              </div>
              <div className="bar-count">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="insights-section">
        <h3 className="insights-section-title">Pick Distribution by Pot</h3>
        <div className="pot-grid">
          {potStats.map(({ pot, uniqueCount, topPick, golfers }) => {
            const colObj = COLUMNS.find(c => c?.label === pot)
            const color = colObj?.color || '#888'
            return (
              <div key={pot} className="pot-card">
                <div className="pot-card-header">
                  <div className="pot-dot" style={{ background: color }} />
                  <span className="pot-name">{pot}</span>
                  <span className="pot-unique">{uniqueCount} golfers</span>
                </div>
                <div className="pot-top-pick">
                  👑 {topPick[0]} <span className="pot-top-count">({topPick[1]} picks)</span>
                </div>
                <div className="pot-golfer-list">
                  {golfers.slice(0, 5).map(([name, count]) => (
                    <div key={name} className="pot-golfer-row">
                      <span className="pot-golfer-name">{name}</span>
                      <div className="pot-mini-bar-track">
                        <div
                          className="pot-mini-bar"
                          style={{
                            width: `${(count / topPick[1]) * 100}%`,
                            background: color,
                          }}
                        />
                      </div>
                      <span className="pot-golfer-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="insights-section">
        <h3 className="insights-section-title">Pick Heatmap</h3>
        <p className="insights-section-sub">Top 12 most popular golfers across all pots</p>
        <div className="heatmap-wrap">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th className="heatmap-corner"></th>
                {potOrder.map(pot => (
                  <th key={pot} className="heatmap-col-head">{pot}</th>
                ))}
                <th className="heatmap-col-head">Total</th>
              </tr>
            </thead>
            <tbody>
              {heatmapGolfers.map(name => {
                const totalCount = golferCounts[name]
                return (
                  <tr key={name}>
                    <td className="heatmap-row-label">{name}</td>
                    {potOrder.map(pot => {
                      const potData = potStats.find(p => p.pot === pot)
                      const count = potData?.golfers.find(([n]) => n === name)?.[1] || 0
                      return (
                        <td
                          key={pot}
                          className="heatmap-cell"
                          style={{ background: getHeatColor(count, heatMax) }}
                        >
                          {count > 0 ? count : ''}
                        </td>
                      )
                    })}
                    <td className="heatmap-cell heatmap-total">{totalCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          <div className="heatmap-legend-box" style={{ background: 'var(--heat-0)' }} />
          <div className="heatmap-legend-box" style={{ background: 'var(--heat-1)' }} />
          <div className="heatmap-legend-box" style={{ background: 'var(--heat-2)' }} />
          <div className="heatmap-legend-box" style={{ background: 'var(--heat-3)' }} />
          <div className="heatmap-legend-box" style={{ background: 'var(--heat-4)' }} />
          <span>More</span>
        </div>
      </div>

      {roguePicks.length > 0 && (
        <div className="insights-section">
          <h3 className="insights-section-title">👻 Rogue Picks</h3>
          <p className="insights-section-sub">
            {roguePicks.length} golfer{roguePicks.length > 1 ? 's' : ''} picked by just one person. Bold moves.
          </p>
          <div className="rogue-grid">
            {roguePicks.map(([name]) => {
              const picker = entries.find(e => e.picks.some(p => p.name === name))
              const pick = picker?.picks.find(p => p.name === name)
              return (
                <div key={name} className="rogue-card">
                  <div className="rogue-golfer">{name}</div>
                  <div className="rogue-meta">
                    <span className="rogue-odds">{pick?.odds}</span>
                    <span className="rogue-picker">— {picker?.entrant_name}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
