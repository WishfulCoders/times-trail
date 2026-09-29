import { describe, it, expect } from 'vitest'
import { COMPANIONS, FREE_COMPANIONS, companionOf, canBuy, buy } from './shop.js'

const player = (over = {}) => ({ stars: 0, owned: [...FREE_COMPANIONS], companion: 'fox', ...over })

describe('companions catalogue', () => {
  it('has unique ids, three free ones, and rising prices', () => {
    expect(new Set(COMPANIONS.map((c) => c.id)).size).toBe(COMPANIONS.length)
    expect(FREE_COMPANIONS).toEqual(['fox', 'turtle', 'owl'])
    const paid = COMPANIONS.filter((c) => c.price > 0).map((c) => c.price)
    expect([...paid].sort((a, b) => a - b)).toEqual(paid)
  })
  it('companionOf falls back to the first companion', () => {
    expect(companionOf('dragon').emoji).toBe('🐉')
    expect(companionOf('nope')).toBe(COMPANIONS[0])
    expect(companionOf(undefined)).toBe(COMPANIONS[0])
  })
})

describe('canBuy', () => {
  it('rejects insufficient stars', () => {
    expect(canBuy(player({ stars: 24 }), 'penguin')).toBe(false)
  })
  it('accepts exact and surplus stars', () => {
    expect(canBuy(player({ stars: 25 }), 'penguin')).toBe(true)
    expect(canBuy(player({ stars: 999 }), 'penguin')).toBe(true)
  })
  it('rejects already owned, including free ones', () => {
    expect(canBuy(player({ stars: 999, owned: ['fox', 'turtle', 'owl', 'penguin'] }), 'penguin')).toBe(false)
    expect(canBuy(player({ stars: 999 }), 'fox')).toBe(false)
  })
  it('rejects unknown ids', () => {
    expect(canBuy(player({ stars: 999 }), 'dodo')).toBe(false)
    expect(canBuy(player({ stars: 999 }), undefined)).toBe(false)
  })
})

describe('buy', () => {
  it('returns the same profile when it cannot buy', () => {
    const p = player({ stars: 10 })
    expect(buy(p, 'penguin')).toBe(p)
    expect(buy(p, 'nope')).toBe(p)
    const rich = player({ stars: 100, owned: ['fox', 'turtle', 'owl', 'penguin'] })
    expect(buy(rich, 'penguin')).toBe(rich)
  })
  it('deducts stars, adds to owned and equips, without mutating', () => {
    const p = player({ stars: 30 })
    const q = buy(p, 'penguin')
    expect(q.stars).toBe(5)
    expect(q.owned).toEqual([...FREE_COMPANIONS, 'penguin'])
    expect(q.companion).toBe('penguin')
    expect(p.stars).toBe(30)
    expect(p.owned).toEqual(FREE_COMPANIONS)
    expect(p.companion).toBe('fox')
  })
  it('spending exactly all stars leaves zero', () => {
    expect(buy(player({ stars: 25 }), 'penguin').stars).toBe(0)
  })
  it('can buy several in a row', () => {
    let p = player({ stars: 70 })
    p = buy(p, 'penguin')
    p = buy(p, 'hedgehog')
    expect(p.stars).toBe(0)
    expect(p.companion).toBe('hedgehog')
    expect(p.owned).toContain('penguin')
    expect(buy(p, 'raccoon')).toBe(p)
  })
})
