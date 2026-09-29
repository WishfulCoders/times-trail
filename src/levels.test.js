import { describe, it, expect } from 'vitest'
import {
  UNLOCK_PATH, MAX_LEVEL, UNLOCK_SHARE, tablesAt, newestFacts, unlockProgress, settleUnlocks,
  PLACEMENTS, startIndexFor, roundSettings,
} from './levels.js'
import { factsForTables, TABLES } from './facts.js'
import { buildRound } from './game.js'

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

// A profile at `level` where the first `known` of the newest level's facts are recalled.
function profileWith(level, known) {
  const facts = {}
  newestFacts(level).slice(0, known).forEach((key) => {
    facts[key] = { seen: 3, right: 3, wrong: 0, sinceWrong: 3, lastSeen: 1, recallDays: ['2026-01-01'], fastDays: [] }
  })
  return { level, facts }
}

function knowAll(profile, level) {
  const facts = { ...profile.facts }
  for (const key of newestFacts(level)) {
    facts[key] = { seen: 3, right: 3, wrong: 0, sinceWrong: 3, lastSeen: 1, recallDays: ['2026-01-01'], fastDays: [] }
  }
  return { ...profile, facts }
}

describe('UNLOCK_PATH / tablesAt', () => {
  it('covers each table 1..12 exactly once', () => {
    expect([...UNLOCK_PATH.flat()].sort((a, b) => a - b)).toEqual(TABLES)
    expect(MAX_LEVEL).toBe(UNLOCK_PATH.length)
  })
  it('tablesAt(0) is empty and tablesAt(MAX_LEVEL) has all 12', () => {
    expect(tablesAt(0)).toEqual([])
    expect([...tablesAt(MAX_LEVEL)].sort((a, b) => a - b)).toEqual(TABLES)
    expect(tablesAt(MAX_LEVEL + 5)).toHaveLength(12)
    expect(tablesAt(1)).toEqual([2])
    expect(tablesAt(2)).toEqual([2, 1, 10])
  })
})

describe('newestFacts', () => {
  it('level 1 is the twelve facts of x2', () => {
    expect(newestFacts(1)).toEqual(factsForTables([2]))
    expect(newestFacts(1)).toHaveLength(12)
  })
  it('the x3 level adds only the facts not already covered', () => {
    const level = UNLOCK_PATH.findIndex((t) => t.includes(3)) + 1
    expect([...newestFacts(level)].sort()).toEqual(['3x11', '3x12', '3x3', '3x4', '3x6', '3x7', '3x8', '3x9'].sort())
    expect(newestFacts(level)).toHaveLength(8)
  })
  it('the union over all levels is all 78 facts with no overlaps', () => {
    const all = []
    for (let level = 1; level <= MAX_LEVEL; level += 1) all.push(...newestFacts(level))
    expect(all).toHaveLength(78)
    expect(new Set(all).size).toBe(78)
    expect(new Set(all)).toEqual(new Set(factsForTables(TABLES)))
  })
})

describe('unlockProgress', () => {
  it('needs ceil(total * UNLOCK_SHARE) and flips ready exactly at the threshold', () => {
    for (let level = 1; level < MAX_LEVEL; level += 1) {
      const total = newestFacts(level).length
      const needed = Math.ceil(total * UNLOCK_SHARE)
      const below = unlockProgress(profileWith(level, needed - 1))
      expect(below).toMatchObject({ known: needed - 1, needed, total, ready: false })
      const at = unlockProgress(profileWith(level, needed))
      expect(at).toMatchObject({ known: needed, needed, total, ready: true })
      expect(unlockProgress(profileWith(level, total)).ready).toBe(true)
    }
  })
  it('reports the newest and next tables', () => {
    const p = unlockProgress(profileWith(1, 0))
    expect(p.newest).toEqual([2])
    expect(p.next).toEqual([1, 10])
    expect(p.known).toBe(0)
  })
  it('counts only recalled or fluent facts', () => {
    const profile = { level: 1, facts: {} }
    const keys = newestFacts(1)
    profile.facts[keys[0]] = { seen: 2, right: 1, wrong: 0, sinceWrong: 1, recallDays: [], fastDays: [] } // practicing
    profile.facts[keys[1]] = { seen: 3, right: 3, wrong: 0, sinceWrong: 3, recallDays: ['d'], fastDays: ['a', 'b'] } // fluent
    profile.facts[keys[2]] = { seen: 3, right: 3, wrong: 0, sinceWrong: 3, recallDays: ['d'], fastDays: [] } // recalled
    expect(unlockProgress(profile).known).toBe(2)
  })
  it('is never ready at MAX_LEVEL (next is null)', () => {
    const p = unlockProgress(profileWith(MAX_LEVEL, newestFacts(MAX_LEVEL).length))
    expect(p.next).toBeNull()
    expect(p.ready).toBe(false)
  })
})

