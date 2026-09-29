import { factKey } from './facts.js'
import { MASTERY, masteryOf } from './game.js'
import { nextTables } from './levels.js'
import { CHART_SIZE, poolFor, unlockedTables } from './profiles.js'

export const MASTERY_COPY = {
  new: { label: 'Not met yet', short: 'New' },
  seen: { label: 'Met once', short: 'Met' },
  practicing: { label: 'Practising', short: 'Practising' },
  recalled: { label: 'Knows it', short: 'Knows it' },
  fluent: { label: 'Fluent — fast, two days running', short: 'Fluent' },
}

export function masteryCounts(profile) {
  const counts = Object.fromEntries(MASTERY.map((m) => [m, 0]))
  const pool = poolFor(profile)
  for (const key of pool) counts[masteryOf(profile.facts[key])] += 1
  return { counts, total: pool.length }
}

// The times-table grid as a map of what's learned. A cell's product is only
// written in once the fact has been recalled, so the chart fills itself in —
// it's a record of the child's own work rather than a lookup table. Locked
// tables carry a padlock, and the next table to open is picked out.
export function StarChart({ profile, onPickTable, compact = false }) {
  const size = CHART_SIZE
  const inPlay = new Set(poolFor(profile))
  const open = new Set(unlockedTables(profile))
  const next = new Set(nextTables(profile.level) || [])
  const range = Array.from({ length: size }, (_, i) => i + 1)

  const header = (t, scope) => {
    const cls = open.has(t) ? '' : next.has(t) ? 'next' : 'locked'
    if (!open.has(t)) {
      return (
        <th key={t} scope={scope} className={cls} aria-label={`${t} times table: ${next.has(t) ? 'opens next' : 'locked'}`}>
          <span className="lock" aria-hidden="true">🔒</span>{t}
        </th>
      )
    }
    return (
      <th key={t} scope={scope}>
        {onPickTable ? (
          <button type="button" onClick={() => onPickTable(t)} aria-label={`Practise the ${t} times table`}>{t}</button>
        ) : t}
      </th>
    )
  }

  return (
    <div className={`chart-scroll ${compact ? 'compact' : ''}`}>
      <table className="star-chart" style={{ '--n': size }}>
        <caption className="sr-only">Times table chart. Each cell shows how well that fact is known.</caption>
        <thead>
          <tr>
            <th scope="col" className="corner" aria-label="times">×</th>
            {range.map((c) => header(c, 'col'))}
          </tr>
        </thead>
        <tbody>
          {range.map((r) => (
            <tr key={r}>
              {header(r, 'row')}
              {range.map((c) => {
                const key = factKey(r, c)
                if (!inPlay.has(key)) {
                  const soon = next.has(r) || next.has(c)
                  return <td key={c} className={`cell off ${soon ? 'soon' : ''}`} aria-label={`${r} × ${c}: locked`} />
                }
                const mastery = masteryOf(profile.facts[key])
                const show = mastery === 'recalled' || mastery === 'fluent'
                return (
                  <td key={c} className={`cell m-${mastery}`} aria-label={`${r} × ${c}: ${MASTERY_COPY[mastery].label}`}>
                    {show ? r * c : mastery === 'new' ? '' : '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ChartLegend() {
  return (
    <ul className="chart-legend">
      {MASTERY.map((m) => (
        <li key={m}><i className={`cell m-${m}`} aria-hidden="true" />{MASTERY_COPY[m].short}</li>
      ))}
    </ul>
  )
}
