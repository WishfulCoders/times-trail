import { useEffect, useMemo, useRef, useState } from 'react'
import { choicesFor, tipFor } from './facts.js'
import { allowedMode, buildRound, easierMode, expectedAnswer, isSpeedy, makeItem } from './game.js'
import { roundSettings } from './levels.js'
import { MODE_COPY, Question } from './modes.jsx'
import { canSpeak, speak, spokenQuestion, stopSpeaking } from './speech.js'

const CORRECTION_GAP = 3

// One trail. Owns the queue; every answer is reported up through onAnswer so
// progress is saved as it happens, not only when the trail is finished.
export function Game({ profile, pool, title, onAnswer, onFinish, onQuit }) {
  // Fixed for the trail: settings changed mid-trail apply from the next one.
  const [settings] = useState(() => roundSettings(profile))
  const [queue, setQueue] = useState(() =>
    buildRound({ pool, progress: profile.facts, length: profile.trailLength, settings }),
  )
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [tally, setTally] = useState({ firstTries: 0, right: 0, stars: 0, speedy: 0, streak: 0, bestStreak: 0 })
  const shownAt = useRef(performance.now())
  const advanceTimer = useRef(null)
  const nextButton = useRef(null)
  // The auto-advance timer must call the latest next(), not the one from the
  // render that scheduled it, or the final tally misses the last answer.
  const nextRef = useRef(null)

  const item = queue[index]
  const choices = useMemo(() => (item ? choicesFor(item.a, item.b, settings.choices) : []), [item?.id])

  useEffect(() => {
    shownAt.current = performance.now()
    if (item && profile.readAloud && canSpeak()) speak(spokenQuestion(item))
    return () => clearTimeout(advanceTimer.current)
  }, [item?.id])

  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => {
    if (result && !result.correct) nextButton.current?.focus()
  }, [result])

  if (!item) return null

  const answer = expectedAnswer(item)
  const copy = MODE_COPY[item.mode]
  const isLast = index === queue.length - 1

  function next() {
    clearTimeout(advanceTimer.current)
    if (isLast) {
      onFinish({ ...tally, asked: queue.filter((q) => !q.practice).length, keys: queue.map((q) => q.key) })
      return
    }
    setResult(null)
    setIndex((i) => i + 1)
  }

  nextRef.current = next

  function submit(value, { unknown = false } = {}) {
    if (result) return
    const ms = performance.now() - shownAt.current
    const correct = !unknown && Number(value) === answer
    const speedy = correct && profile.speedGoalMs != null && isSpeedy(item, ms, profile.speedGoalMs)
    const stars = correct ? (item.practice ? 1 : 1 + (speedy ? 1 : 0)) : 0

    onAnswer(item, { correct, ms, stars })
    setResult({ value, correct, unknown, speedy, stars })

    setTally((t) => {
      if (item.practice) return { ...t, stars: t.stars + stars }
      const streak = correct ? t.streak + 1 : 0
      return {
        firstTries: t.firstTries + 1,
        right: t.right + (correct ? 1 : 0),
        stars: t.stars + stars,
        speedy: t.speedy + (speedy ? 1 : 0),
        streak,
        bestStreak: Math.max(t.bestStreak, streak),
      }
    })

    // A missed fact comes back once before the trail ends, one step gentler.
    if (!correct && !item.practice) {
      const retry = makeItem(item.key, allowedMode(easierMode(item.mode, settings.startFor(item.key)), settings), { practice: true })
      setQueue((q) => {
        const copyQ = [...q]
        copyQ.splice(Math.min(q.length, index + 1 + CORRECTION_GAP), 0, retry)
        return copyQ
      })
    }

    if (correct) advanceTimer.current = setTimeout(() => nextRef.current(), profile.readAloud ? 1400 : 900)
  }

  const progress = Math.round((index / queue.length) * 100)

  return (
    <main className="game-shell" id="main">
      <div className="game-top">
        <button type="button" className="back-button" onClick={onQuit} aria-label="Leave this trail">
          ← <span>Leave</span>
        </button>
        <div className="trail-progress" aria-label={`Question ${index + 1} of ${queue.length}`}>
          <div><i style={{ width: `${progress}%` }} /></div>
          <span>{index + 1} / {queue.length}</span>
        </div>
        <span className="tally-chip" aria-label={`${tally.stars} stars this trail`}>⭐ {tally.stars}</span>
      </div>

      <section className={`question-card mode-${item.mode}`} aria-labelledby="question-title">
        <header className="question-heading">
          <span className="mode-icon" aria-hidden="true">{copy.icon}</span>
          <div>
            <span className="soft-label">
              {item.practice ? 'Second look' : copy.label}
              {title ? ` · ${title}` : ''}
            </span>
            <h1 id="question-title">{copy.title}</h1>
          </div>
          {canSpeak() && (
            <button type="button" className="say-button" onClick={() => speak(spokenQuestion(item))} aria-label="Read the question aloud">
              🔊
            </button>
          )}
        </header>

        <Question key={item.id} item={item} choices={choices} result={result} onAnswer={submit} />

        {!result && (
          <button type="button" className="unknown-button" onClick={() => submit(null, { unknown: true })}>
            Show me
          </button>
        )}

        {result && (
          <Feedback item={item} result={result} answer={answer} isLast={isLast} onNext={next} nextRef={nextButton} />
        )}
      </section>
    </main>
  )
}

function factLine(item) {
  return `${item.a} × ${item.b} = ${item.a * item.b}`
}

function Feedback({ item, result, answer, isLast, onNext, nextRef }) {
  if (result.correct) {
    return (
      <div className="feedback good" role="status">
        <span className="feedback-icon" aria-hidden="true">✓</span>
        <div>
          <b>{result.speedy ? 'Speedy!' : 'Yes!'} {factLine(item)}</b>
          {result.speedy && <p>⚡ Quick enough to count towards fluent.</p>}
        </div>
        <span className="star-pop">+{result.stars} ⭐</span>
        <button type="button" className="next-button" onClick={onNext}>{isLast ? 'Finish' : 'Next'} →</button>
      </div>
    )
  }
  return (
    <div className="feedback miss" role="status">
      <span className="feedback-icon" aria-hidden="true">{result.unknown ? '💡' : '✗'}</span>
      <div>
        <b>{result.unknown ? 'Here it is:' : 'Not quite.'} {factLine(item)}</b>
        {!result.unknown && result.value != null && (
          <p>You said {result.value}{item.mode === 'missing' ? `, but ${item.a} × ${answer} makes ${item.a * item.b}` : ''}.</p>
        )}
        <p className="tip">{tipFor(item.a, item.b)}</p>
        {!item.practice && <p className="soft">It will come back for another go.</p>}
      </div>
      <button type="button" className="next-button" onClick={onNext} ref={nextRef}>
        {isLast ? 'Finish' : 'Got it'} →
      </button>
    </div>
  )
}
