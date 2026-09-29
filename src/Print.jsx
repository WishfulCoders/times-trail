import { useMemo, useState } from 'react'
import { TABLES } from './facts.js'
import { trickiest } from './game.js'
import { MAX_PAGES, SHEET_SIZES, TIME_LIMITS, columnsFor, madMinuteSet, tablesTitle } from './print.js'
import { poolFor, unlockedTables } from './profiles.js'

const CUSTOM = 'custom'

function newSeed() {
  return Math.floor(Math.random() * 1e9)
}

// The paper half of the app. The preview is the same markup the printer
// gets; @media print only strips the app chrome and these controls.
export function PrintSheets({ store, onBack }) {
  const active = store.profiles.find((p) => p.id === store.activeId) || store.profiles[0] || null
  const [forId, setForId] = useState(active ? active.id : CUSTOM)
  const player = store.profiles.find((p) => p.id === forId) || null
  const [tables, setTables] = useState(() => (active ? unlockedTables(active) : [2, 5, 10]))
  const [count, setCount] = useState(30)
  const [minutes, setMinutes] = useState(3)
  const [pages, setPages] = useState(1)
  const [answerKey, setAnswerKey] = useState(true)
  const [useTricky, setUseTricky] = useState(true)
  const [showName, setShowName] = useState(true)
  const [seed, setSeed] = useState(newSeed)

  const tricky = useMemo(() => (player ? trickiest(player.facts, poolFor(player), 8) : []), [player])
  const focus = player && useTricky ? tricky.filter((key) => key.split('x').some((n) => tables.includes(Number(n)))) : []
  const sheets = useMemo(
    () => madMinuteSet({ tables, count, focus, pages, seed }),
    [tables.join(), count, focus.join(), pages, seed],
  )

  function choosePlayer(id) {
    setForId(id)
    const chosen = store.profiles.find((p) => p.id === id)
    if (chosen) setTables(unlockedTables(chosen))
  }

  const toggleTable = (t) =>
    setTables((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]))

  return (
    <main className="page print-page" id="main">
      <div className="page-head print-controls">
        <button type="button" className="back-button" onClick={onBack}>← Back</button>
        <h1 className="page-title">Mad minute sheets</h1>
        <p>
          A page of quick problems against the clock. Set a timer, see how many get done, and write the score at the
          top. Try the same tables again in a few days and compare.
        </p>
      </div>

      <section className="card print-controls print-options" aria-label="Sheet options">
        <label className="field">
          <span>For</span>
          <select value={forId} onChange={(e) => (e.target.value === CUSTOM ? setForId(CUSTOM) : choosePlayer(e.target.value))}>
            {store.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} (level {p.level})</option>)}
            <option value={CUSTOM}>Anyone: pick tables</option>
          </select>
        </label>

        <fieldset className="field wide">
          <legend>Tables</legend>
          <div className="table-toggles">
            {TABLES.map((t) => (
              <label key={t} className={tables.includes(t) ? 'on' : ''}>
                <input type="checkbox" checked={tables.includes(t)} onChange={() => toggleTable(t)} />
                ×{t}
              </label>
            ))}
          </div>
          {player && <small className="hint">Starts on {player.name}'s unlocked tables.</small>}
        </fieldset>

        <label className="field">
          <span>Problems per sheet</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {SHEET_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Time limit</span>
          <select value={minutes ?? 'none'} onChange={(e) => setMinutes(e.target.value === 'none' ? null : Number(e.target.value))}>
            {TIME_LIMITS.map((m) => (
              <option key={m ?? 'none'} value={m ?? 'none'}>{m == null ? 'None — just time it' : `${m} minute${m === 1 ? '' : 's'}`}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Different sheets</span>
          <select value={pages} onChange={(e) => setPages(Number(e.target.value))}>
            {Array.from({ length: MAX_PAGES }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <div className="field wide print-switches">
          <label className="switch">
            <input type="checkbox" checked={answerKey} onChange={(e) => setAnswerKey(e.target.checked)} />
            <span><b>Answer key</b><small>Printed on its own page after each sheet.</small></span>
          </label>
          {player && (
            <>
              <label className="switch">
                <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                <span><b>Put {player.name}'s name on it</b></span>
              </label>
              <label className="switch">
                <input type="checkbox" checked={useTricky} onChange={(e) => setUseTricky(e.target.checked)} disabled={!tricky.length} />
                <span>
                  <b>Extra practice on tricky facts</b>
                  <small>
                    {tricky.length
                      ? `A few extra goes at facts ${player.name} has been missing.`
                      : `${player.name} doesn't have any tricky facts yet.`}
                  </small>
                </span>
              </label>
            </>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="quiet-button" onClick={() => setSeed(newSeed())} disabled={!tables.length}>
            ↻ New problems
          </button>
          <button type="button" className="primary-button" onClick={() => window.print()} disabled={!tables.length}>
            Print {pages === 1 ? 'sheet' : `${pages} sheets`}
          </button>
        </div>
      </section>

      {tables.length === 0 ? (
        <p className="print-controls hint">Pick at least one table.</p>
      ) : (
        <div className="sheets">
          {sheets.map((problems, i) => (
            <Sheet
              key={i}
              number={pages > 1 ? i + 1 : null}
              problems={problems}
              tables={tables}
              minutes={minutes}
              name={player && showName ? player.name : ''}
              answerKey={answerKey}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function Problem({ a, b, answer }) {
  return (
    <div className="mm-problem">
      <span className="mm-top">{a}</span>
      <span className="mm-bottom"><i>×</i>{b}</span>
      <span className="mm-answer">{answer ? a * b : ''}</span>
    </div>
  )
}

function Sheet({ number, problems, tables, minutes, name, answerKey }) {
  const cols = columnsFor(problems.length)
  const grid = (withAnswers) => (
    <div className={`mm-grid n${problems.length}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {problems.map((p, i) => <Problem key={i} a={p.a} b={p.b} answer={withAnswers} />)}
    </div>
  )

  return (
    <>
      <article className="sheet" aria-label={`Mad minute sheet${number ? ` ${number}` : ''}`}>
        <header className="sheet-head">
          <div className="sheet-title">
            <strong>Mad minute{number ? ` · ${number}` : ''}</strong>
            <span>{tablesTitle(tables)}</span>
          </div>
          <span className="sheet-brand">Times Trail</span>
        </header>
        <div className="sheet-fields">
          <span>Name <b className="fill">{name}</b></span>
          <span>Date <b className="fill" /></span>
          <span>{minutes ? `⏱ ${minutes} min` : 'Time'} <b className="fill short" /></span>
          <span>Score <b className="fill short" /> / {problems.length}</span>
        </div>
        {grid(false)}
      </article>
      {answerKey && (
        <article className="sheet sheet-key" aria-label={`Answer key${number ? ` for sheet ${number}` : ''}`}>
          <header className="sheet-head">
            <div className="sheet-title">
              <strong>Answer key{number ? ` · ${number}` : ''}</strong>
              <span>{tablesTitle(tables)}</span>
            </div>
            <span className="sheet-brand">Times Trail</span>
          </header>
          {grid(true)}
        </article>
      )}
    </>
  )
}