describe('settleUnlocks', () => {
  it('advances one level and reports the unlocked tables', () => {
    const profile = knowAll({ level: 1, facts: {} }, 1)
    const { profile: after, unlocked } = settleUnlocks(profile)
    expect(after.level).toBe(2)
    expect(unlocked).toEqual([1, 10])
    expect(after.facts).toBe(profile.facts)
  })
  it('advances several levels when the following levels are already known', () => {
    let profile = { level: 1, facts: {} }
    for (const level of [1, 2, 3]) profile = knowAll(profile, level)
    const { profile: after, unlocked } = settleUnlocks(profile)
    expect(after.level).toBe(4)
    expect(unlocked).toEqual([1, 10, 5, 3])
  })
  it('is a no-op when not ready', () => {
    const profile = profileWith(1, 0)
    const res = settleUnlocks(profile)
    expect(res.profile).toBe(profile)
    expect(res.unlocked).toEqual([])
  })
  it('stops at MAX_LEVEL even with everything known', () => {
    let profile = { level: 1, facts: {} }
    for (let level = 1; level <= MAX_LEVEL; level += 1) profile = knowAll(profile, level)
    const { profile: after, unlocked } = settleUnlocks(profile)
    expect(after.level).toBe(MAX_LEVEL)
    expect([...unlocked].sort((a, b) => a - b)).toEqual(TABLES.filter((t) => t !== 2))
  })
  it('does not mutate the input profile', () => {
    const profile = knowAll({ level: 1, facts: {} }, 1)
    settleUnlocks(profile)
    expect(profile.level).toBe(1)
  })
})

describe('placements', () => {
  it('each placement has a valid level and unique id', () => {
    expect(new Set(PLACEMENTS.map((p) => p.id)).size).toBe(PLACEMENTS.length)
    for (const p of PLACEMENTS) {
      expect(p.level).toBeGreaterThanOrEqual(1)
      expect(p.level).toBeLessThanOrEqual(MAX_LEVEL)
    }
  })
})

describe('startIndexFor', () => {
  const learner = { knownTables: [2, 5], young: false }
  it('is 2 for a fact in a known table (either factor)', () => {
    expect(startIndexFor(learner, '2x7')).toBe(2)
    expect(startIndexFor(learner, '5x9')).toBe(2)
    expect(startIndexFor(learner, '3x5')).toBe(2)
    expect(startIndexFor({ knownTables: [2], young: true }, '2x3')).toBe(2)
  })
  it('is 0 for young players, 1 for everyone else', () => {
    expect(startIndexFor({ knownTables: [], young: true }, '3x4')).toBe(0)
    expect(startIndexFor(learner, '3x4')).toBe(1)
    expect(startIndexFor({ young: false }, '3x4')).toBe(1)
    expect(startIndexFor({ young: true }, '3x4')).toBe(0)
  })
})

describe('roundSettings', () => {
  it('young players skip missing-number questions and get three choices', () => {
    const s = roundSettings({ knownTables: [], young: true })
    expect(s.skipModes).toEqual(['missing'])
    expect(s.choices).toBe(3)
    expect(s.newLimit).toBe(3)
    expect(s.startFor('2x3')).toBe(0)
  })
  it('older players skip nothing and get four choices', () => {
    const s = roundSettings({ knownTables: [2], young: false })
    expect(s.skipModes).toEqual([])
    expect(s.choices).toBe(4)
    expect(s.startFor('2x3')).toBe(2)
    expect(s.startFor('3x4')).toBe(1)
  })
  it('a level-1 young player never gets missing, and only pool keys', () => {
    const profile = { level: 1, young: true, knownTables: [], facts: {} }
    const pool = factsForTables(tablesAt(1))
    let progress = {}
    for (let seed = 1; seed <= 100; seed += 1) {
      // Make some facts well-practised so the ceiling reaches missing/type.
      if (seed % 10 === 0) {
        progress = {}
        for (const key of pool) progress[key] = { seen: 8, right: 8, wrong: 0, sinceWrong: 8, lastSeen: seed, recallDays: [], fastDays: [] }
      }
      const round = buildRound({ pool, progress, length: 10, settings: roundSettings(profile), rng: mulberry32(seed) })
      expect(round.length).toBeGreaterThan(0)
      for (const item of round) {
        expect(item.mode).not.toBe('missing')
        expect(pool).toContain(item.key)
      }
    }
  })
})
