import { describe, it, expect } from 'vitest'
import {
  MODES, MASTERY, REVIEW_CLEAR, PICTURE_LIMIT, today, masteryOf, masteryRank, inReview,
  reviewFacts, modeCeiling, fitMode, pickMode, easierMode, makeItem, buildRound,
  expectedAnswer, isSpeedy, scoreAnswer, climbed, trickiest, allowedMode,
} from './game.js'
import { factsForTables, parseKey, factKey, TABLES } from './facts.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 24 * 60 * 60 * 1000
const D1 = new Date(2026, 0, 5, 12).getTime()
const D2 = D1 + DAY
const D3 = D1 + 2 * DAY
const item = (key, mode, practice = false) => {
  const { a, b } = parseKey(key)
  return { id: 1, key, a, b, mode, practice }
}
const K = '7x8'
const answer = (progress, mode, opts = {}, practice = false, key = K) =>
  scoreAnswer(progress, item(key, mode, practice), { now: D1, ...opts })

describe('today', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(today(D1)).toBe('2026-01-05')
    expect(today(D2)).toBe('2026-01-06')
  })
})

describe('masteryOf ladder via scoreAnswer', () => {
  it('unseen is new', () => {
    expect(masteryOf(undefined)).toBe('new')
    expect(masteryOf({ seen: 0 })).toBe('new')
  })
  it('a wrong-only fact is seen', () => {
    const p = answer({}, 'choose', { correct: false })
    expect(masteryOf(p[K])).toBe('seen')
  })
  it('choose correct -> practicing', () => {
    const p = answer({}, 'choose', { correct: true })
    expect(masteryOf(p[K])).toBe('practicing')
    expect(p[K].recallDays).toEqual([])
  })
  it('groups and skip correct -> practicing, not recalled', () => {
    expect(masteryOf(answer({}, 'groups', { correct: true })[K])).toBe('practicing')
    expect(masteryOf(answer({}, 'skip', { correct: true })[K])).toBe('practicing')
  })
  it('type correct -> recalled', () => {
    const p = answer({}, 'type', { correct: true, ms: 20000, speedGoalMs: 5000 })
    expect(masteryOf(p[K])).toBe('recalled')
  })
  it('missing correct counts as recalled but never fast', () => {
    const p = answer({}, 'missing', { correct: true, ms: 100, speedGoalMs: 5000 })
    expect(masteryOf(p[K])).toBe('recalled')
    expect(p[K].fastDays).toEqual([])
  })
  it('type fast on two different days -> fluent', () => {
    let p = scoreAnswer({}, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D1 })
    expect(masteryOf(p[K])).toBe('recalled')
    p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 2500, speedGoalMs: 5000, now: D2 })
    expect(masteryOf(p[K])).toBe('fluent')
    expect(p[K].fastDays).toHaveLength(2)
  })
  it('same day twice is not fluent', () => {
    let p = scoreAnswer({}, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D1 })
    p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D1 + 3600000 })
    expect(p[K].fastDays).toHaveLength(1)
    expect(masteryOf(p[K])).toBe('recalled')
  })
  it('a slow day between fast days does not break the ladder', () => {
    let p = scoreAnswer({}, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D1 })
    p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 9000, speedGoalMs: 5000, now: D2 })
    expect(masteryOf(p[K])).toBe('recalled')
    p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D3 })
    expect(masteryOf(p[K])).toBe('fluent')
  })
  it('first-try miss clears fastDays and puts the fact in review', () => {
    let p = scoreAnswer({}, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D1 })
    p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D2 })
    expect(masteryOf(p[K])).toBe('fluent')
    p = scoreAnswer(p, item(K, 'type'), { correct: false, now: D3 })
    expect(p[K].fastDays).toEqual([])
    expect(masteryOf(p[K])).toBe('recalled')
    expect(inReview(p[K])).toBe(true)
    expect(p[K].sinceWrong).toBe(0)
    expect(p[K].lastWrong).toBe(D3)
  })
  it('masteryRank matches MASTERY order', () => {
    expect(masteryRank(undefined)).toBe(0)
    const p = answer({}, 'type', { correct: true, ms: 1, speedGoalMs: null })
    expect(masteryRank(p[K])).toBe(MASTERY.indexOf('recalled'))
  })
  it('does not mutate the previous progress map', () => {
    const before = {}
    const after = answer(before, 'choose', { correct: true })
    expect(before).toEqual({})
    expect(after).not.toBe(before)
  })
  it('caps stored day lists at 10 entries', () => {
    let p = {}
    for (let i = 0; i < 15; i += 1) {
      p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 1000, speedGoalMs: 5000, now: D1 + i * DAY })
    }
    expect(p[K].fastDays.length).toBeLessThanOrEqual(10)
    expect(p[K].recallDays.length).toBeLessThanOrEqual(10)
  })
})

