import { useEffect, useState } from 'react'
import { expectedAnswer } from './game.js'

// Per-mode question bodies. Each takes the item, the current result (null
// until answered) and onAnswer(value). Picking modes answer on tap; typing
// modes use the number pad and answer on ✓ or Enter.

export const MODE_COPY = {
  groups: { label: 'See it', title: 'How many dots?', icon: '⠿' },
  skip: { label: 'Skip count', title: 'Which stone is missing?', icon: '🪨' },
  choose: { label: 'Pick it', title: 'Pick the answer', icon: '👆' },
  missing: { label: 'Missing number', title: 'What goes in the box?', icon: '🔍' },
  type: { label: 'Quick recall', title: 'Type the answer', icon: '⚡' },
}

function Mark({ ok }) {
  return <i className="option-mark" aria-hidden="true">{ok ? '✓' : '✗'}</i>
}

function ChoiceGrid({ choices, answer, result, onAnswer }) {
  return (
    <div className={`choice-grid n${choices.length}`} role="group" aria-label="Answers">
      {choices.map((n) => {
        const isAnswer = n === answer
        const isPicked = result && Number(result.value) === n
        let state = ''
        if (result) state = isAnswer ? 'is-correct' : isPicked ? 'is-wrong' : 'is-muted'
        return (
          <button key={n} type="button" className={`choice ${state}`} disabled={!!result} onClick={() => onAnswer(n)}>
            {n}
            {result && (isAnswer || isPicked) && <Mark ok={isAnswer} />}
          </button>
        )
      })}
    </div>
  )
}

function Box({ value, result, answer }) {
  let state = ''
  // After a miss the box reveals the right answer (the feedback says what was typed).
  if (result) state = result.correct ? 'is-correct' : 'is-revealed'
  const shown = result && !result.correct ? answer : value
  return (
    <span className={`answer-box ${state} ${shown === '' ? 'empty' : ''}`} aria-live="polite">
      {shown === '' ? '?' : shown}
    </span>
  )
}

export function Equation({ item, value = '', result, boxed = true }) {
  const { a, b, mode } = item
  const answer = expectedAnswer(item)
  if (mode === 'missing') {
    return (
      <div className="equation" aria-label={`${a} times what equals ${a * b}`}>
        <span>{a}</span><span className="op">×</span>
        <Box value={value} result={result} answer={answer} />
        <span className="op">=</span><span>{a * b}</span>
      </div>
    )
  }
  return (
    <div className="equation" aria-label={`${a} times ${b}`}>
      <span>{a}</span><span className="op">×</span><span>{b}</span><span className="op">=</span>
      {boxed ? <Box value={value} result={result} answer={answer} /> : <span className="answer-box empty">?</span>}
    </div>
  )
}

// Dots are grouped in fives both ways, like a ten-frame, so 6 × 8 reads as
// blocks you can see at a glance (a five-block, then one more) rather than a
// wall to count one by one. Once answered, each row shows its running total,
// which is skip counting: the bridge from the picture to the fact.
function Dots({ a, b, result }) {
  // b dots + gaps of ~⅓ dot + a wider gap per five, beside a totals column, in ~250px.
  const size = Math.max(10, Math.min(32, Math.floor(750 / (4 * b + 2 * Math.floor((b - 1) / 5) + 3))))
  const gap = Math.max(3, Math.round(size / 3))
  const groupGap = gap + Math.round(size * 0.6)
  return (
    <div className="dots-wrap">
      <div className="dots" role="img" aria-label={`${a} rows of ${b} dots`}>
        {Array.from({ length: a }, (_, row) => (
          <div
            key={row}
            className={`dot-row ${row % 2 ? 'alt' : ''}`}
            style={{ marginTop: row === 0 ? 0 : row % 5 === 0 ? groupGap : gap }}
          >
            {Array.from({ length: b }, (_, col) => (
              <i
                key={col}
                className="dot"
                style={{ width: size, height: size, marginLeft: col === 0 ? 0 : col % 5 === 0 ? groupGap : gap }}
              />
            ))}
            <span className={`row-total ${result ? 'shown' : ''}`} style={{ fontSize: Math.max(11, Math.min(16, size * 0.7)) }}>
              {(row + 1) * b}
            </span>
          </div>
        ))}
      </div>
      <p className="dots-caption"><b>{a}</b> {a === 1 ? 'row' : 'rows'} of <b>{b}</b></p>
    </div>
  )
}

function Stones({ a, b, result }) {
  const start = Math.max(1, b - 3)
  const terms = Array.from({ length: 5 }, (_, i) => start + i)
  return (
    <div className="stones-wrap">
      <p className="stones-caption">Count by <b>{a}s</b></p>
      <ol className="stones">
        {start > 1 && <li className="stone ellipsis" aria-hidden="true">…</li>}
        {terms.map((k) => {
          const target = k === b
          let cls = 'stone'
          if (target) cls += result ? (result.correct ? ' target is-correct' : ' target is-wrong') : ' target'
          return (
            <li key={k} className={cls}>
              <span>{target && !result ? '?' : a * k}</span>
              <small>{k}</small>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function NumberPad({ value, setValue, onSubmit, locked }) {
  const press = (key) => {
    if (locked) return
    if (key === 'del') setValue((v) => v.slice(0, -1))
    else if (key === 'ok') {
      if (value !== '') onSubmit()
    } else setValue((v) => (v.length >= 3 ? v : (v + key).replace(/^0+(?=\d)/, '')))
  }

  useEffect(() => {
    if (locked) return undefined
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (/^\d$/.test(event.key)) press(event.key)
      else if (event.key === 'Backspace') press('del')
      else if (event.key === 'Enter') {
        event.preventDefault()
        press('ok')
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']
  return (
    <div className="pad" role="group" aria-label="Number pad">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className={`pad-key ${key === 'ok' ? 'ok' : ''} ${key === 'del' ? 'del' : ''}`}
          disabled={locked || (key === 'ok' && value === '')}
          onClick={() => press(key)}
          aria-label={key === 'del' ? 'Delete' : key === 'ok' ? 'Check answer' : key}
        >
          {key === 'del' ? '⌫' : key === 'ok' ? '✓' : key}
        </button>
      ))}
    </div>
  )
}

export function Question({ item, choices, result, onAnswer }) {
  const [value, setValue] = useState('')
  const answer = expectedAnswer(item)

  if (item.mode === 'missing' || item.mode === 'type') {
    return (
      <div className="question-body typed">
        <Equation item={item} value={value} result={result} />
        <NumberPad value={value} setValue={setValue} locked={!!result} onSubmit={() => onAnswer(Number(value))} />
      </div>
    )
  }

  return (
    <div className="question-body">
      {item.mode === 'groups' && <Dots a={item.a} b={item.b} result={result} />}
      {item.mode === 'skip' && <Stones a={item.a} b={item.b} result={result} />}
      {item.mode === 'choose' && <Equation item={item} boxed={false} />}
      <ChoiceGrid choices={choices} answer={answer} result={result} onAnswer={onAnswer} />
    </div>
  )
}
