import { describe, expect, it } from 'vitest'
import { TABLES, factKey } from './facts.js'
import {
  MAX_PAGES,
  SHEET_SIZES,
  columnsFor,
  madMinute,
  madMinuteSet,
  seededRandom,
  tablesTitle,
} from './print.js'

const seq = (seed, n) => {
  const r = seededRandom(seed)
  return Array.from({ length: n }, () => r())
}
const sheet = (opts, seed = 1) => madMinute({ ...opts, rng: seededRandom(seed) })
const hasFactor = (p, t) => p.a === t || p.b === t

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(seq(42, 50)).toEqual(seq(42, 50))
  })
  it('differs between seeds', () => {
    expect(seq(1, 20)).not.toEqual(seq(2, 20))
  })
  it('stays within [0, 1)', () => {
    for (const seed of [0, 1, 7, 123456, 2 ** 31, 2 ** 32 - 1]) {
      for (const v of seq(seed, 2000)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    }
  })
})

describe('madMinute', () => {
  it('returns exactly count problems', () => {
    for (const count of [1, 20, 30, 50, 100, 37]) {
      expect(sheet({ tables: [3, 4], count })).toHaveLength(count)
    }
  })

  it('defaults to 30 problems', () => {
    expect(madMinute({ tables: [6], rng: seededRandom(3) })).toHaveLength(30)
  })

  it('uses integers 1..12 with at least one chosen table as a factor', () => {
    for (const tables of [[7], [2, 5, 10], [3, 6, 9, 12], TABLES]) {
      for (let seed = 1; seed <= 20; seed += 1) {
        for (const p of sheet({ tables, count: 100 }, seed)) {
          expect(Number.isInteger(p.a)).toBe(true)
          expect(Number.isInteger(p.b)).toBe(true)
          expect(p.a).toBeGreaterThanOrEqual(1)
          expect(p.a).toBeLessThanOrEqual(12)
          expect(p.b).toBeGreaterThanOrEqual(1)
          expect(p.b).toBeLessThanOrEqual(12)
          expect(tables.some((t) => hasFactor(p, t))).toBe(true)
        }
      }
    }
  })

  it('with tables [7] every problem contains a 7', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const problems = sheet({ tables: [7], count: 100 }, seed)
      expect(problems.every((p) => hasFactor(p, 7))).toBe(true)
    }
  })

  it('spreads problems evenly across chosen tables', () => {
    // The deck holds 12 facts per table, so a 36-problem sheet is one deal.
    // Consecutive-repeat redraws can burn a card, and facts like 2x5 belong to
    // two tables, so count by factor and assert a meaningful lower bound.
    const tables = [2, 5, 10]
    for (let seed = 1; seed <= 50; seed += 1) {
      const problems = sheet({ tables, count: 36 }, seed)
      for (const t of tables) {
        const n = problems.filter((p) => hasFactor(p, t)).length
        expect(n).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('deals exactly 12 per table when a table has no shared facts', () => {
    // With no repeats the deck is dealt one card each, so over a whole number
    // of cycles a lone table's facts each appear exactly once per cycle.
    const problems = sheet({ tables: [7], count: 12 }, 5)
    const keys = problems.map((p) => factKey(p.a, p.b)).sort()
    expect(new Set(keys).size).toBe(12)
  })

  it('never repeats the same fact back to back', () => {
    const tableSets = [[7], [1], [12], [2, 5], [2, 5, 10], [3, 4, 6], TABLES]
    for (const tables of tableSets) {
      for (let seed = 1; seed <= 200; seed += 1) {
        const problems = sheet({ tables, count: 100 }, seed)
        for (let i = 1; i < problems.length; i += 1) {
          const prev = problems[i - 1]
          const cur = problems[i]
          expect(factKey(cur.a, cur.b)).not.toBe(factKey(prev.a, prev.b))
        }
      }
    }
  })

  it('varies orientation', () => {
    const problems = sheet({ tables: [7], count: 100 }, 9)
    const seven = (p) => (p.a === 7 ? 'top' : 'bottom')
    const on = problems.filter((p) => p.a !== p.b)
    expect(on.some((p) => seven(p) === 'top')).toBe(true)
    expect(on.some((p) => seven(p) === 'bottom')).toBe(true)
    const keys = new Set(problems.map((p) => `${p.a}x${p.b}`))
    expect(keys.has('7x3') || keys.has('3x7')).toBe(true)
    expect(keys.has('7x3') && keys.has('3x7')).toBe(true)
  })

  describe('focus', () => {
    // Tables [2] never deal 7x8 from the deck, so every 7x8 comes from a focus
    // slot. A focus slot directly after another focus slot is replaced by a
    // deck draw to avoid a repeat, so the count is between 1 and floor(n/4).
    it('shows each focus fact at most three times, and caps focus at a quarter of the sheet', () => {
      for (let seed = 1; seed <= 50; seed += 1) {
        const problems = sheet({ tables: [2], count: 40, focus: ['7x8'] }, seed)
        const n = problems.filter((p) => factKey(p.a, p.b) === '7x8').length
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(3)
      }
      const many = ['3x7', '4x7', '6x7', '6x8', '7x8', '7x9', '8x9', '6x9', '4x8', '3x8', '7x7', '8x8']
      for (let seed = 1; seed <= 20; seed += 1) {
        const problems = sheet({ tables: [2], count: 40, focus: many }, seed)
        const focused = problems.filter((p) => many.includes(factKey(p.a, p.b))).length
        expect(focused).toBeLessThanOrEqual(10)
      }
    })

    it('shows every focus fact when several are given', () => {
      const focus = ['7x8', '6x9', '4x12']
      const problems = sheet({ tables: [2], count: 40, focus }, 4)
      const keys = new Set(problems.map((p) => factKey(p.a, p.b)))
      for (const k of focus) expect(keys.has(k)).toBe(true)
    })

    it('with no focus only deck facts appear', () => {
      for (let seed = 1; seed <= 20; seed += 1) {
        const problems = sheet({ tables: [2], count: 40 }, seed)
        expect(problems.every((p) => hasFactor(p, 2))).toBe(true)
        expect(problems.some((p) => factKey(p.a, p.b) === '7x8')).toBe(false)
      }
    })
  })

  it('returns [] for empty or invalid tables', () => {
    expect(sheet({ tables: [] })).toEqual([])
    expect(sheet({ tables: [0] })).toEqual([])
    expect(sheet({ tables: [13, 99, -1] })).toEqual([])
    expect(sheet({ tables: [2.5] })).toEqual([])
  })

  it('ignores invalid tables mixed with valid ones', () => {
    const problems = sheet({ tables: [0, 7, 13], count: 30 })
    expect(problems).toHaveLength(30)
    expect(problems.every((p) => hasFactor(p, 7))).toBe(true)
  })

  it('returns [] for count 0 or negative', () => {
    expect(sheet({ tables: [7], count: 0 })).toEqual([])
    expect(sheet({ tables: [7], count: -5 })).toEqual([])
  })

  it('is deterministic for a given rng seed', () => {
    expect(sheet({ tables: [3, 8], count: 50 }, 11)).toEqual(sheet({ tables: [3, 8], count: 50 }, 11))
  })
})

describe('madMinuteSet', () => {
  const opts = { tables: [3, 7], count: 30 }

  it('clamps pages to 1..MAX_PAGES', () => {
    expect(madMinuteSet({ ...opts, pages: 0 })).toHaveLength(1)
    expect(madMinuteSet({ ...opts, pages: -3 })).toHaveLength(1)
    expect(madMinuteSet({ ...opts, pages: 1 })).toHaveLength(1)
    expect(madMinuteSet({ ...opts, pages: 3 })).toHaveLength(3)
    expect(madMinuteSet({ ...opts, pages: MAX_PAGES })).toHaveLength(MAX_PAGES)
    expect(madMinuteSet({ ...opts, pages: 99 })).toHaveLength(MAX_PAGES)
  })

  it('defaults to a single page', () => {
    expect(madMinuteSet(opts)).toHaveLength(1)
  })

  it('is deterministic for a seed', () => {
    expect(madMinuteSet({ ...opts, pages: 4, seed: 77 })).toEqual(madMinuteSet({ ...opts, pages: 4, seed: 77 }))
  })

  it('makes every page different', () => {
    const pages = madMinuteSet({ ...opts, pages: MAX_PAGES, seed: 5 })
    const encoded = pages.map((p) => JSON.stringify(p))
    expect(new Set(encoded).size).toBe(MAX_PAGES)
    for (const p of pages) expect(p).toHaveLength(30)
  })

  it('differs across seeds', () => {
    expect(madMinuteSet({ ...opts, seed: 1 })).not.toEqual(madMinuteSet({ ...opts, seed: 2 }))
  })
})

describe('columnsFor', () => {
  it('maps each sheet size to a column count', () => {
    expect(SHEET_SIZES).toEqual([20, 30, 50, 100])
    expect(columnsFor(20)).toBe(5)
    expect(columnsFor(30)).toBe(6)
    expect(columnsFor(50)).toBe(10)
    expect(columnsFor(100)).toBe(10)
  })

  it('divides every sheet size into full rows', () => {
    for (const size of SHEET_SIZES) expect(size % columnsFor(size)).toBe(0)
  })
})

describe('tablesTitle', () => {
  it('says All tables when every table is chosen', () => {
    expect(tablesTitle(TABLES)).toBe('All tables')
    expect(tablesTitle([...TABLES].reverse())).toBe('All tables')
  })

  it('sorts numerically and joins with two spaces', () => {
    expect(tablesTitle([5, 2])).toBe('×2  ×5')
    expect(tablesTitle([10, 2, 5])).toBe('×2  ×5  ×10')
    expect(tablesTitle([7])).toBe('×7')
  })

  it('does not mutate its input', () => {
    const input = [9, 3]
    tablesTitle(input)
    expect(input).toEqual([9, 3])
  })
})
