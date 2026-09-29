import { difficulty, parseKey } from './facts.js'

// Question modes, gentlest first. A fact climbs through them as it is answered
// right, and a missed fact comes back one step down.
//   groups  — rows of dots: see what 3 × 4 means, pick the total
//   skip    — count by 7s with one stone missing, pick it
//   choose  — 7 × 8 = ?, pick from plausible answers
//   missing — 7 × ? = 56, typed on the number pad
//   type    — 7 × 8 = ?, typed on the number pad; the fluency checkpoint
export const MODES = ['groups', 'skip', 'choose', 'missing', 'type']
export const RECALL_MODES = new Set(['missing', 'type'])
export const PICTURE_LIMIT = 60

export const MASTERY = ['new', 'seen', 'practicing', 'recalled', 'fluent']
export const REVIEW_CLEAR = 2
export const FLUENT_DAYS = 2

export function today(now = Date.now()) {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The ladder, per fact:
//   seen       — asked at least once
//   practicing — answered right at least once, in any mode
//   recalled   — produced from memory (typed, not picked) on a first try
//   fluent     — typed right, first try, inside the speed goal, on two
//                different days
// Knowing a fact for times tables means knowing it without counting, so the
// top rung is about speed as well as accuracy. A first-try miss clears the
// fast days: "fluent" has to mean "knows it today".
export function masteryOf(stats) {
  if (!stats || !stats.seen) return 'new'
  if ((stats.fastDays?.length || 0) >= FLUENT_DAYS) return 'fluent'
  if (stats.recallDays?.length) return 'recalled'
  if (stats.right) return 'practicing'
  return 'seen'
}

export function masteryRank(stats) {
  return MASTERY.indexOf(masteryOf(stats))
}

// Review camp: a missed fact stays until it has been answered right
// REVIEW_CLEAR times since the miss. Total right answers cannot do this job —
// a fact can be right ten times and still have been missed this morning.
export function inReview(stats) {
  return !!stats && stats.wrong > 0 && stats.sinceWrong < REVIEW_CLEAR
}

export function reviewFacts(progress, pool) {
  return pool
    .filter((key) => inReview(progress?.[key]))
    .sort((x, y) => {
      const sx = progress[x]
      const sy = progress[y]
      return sx.sinceWrong - sy.sinceWrong || (sy.lastWrong || 0) - (sx.lastWrong || 0)
    })
}

// How hard a fact may be asked. A new fact starts at startIndex (see
// startIndexFor in levels.js); each right answer unlocks one mode further; a fact in review camp is
// held one step above the start until it has been answered cleanly again.
export function modeCeiling(stats, startIndex = 0) {
  const top = MODES.length - 1
  if (!stats || !stats.seen) return Math.min(startIndex, top)
  let index = Math.min(startIndex + (stats.right || 0), top)
  if (inReview(stats)) index = Math.min(index, startIndex + 1 + stats.sinceWrong)
  return Math.min(index, top)
}

// Past about 60 dots a picture stops being something you can see at a glance,
// even grouped in fives; skip counting does that job better.
export function fitMode(mode, a, b) {
  if (mode === 'groups' && a * b > PICTURE_LIMIT) return 'skip'
  return mode
}

// Mostly the hardest mode the fact has earned, sometimes one or two below, so
// a trail of known facts is not twenty identical number pads.
export function pickMode(ceiling, startIndex, rng = Math.random) {
  const r = rng()
  let index = ceiling
  if (ceiling - 2 >= startIndex && r < 0.1) index = ceiling - 2
  else if (ceiling - 1 >= startIndex && r < 0.3) index = ceiling - 1
  return MODES[index]
}

// Step down past any mode the player's settings leave out.
export function allowedMode(mode, settings) {
  let index = MODES.indexOf(mode)
  while (index > 0 && settings?.skipModes?.includes(MODES[index])) index -= 1
  return MODES[index]
}

// The mode a missed fact comes back in: one step down, but never below skip
// counting unless the player started on pictures.
export function easierMode(mode, startIndex = 0) {
  const floor = Math.min(startIndex, 1)
  return MODES[Math.max(floor, MODES.indexOf(mode) - 1)]
}

function shuffle(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

let nextId = 1

export function makeItem(key, mode, { rng = Math.random, practice = false } = {}) {
  let { a, b } = parseKey(key)
  if (rng() < 0.5) [a, b] = [b, a]
  return { id: nextId++, key, a, b, mode: fitMode(mode, a, b), practice }
}

// A trail: review camp first (up to half), a few brand-new facts, then the
// facts still being learned (longest unseen first), and only then facts
// already fluent — which still come round, oldest first, so they stay fluent.
export function buildRound({ pool, progress = {}, length = 10, settings = {}, rng = Math.random }) {
  const startFor = settings.startFor || (() => 0)
  const newLimit = settings.newLimit ?? 3
  const stats = (key) => progress[key]
  const byLastSeen = (x, y) => (stats(x)?.lastSeen || 0) - (stats(y)?.lastSeen || 0)

  const review = reviewFacts(progress, pool)
  const fresh = pool.filter((k) => !stats(k)?.seen).sort((x, y) => difficulty(x) - difficulty(y))
  const learning = pool
    .filter((k) => stats(k)?.seen && !inReview(stats(k)) && masteryOf(stats(k)) !== 'fluent')
    .sort(byLastSeen)
  const fluent = pool.filter((k) => masteryOf(stats(k)) === 'fluent' && !inReview(stats(k))).sort(byLastSeen)

  const picked = []
  const take = (list, max) => {
    for (const key of list) {
      if (picked.length >= length || max <= 0) break
      if (picked.includes(key)) continue
      picked.push(key)
      max -= 1
    }
  }
  take(review, Math.ceil(length / 2))
  take(fresh, newLimit)
  take(learning, length)
  take(fluent, Math.ceil(length / 4))
  take(fresh, length)
  take(fluent, length)
  take(review, length)

  return shuffle(picked, rng).map((key) => {
    const start = startFor(key)
    return makeItem(key, allowedMode(pickMode(modeCeiling(stats(key), start), start, rng), settings), { rng })
  })
}

export function expectedAnswer(item) {
  return item.mode === 'missing' ? item.b : item.a * item.b
}

export function isSpeedy(item, ms, speedGoalMs) {
  return item.mode === 'type' && !item.practice && (speedGoalMs == null || ms <= speedGoalMs)
}

function addDay(days, day) {
  const list = days || []
  return list.includes(day) ? list : [...list, day].slice(-10)
}

// Score one answer and return the new progress map. Second looks (practice)
// count towards leaving review camp but never towards the ladder, and a wrong
// second look cannot knock a fact back down.
export function scoreAnswer(progress, item, { correct, ms = null, speedGoalMs = null, now = Date.now() }) {
  const prev = progress[item.key] || {
    seen: 0, right: 0, wrong: 0, sinceWrong: 0, lastSeen: 0, lastWrong: 0,
    recallDays: [], fastDays: [], bestMs: null,
  }
  const next = { ...prev, lastSeen: now }
  const day = today(now)

  if (item.practice) {
    next.sinceWrong = correct ? prev.sinceWrong + 1 : 0
    return { ...progress, [item.key]: next }
  }

  next.seen = prev.seen + 1
  if (correct) {
    next.right = prev.right + 1
    next.sinceWrong = prev.sinceWrong + 1
    if (RECALL_MODES.has(item.mode)) next.recallDays = addDay(prev.recallDays, day)
    if (item.mode === 'type' && ms != null) {
      next.bestMs = prev.bestMs == null ? Math.round(ms) : Math.min(prev.bestMs, Math.round(ms))
      if (isSpeedy(item, ms, speedGoalMs)) next.fastDays = addDay(prev.fastDays, day)
    }
  } else {
    next.wrong = prev.wrong + 1
    next.sinceWrong = 0
    next.lastWrong = now
    next.fastDays = []
  }
  return { ...progress, [item.key]: next }
}

// Facts that climbed a rung between two snapshots, for the end-of-trail card.
export function climbed(before, after, keys) {
  return [...new Set(keys)]
    .map((key) => ({ key, from: masteryOf(before?.[key]), to: masteryOf(after?.[key]) }))
    .filter((c) => MASTERY.indexOf(c.to) > MASTERY.indexOf(c.from))
}

// The facts that have gone wrong most and are still shaky — for grown-ups.
export function trickiest(progress, pool, count = 5) {
  return pool
    .filter((k) => progress[k]?.wrong && masteryOf(progress[k]) !== 'fluent')
    .sort((x, y) => progress[y].wrong - progress[x].wrong || progress[x].sinceWrong - progress[y].sinceWrong)
    .slice(0, count)
}