describe('practice answers', () => {
  it('never change seen/right/wrong', () => {
    let p = answer({}, 'choose', { correct: false })
    const snap = { seen: p[K].seen, right: p[K].right, wrong: p[K].wrong }
    p = answer(p, 'choose', { correct: true }, true)
    p = answer(p, 'choose', { correct: false }, true)
    expect({ seen: p[K].seen, right: p[K].right, wrong: p[K].wrong }).toEqual(snap)
  })
  it('a fast typed practice answer does not add a fast day', () => {
    const p = answer({}, 'type', { correct: true, ms: 100, speedGoalMs: 5000 }, true)
    expect(p[K].fastDays).toEqual([])
    expect(p[K].recallDays).toEqual([])
  })
  it('a wrong practice does not clear fastDays', () => {
    let p = scoreAnswer({}, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D1 })
    p = scoreAnswer(p, item(K, 'type'), { correct: true, ms: 2000, speedGoalMs: 5000, now: D2 })
    p = scoreAnswer(p, item(K, 'choose', true), { correct: false, now: D3 })
    expect(p[K].fastDays).toHaveLength(2)
    expect(masteryOf(p[K])).toBe('fluent')
  })
  it('review clears after REVIEW_CLEAR clean answers including practice ones', () => {
    let p = answer({}, 'choose', { correct: false })
    expect(inReview(p[K])).toBe(true)
    p = answer(p, 'choose', { correct: true }, true)
    expect(inReview(p[K])).toBe(true)
    p = answer(p, 'choose', { correct: true })
    expect(p[K].sinceWrong).toBe(REVIEW_CLEAR)
    expect(inReview(p[K])).toBe(false)
  })
  it('a wrong practice restarts the clean streak', () => {
    let p = answer({}, 'choose', { correct: false })
    p = answer(p, 'choose', { correct: true }, true)
    p = answer(p, 'choose', { correct: false }, true)
    expect(p[K].sinceWrong).toBe(0)
    expect(inReview(p[K])).toBe(true)
  })
  it('practice updates lastSeen', () => {
    const p = scoreAnswer({}, item(K, 'choose', true), { correct: true, now: D2 })
    expect(p[K].lastSeen).toBe(D2)
  })
})

describe('speed goal', () => {
  it('slow typed correct -> recalled but not a fast day', () => {
    const p = answer({}, 'type', { correct: true, ms: 9000, speedGoalMs: 5000 })
    expect(masteryOf(p[K])).toBe('recalled')
    expect(p[K].fastDays).toEqual([])
    expect(p[K].bestMs).toBe(9000)
  })
  it('exactly at the goal counts', () => {
    const p = answer({}, 'type', { correct: true, ms: 5000, speedGoalMs: 5000 })
    expect(p[K].fastDays).toHaveLength(1)
  })
  it('speedGoalMs null: any typed-correct is a fast day', () => {
    const p = answer({}, 'type', { correct: true, ms: 120000, speedGoalMs: null })
    expect(p[K].fastDays).toHaveLength(1)
  })
  it('bestMs keeps the minimum, rounded', () => {
    let p = answer({}, 'type', { correct: true, ms: 4000.6, speedGoalMs: 5000 })
    expect(p[K].bestMs).toBe(4001)
    p = answer(p, 'type', { correct: true, ms: 6000, speedGoalMs: 5000 })
    expect(p[K].bestMs).toBe(4001)
    p = answer(p, 'type', { correct: true, ms: 3000, speedGoalMs: 5000 })
    expect(p[K].bestMs).toBe(3000)
  })
  it('isSpeedy requires type mode and non-practice', () => {
    expect(isSpeedy(item(K, 'type'), 100, 5000)).toBe(true)
    expect(isSpeedy(item(K, 'missing'), 100, 5000)).toBe(false)
    expect(isSpeedy(item(K, 'type', true), 100, 5000)).toBe(false)
    expect(isSpeedy(item(K, 'type'), 6000, 5000)).toBe(false)
    expect(isSpeedy(item(K, 'type'), 60000, null)).toBe(true)
  })
})

