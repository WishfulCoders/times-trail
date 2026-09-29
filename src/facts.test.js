import { describe, it, expect } from 'vitest'
import {
  factKey, parseKey, difficulty, factsForTables, decoysFor, choicesFor, tipFor,
  TABLES,
} from './facts.js'

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

const range = Array.from({ length: 12 }, (_, i) => i + 1)

describe('factKey / parseKey', () => {
  it('is symmetric', () => {
    for (const a of range) for (const b of range) expect(factKey(a, b)).toBe(factKey(b, a))
  })
  it('puts the smaller factor first and round-trips', () => {
    expect(factKey(8, 7)).toBe('7x8')
    expect(parseKey('7x8')).toEqual({ a: 7, b: 8 })
    expect(parseKey(factKey(12, 3))).toEqual({ a: 3, b: 12 })
  })
})

describe('factsForTables', () => {
  it('all 12 tables to 12 gives 78 distinct facts', () => {
    const facts = factsForTables(TABLES, 12)
    expect(facts).toHaveLength(78)
    expect(new Set(facts).size).toBe(78)
  })
  it('tables [1,2,5,10] to 5 gives an exact count', () => {
    // 1x1-5 (5) + 2x2-5 (4) + 5x3-5 (3) + 10x1-10... 10x1-5 (5) = 17
    const expected = new Set()
    for (const t of [1, 2, 5, 10]) for (let m = 1; m <= 5; m += 1) expected.add(factKey(t, m))
    const facts = factsForTables([1, 2, 5, 10], 5)
    expect(new Set(facts)).toEqual(expected)
    expect(facts).toHaveLength(expected.size)
    expect(facts).toHaveLength(17)
  })
  it('has no duplicates even when tables repeat', () => {
    const facts = factsForTables([2, 2, 3], 12)
    expect(new Set(facts).size).toBe(facts.length)
  })
  it('orders easiest first', () => {
    const facts = factsForTables(TABLES, 12)
    expect(facts.indexOf('2x3')).toBeLessThan(facts.indexOf('7x8'))
    expect(facts[0]).toBe('1x1')
    expect(facts[facts.length - 1]).toBe('8x8')
    for (let i = 1; i < facts.length; i += 1) {
      expect(difficulty(facts[i])).toBeGreaterThanOrEqual(difficulty(facts[i - 1]))
    }
  })
  it('empty tables give no facts', () => {
    expect(factsForTables([], 10)).toEqual([])
  })
})

describe('decoysFor', () => {
  for (const count of [2, 3]) {
    it(`returns exactly ${count} distinct positive integers, never the answer, for every a,b`, () => {
      const rng = mulberry32(42 + count)
      for (const a of range) {
        for (const b of range) {
          const d = decoysFor(a, b, count, rng)
          expect(d, `${a}x${b}`).toHaveLength(count)
          expect(new Set(d).size, `${a}x${b}`).toBe(count)
          for (const n of d) {
            expect(Number.isInteger(n) && n > 0, `${a}x${b} -> ${n}`).toBe(true)
            expect(n, `${a}x${b}`).not.toBe(a * b)
          }
        }
      }
    })
  }
  it('is deterministic for a seeded rng', () => {
    expect(decoysFor(7, 8, 3, mulberry32(1))).toEqual(decoysFor(7, 8, 3, mulberry32(1)))
  })
  it('7x8 decoys are plausible mix-ups', () => {
    const plausible = new Set([49, 63, 54, 64, 48, 15])
    for (let seed = 1; seed <= 30; seed += 1) {
      const d = decoysFor(7, 8, 3, mulberry32(seed))
      expect(d.some((n) => plausible.has(n)), `seed ${seed}: ${d}`).toBe(true)
    }
  })
  it('uses the neighbouring facts', () => {
    // 7x8 = 56 -> neighbours 63, 48, 64, 42; slips 54, 56(excluded), 15, 65
    const all = new Set()
    for (let seed = 1; seed <= 50; seed += 1) decoysFor(7, 8, 4, mulberry32(seed)).forEach((n) => all.add(n))
    expect(all.has(63) || all.has(64) || all.has(48)).toBe(true)
  })
})

describe('choicesFor', () => {
  it('contains the answer exactly once and has the requested size', () => {
    const rng = mulberry32(7)
    for (const count of [3, 4]) {
      for (const a of range) {
        for (const b of range) {
          const c = choicesFor(a, b, count, rng)
          expect(c).toHaveLength(count)
          expect(c.filter((n) => n === a * b)).toHaveLength(1)
          expect(new Set(c).size).toBe(count)
        }
      }
    }
  })
})

describe('tipFor', () => {
  it('returns a non-empty string mentioning the product for every fact', () => {
    const misses = []
    for (const a of range) {
      for (const b of range) {
        const tip = tipFor(a, b)
        expect(typeof tip).toBe('string')
        expect(tip.length).toBeGreaterThan(0)
        const nums = (tip.match(/\d+/g) || []).map(Number)
        if (!nums.includes(a * b)) misses.push(`${a}x${b}=${a * b}: ${tip}`)
      }
    }
    expect(misses).toEqual([])
  })
  it('is symmetric in its arguments', () => {
    for (const a of range) for (const b of range) expect(tipFor(a, b)).toBe(tipFor(b, a))
  })
})

describe('factsForTables default maxFactor', () => {
  it('defaults to a full 12 factors per table', () => {
    expect(factsForTables([7])).toHaveLength(12)
    expect(factsForTables([7])).toEqual(factsForTables([7], 12))
    expect(factsForTables(TABLES)).toHaveLength(78)
  })
})