describe('modeCeiling', () => {
  const top = MODES.length - 1
  it('new fact starts at startIndex', () => {
    for (let s = 0; s <= top; s += 1) {
      expect(modeCeiling(undefined, s)).toBe(s)
      expect(modeCeiling({ seen: 0 }, s)).toBe(s)
    }
  })
  it('clamps an out-of-range startIndex', () => {
    expect(modeCeiling(undefined, 99)).toBe(top)
  })
  it('increases with right answers', () => {
    const at = (right) => modeCeiling({ seen: right, right, wrong: 0, sinceWrong: right }, 0)
    expect([0, 1, 2, 3, 4].map(at)).toEqual([0, 1, 2, 3, 4])
  })
  it('never exceeds the last mode', () => {
    for (let s = 0; s <= top; s += 1) {
      expect(modeCeiling({ seen: 50, right: 50, wrong: 0, sinceWrong: 50 }, s)).toBe(top)
    }
  })
  it('is capped while in review and loosens as it clears', () => {
    const st = (sinceWrong) => ({ seen: 9, right: 9, wrong: 1, sinceWrong })
    expect(modeCeiling(st(0), 0)).toBe(1)
    expect(modeCeiling(st(1), 0)).toBe(2)
    expect(modeCeiling(st(REVIEW_CLEAR), 0)).toBe(top)
    expect(modeCeiling(st(0), 2)).toBe(3)
    expect(modeCeiling(st(0), top)).toBe(top)
  })
  it('a review fact never has a lower ceiling than its uncapped right count allows', () => {
    // one right answer, then a miss: right=1, start 0 -> 1, review cap 1
    expect(modeCeiling({ seen: 2, right: 1, wrong: 1, sinceWrong: 0 }, 0)).toBe(1)
  })
})

describe('easierMode', () => {
  it('steps down one mode', () => {
    expect(easierMode('type', 0)).toBe('missing')
    expect(easierMode('missing', 0)).toBe('choose')
    expect(easierMode('choose', 0)).toBe('skip')
  })
  it('floor is skip unless the player started on pictures', () => {
    expect(easierMode('skip', 0)).toBe('groups')
    expect(easierMode('groups', 0)).toBe('groups')
    expect(easierMode('skip', 1)).toBe('skip')
    expect(easierMode('choose', 2)).toBe('skip')
    expect(easierMode('skip', 2)).toBe('skip')
    expect(easierMode('groups', 3)).toBe('skip')
  })
  it('always returns a valid mode', () => {
    for (const m of MODES) for (let s = 0; s < MODES.length; s += 1) expect(MODES).toContain(easierMode(m, s))
  })
})

describe('fitMode / pickMode', () => {
  it('groups become skip above PICTURE_LIMIT', () => {
    expect(fitMode('groups', 10, 10)).toBe('skip')
    expect(PICTURE_LIMIT).toBe(60)
    expect(fitMode('groups', 6, 10)).toBe('groups')
    expect(fitMode('groups', 5, 12)).toBe('groups')
    expect(fitMode('groups', 7, 9)).toBe('skip')
    expect(fitMode('groups', 9, 12)).toBe('skip')
    expect(fitMode('groups', 11, 10)).toBe('skip')
    expect(fitMode('groups', 12, 12)).toBe('skip')
    expect(fitMode('type', 12, 12)).toBe('type')
  })
  it('pickMode stays within [startIndex, ceiling]', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 300; i += 1) {
      const m = MODES.indexOf(pickMode(4, 1, rng))
      expect(m).toBeGreaterThanOrEqual(1)
      expect(m).toBeLessThanOrEqual(4)
    }
    expect(pickMode(0, 0, () => 0)).toBe('groups')
    expect(pickMode(4, 0, () => 0.99)).toBe('type')
    expect(pickMode(4, 0, () => 0.05)).toBe('choose')
    expect(pickMode(4, 0, () => 0.2)).toBe('missing')
  })
})

describe('makeItem', () => {
  it('assigns unique increasing ids, swaps by rng, keeps the key', () => {
    const a = makeItem('3x7', 'type', { rng: () => 0.9 })
    const b = makeItem('3x7', 'type', { rng: () => 0.1 })
    expect(a.id).not.toBe(b.id)
    expect([a.a, a.b]).toEqual([3, 7])
    expect([b.a, b.b]).toEqual([7, 3])
    expect(a.practice).toBe(false)
    expect(makeItem('3x7', 'type', { practice: true }).practice).toBe(true)
  })
})

describe('expectedAnswer', () => {
  it('missing expects b, others the product', () => {
    expect(expectedAnswer({ mode: 'missing', a: 7, b: 8 })).toBe(8)
    for (const m of ['groups', 'skip', 'choose', 'type']) expect(expectedAnswer({ mode: m, a: 7, b: 8 })).toBe(56)
  })
})

describe('buildRound', () => {
  const pool = factsForTables(TABLES, 12)
  const settings = { startFor: () => 0, newLimit: 3 }
  const learningStats = (i) => ({
    seen: 2, right: 1, wrong: 0, sinceWrong: 1, lastSeen: 1000 + i, lastWrong: 0, recallDays: [], fastDays: [], bestMs: null,
  })
  const reviewStats = (i) => ({
    seen: 3, right: 1, wrong: 2, sinceWrong: 0, lastSeen: 2000 + i, lastWrong: 2000 + i, recallDays: [], fastDays: [], bestMs: null,
  })
  const fluentStats = (i) => ({
    seen: 6, right: 6, wrong: 0, sinceWrong: 6, lastSeen: 500 + i, lastWrong: 0, recallDays: [D1], fastDays: [D1, D2], bestMs: 1500,
  })

  it('returns min(length, pool.length) items with no duplicate keys', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const items = buildRound({ pool, length: 10, settings, rng: mulberry32(seed) })
      expect(items).toHaveLength(10)
      expect(new Set(items.map((i) => i.key)).size).toBe(10)
    }
    const small = buildRound({ pool: pool.slice(0, 4), length: 10, settings, rng: mulberry32(1) })
    expect(small).toHaveLength(4)
    expect(new Set(small.map((i) => i.key)).size).toBe(4)
    expect(buildRound({ pool: [], length: 10, settings })).toEqual([])
  })

  it('every item has a valid mode and a*b matching its key', () => {
    const progress = {}
    pool.slice(0, 30).forEach((k, i) => { progress[k] = learningStats(i) })
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const it of buildRound({ pool, progress, length: 15, settings, rng: mulberry32(seed) })) {
        expect(MODES).toContain(it.mode)
        const { a, b } = parseKey(it.key)
        expect(it.a * it.b).toBe(a * b)
        expect(factKey(it.a, it.b)).toBe(it.key)
        expect(it.practice).toBe(false)
      }
    }
  })

  it('never uses groups for products over PICTURE_LIMIT', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const items = buildRound({ pool, length: 20, settings: { startFor: () => 0, newLimit: 20 }, rng: mulberry32(seed) })
      for (const it of items) if (it.a * it.b > PICTURE_LIMIT) expect(it.mode).not.toBe('groups')
    }
    // and it does use groups for small facts at startIndex 0
    const items = buildRound({ pool: ['2x3', '1x4'], length: 2, settings, rng: mulberry32(1) })
    expect(items.every((i) => i.mode === 'groups')).toBe(true)
  })

  it('puts review facts first: up to half the trail', () => {
    const progress = {}
    const reviewKeys = pool.slice(20, 26) // 6 facts in review
    reviewKeys.forEach((k, i) => { progress[k] = reviewStats(i) })
    pool.slice(30, 60).forEach((k, i) => { progress[k] = learningStats(i) })
    for (let seed = 1; seed <= 10; seed += 1) {
      const items = buildRound({ pool, progress, length: 10, settings, rng: mulberry32(seed) })
      const n = items.filter((i) => reviewKeys.includes(i.key)).length
      expect(n).toBe(5)
    }
  })

  it('takes all review facts if there are fewer than half', () => {
    const progress = {}
    const reviewKeys = pool.slice(20, 22)
    reviewKeys.forEach((k, i) => { progress[k] = reviewStats(i) })
    const items = buildRound({ pool, progress, length: 10, settings, rng: mulberry32(2) })
    for (const k of reviewKeys) expect(items.map((i) => i.key)).toContain(k)
  })

  it('limits new facts to newLimit when there are enough learning facts', () => {
    const progress = {}
    pool.slice(0, 40).forEach((k, i) => { progress[k] = learningStats(i) })
    for (const newLimit of [1, 2, 3, 4]) {
      const items = buildRound({ pool, progress, length: 10, settings: { startFor: () => 0, newLimit }, rng: mulberry32(5) })
      const fresh = items.filter((i) => !progress[i.key])
      expect(fresh).toHaveLength(newLimit)
    }
  })

  it('introduces the easiest new facts first', () => {
    const items = buildRound({ pool, length: 3, settings: { startFor: () => 0, newLimit: 3 }, rng: mulberry32(1) })
    expect(items.map((i) => i.key).sort()).toEqual(pool.slice(0, 3).sort())
  })

  it('learning facts come before fluent ones; fluent fills the rest', () => {
    const progress = {}
    const learning = pool.slice(0, 5)
    const fluent = pool.slice(5, 40)
    learning.forEach((k, i) => { progress[k] = learningStats(i) })
    fluent.forEach((k, i) => { progress[k] = fluentStats(i) })
    const rest = pool.slice(40)
    rest.forEach((k, i) => { progress[k] = learningStats(i + 100) }) // avoid fresh
    const items = buildRound({ pool, progress, length: 10, settings, rng: mulberry32(9) })
    const keys = items.map((i) => i.key)
    for (const k of learning) expect(keys).toContain(k)
    expect(items.filter((i) => fluent.includes(i.key)).length).toBeLessThanOrEqual(Math.ceil(10 / 4))
  })

  it('when everything is fluent, round still fills, oldest first', () => {
    const progress = {}
    pool.forEach((k, i) => { progress[k] = fluentStats(i) })
    const items = buildRound({ pool, progress, length: 5, settings, rng: mulberry32(1) })
    expect(items).toHaveLength(5)
    expect(items.map((i) => i.key).sort()).toEqual(pool.slice(0, 5).sort())
  })

  it('a pool made entirely of review facts still fills the round', () => {
    const progress = {}
    const p4 = pool.slice(0, 8)
    p4.forEach((k, i) => { progress[k] = reviewStats(i) })
    const items = buildRound({ pool: p4, progress, length: 8, settings, rng: mulberry32(1) })
    expect(items).toHaveLength(8)
  })

  it('is deterministic for a seeded rng apart from ids', () => {
    const strip = (items) => items.map(({ id, ...rest }) => rest)
    expect(strip(buildRound({ pool, length: 10, settings, rng: mulberry32(11) })))
      .toEqual(strip(buildRound({ pool, length: 10, settings, rng: mulberry32(11) })))
  })

  it('respects per-fact startFor for new facts', () => {
    const startFor = (key) => (key.startsWith('2x') || key.endsWith('x2') ? 2 : 0)
    const items = buildRound({ pool, length: 10, settings: { startFor, newLimit: 10 }, rng: mulberry32(4) })
    expect(items.some((it) => startFor(it.key) === 2)).toBe(true)
    for (const it of items) expect(it.mode).toBe(startFor(it.key) === 2 ? 'choose' : 'groups')
  })

  it('startFor 2 for every fact gives choose', () => {
    const items = buildRound({ pool, length: 10, settings: { startFor: () => 2, newLimit: 10 }, rng: mulberry32(4) })
    for (const it of items) expect(it.mode).toBe('choose')
  })

  it('startFor defaults to 0 with empty settings', () => {
    const items = buildRound({ pool: ['2x3'], length: 1, rng: mulberry32(1) })
    expect(items[0].mode).toBe('groups')
  })
})

describe('reviewFacts', () => {
  it('lists only in-review pool facts, fewest clean answers then most recent miss first', () => {
    const progress = {
      '1x2': { seen: 2, right: 1, wrong: 1, sinceWrong: 1, lastWrong: 10 },
      '1x3': { seen: 2, right: 1, wrong: 1, sinceWrong: 0, lastWrong: 10 },
      '1x4': { seen: 2, right: 1, wrong: 1, sinceWrong: 0, lastWrong: 20 },
      '1x5': { seen: 2, right: 2, wrong: 0, sinceWrong: 2, lastWrong: 0 },
      '1x6': { seen: 5, right: 4, wrong: 1, sinceWrong: 4, lastWrong: 5 },
    }
    expect(reviewFacts(progress, ['1x2', '1x3', '1x4', '1x5', '1x6', '1x7'])).toEqual(['1x4', '1x3', '1x2'])
    expect(reviewFacts(progress, ['1x5'])).toEqual([])
  })
})

describe('climbed', () => {
  it('reports only facts that moved up a rung, deduplicated', () => {
    const before = {}
    let after = answer(before, 'choose', { correct: true }, false, '2x3') // new -> practicing
    after = answer(after, 'type', { correct: true, ms: 1, speedGoalMs: null }, false, '3x4') // new -> recalled
    after = answer(after, 'choose', { correct: false }, false, '4x5') // new -> seen
    const res = climbed(before, after, ['2x3', '3x4', '4x5', '5x6', '2x3'])
    expect(res).toEqual([
      { key: '2x3', from: 'new', to: 'practicing' },
      { key: '3x4', from: 'new', to: 'recalled' },
      { key: '4x5', from: 'new', to: 'seen' },
    ])
  })
  it('ignores drops and unchanged, tolerates missing snapshots', () => {
    const good = answer({}, 'type', { correct: true, ms: 1, speedGoalMs: null })
    const worse = { [K]: { ...good[K], recallDays: [] } } // recalled -> practicing
    expect(climbed(good, worse, [K])).toEqual([])
    expect(climbed(good, good, [K])).toEqual([])
    expect(climbed(undefined, undefined, [K])).toEqual([])
    expect(climbed(undefined, good, [K])).toEqual([{ key: K, from: 'new', to: 'recalled' }])
  })
})

describe('trickiest', () => {
  const st = (wrong, sinceWrong, fluent = false) => ({
    seen: 10, right: 5, wrong, sinceWrong, recallDays: [D1], fastDays: fluent ? [D1, D2] : [],
  })
  it('orders by most wrong, excludes clean and fluent facts, honours count', () => {
    const progress = {
      '1x2': st(1, 3),
      '1x3': st(4, 1),
      '1x4': st(4, 0),
      '1x5': st(6, 0, true), // fluent -> excluded
      '1x6': { seen: 3, right: 3, wrong: 0, sinceWrong: 3, recallDays: [], fastDays: [] },
    }
    const pool = ['1x2', '1x3', '1x4', '1x5', '1x6', '1x7']
    expect(trickiest(progress, pool)).toEqual(['1x4', '1x3', '1x2'])
    expect(trickiest(progress, pool, 2)).toEqual(['1x4', '1x3'])
    expect(trickiest({}, pool)).toEqual([])
  })
})

describe('allowedMode', () => {
  const young = { skipModes: ['missing'] }
  it('steps down past skipped modes', () => {
    expect(allowedMode('missing', young)).toBe('choose')
    expect(allowedMode('type', young)).toBe('type')
    expect(allowedMode('choose', young)).toBe('choose')
  })
  it('leaves modes alone with no skipModes or settings', () => {
    expect(allowedMode('missing', { skipModes: [] })).toBe('missing')
    expect(allowedMode('missing', {})).toBe('missing')
    expect(allowedMode('missing')).toBe('missing')
  })
  it('never steps below the first mode', () => {
    expect(allowedMode('groups', { skipModes: ['groups', 'skip'] })).toBe('groups')
  })
  it('never gives early-learner settings a missing-number question in a built round', () => {
    const progress = {}
    for (const key of ['1x2', '2x2', '2x3', '2x5', '5x5']) progress[key] = { seen: 5, right: 5, wrong: 0, sinceWrong: 5, lastSeen: 1, recallDays: [], fastDays: [] }
    for (let i = 0; i < 50; i += 1) {
      const round = buildRound({ pool: Object.keys(progress), progress, length: 5, settings: { skipModes: ['missing'] }, rng: mulberry32(i + 1) })
      expect(round.every((item) => item.mode !== 'missing')).toBe(true)
    }
  })
})
