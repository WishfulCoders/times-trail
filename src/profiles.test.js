import { describe, it, expect } from 'vitest'
import {
  STORE_KEY, MAX_PLAYERS, TRAIL_LENGTHS, SPEED_GOALS, newProfile,
  normalizeProfile, normalizeStore, loadStore, saveStore, poolFor, unlockedTables, CHART_SIZE,
} from './profiles.js'
import { factsForTables } from './facts.js'
import { PLACEMENTS, MAX_LEVEL, tablesAt } from './levels.js'
import { FREE_COMPANIONS } from './shop.js'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
  }
}
const throwing = {
  getItem() { throw new Error('denied') },
  setItem() { throw new Error('quota') },
}

describe('newProfile', () => {
  for (const placement of PLACEMENTS) {
    it(`applies the ${placement.id} placement`, () => {
      const p = newProfile({ name: 'Kit', placementId: placement.id })
      expect(p.level).toBe(placement.level)
      expect(p.knownTables).toEqual(placement.known ? [...tablesAt(placement.level)].sort((x, y) => x - y) : [])
      expect(p.young).toBe(placement.young)
      expect(p.readAloud).toBe(placement.young)
      expect(p.speedGoalMs).toBe(placement.speedGoalMs)
      expect(p.trailLength).toBe(placement.trailLength)
      expect(p.name).toBe('Kit')
      expect(p.facts).toEqual({})
      expect(p.stars).toBe(0)
      expect(p.trails).toBe(0)
      expect(p.owned).toEqual(FREE_COMPANIONS)
      expect(typeof p.id).toBe('string')
      expect(p.id.length).toBeGreaterThan(0)
      expect('stageId' in p).toBe(false)
      expect('tables' in p).toBe(false)
      expect('maxFactor' in p).toBe(false)
    })
  }
  it('defaults to the first placement, named Player, fox', () => {
    const p = newProfile()
    expect(p.level).toBe(1)
    expect(p.young).toBe(true)
    expect(p.knownTables).toEqual([])
    expect(p.name).toBe('Player')
    expect(p.companion).toBe('fox')
  })
  it('falls back to the first placement for an unknown id', () => {
    expect(newProfile({ placementId: 'wizard' }).level).toBe(PLACEMENTS[0].level)
  })
  it('a chosen free companion is kept; an unowned paid one is not', () => {
    expect(newProfile({ companion: 'owl' }).companion).toBe('owl')
    expect(newProfile({ companion: 'dragon' }).companion).toBe(FREE_COMPANIONS[0])
  })
  it('gives distinct ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newProfile().id))
    expect(ids.size).toBe(50)
  })
})

describe('normalizeProfile', () => {
  it('returns null for non-objects', () => {
    for (const junk of [null, undefined, 'x', 5, true]) expect(normalizeProfile(junk)).toBeNull()
  })
  it('clamps level into 1..MAX_LEVEL', () => {
    expect(normalizeProfile({ level: 0 }).level).toBe(1)
    expect(normalizeProfile({ level: -4 }).level).toBe(1)
    expect(normalizeProfile({ level: 99 }).level).toBe(MAX_LEVEL)
    expect(normalizeProfile({ level: 'abc' }).level).toBe(1)
    expect(normalizeProfile({ level: 4.7 }).level).toBe(4)
    expect(normalizeProfile({ level: '6' }).level).toBe(6)
    expect(normalizeProfile({}).level).toBe(1)
  })
  it('snaps a bad trailLength to the default', () => {
    expect(normalizeProfile({ trailLength: 7 }).trailLength).toBe(10)
    expect(normalizeProfile({ trailLength: 'abc' }).trailLength).toBe(10)
    expect(normalizeProfile({ young: true, trailLength: 7 }).trailLength).toBe(5)
  })
  it('keeps every allowed trailLength and speed goal, including null', () => {
    for (const trailLength of TRAIL_LENGTHS) expect(normalizeProfile({ trailLength }).trailLength).toBe(trailLength)
    for (const speedGoalMs of SPEED_GOALS) expect(normalizeProfile({ speedGoalMs }).speedGoalMs).toBe(speedGoalMs)
    expect(normalizeProfile({ young: true, speedGoalMs: null }).speedGoalMs).toBeNull()
  })
  it('accepts a numeric-string trailLength', () => {
    expect(normalizeProfile({ trailLength: '12' }).trailLength).toBe(12)
  })
  it('snaps a bad speedGoalMs to 5000', () => {
    expect(normalizeProfile({ speedGoalMs: 1234 }).speedGoalMs).toBe(5000)
  })
  it('a missing speedGoalMs is null for young players and 5000 otherwise', () => {
    expect(normalizeProfile({ young: true }).speedGoalMs).toBeNull()
    expect(normalizeProfile({ young: false }).speedGoalMs).toBe(5000)
    expect(normalizeProfile({}).speedGoalMs).toBe(5000)
  })
  it('readAloud defaults to young but an explicit value wins', () => {
    expect(normalizeProfile({ young: true }).readAloud).toBe(true)
    expect(normalizeProfile({ young: false }).readAloud).toBe(false)
    expect(normalizeProfile({ young: true, readAloud: false }).readAloud).toBe(false)
    expect(normalizeProfile({ young: false, readAloud: true }).readAloud).toBe(true)
  })
  it('cleans knownTables: numeric, in range, unique, sorted', () => {
    expect(normalizeProfile({ knownTables: [5, '3', 3, 0, 13, 'x', 12, 1.5] }).knownTables).toEqual([3, 5, 12])
    expect(normalizeProfile({ knownTables: 'nope' }).knownTables).toEqual([])
    expect(normalizeProfile({ knownTables: [] }).knownTables).toEqual([])
  })
  describe('migration from stageId', () => {
    const cases = [['sprout', 1, true], ['explorer', 3, false], ['climber', 5, false], ['summit', 11, false]]
    for (const [stageId, level, young] of cases) {
      it(`${stageId} becomes level ${level}, young ${young}`, () => {
        const p = normalizeProfile({ stageId })
        expect(p.level).toBe(level)
        expect(p.young).toBe(young)
        expect([...p.knownTables].sort((x, y) => x - y)).toEqual(stageId === 'sprout' ? [] : [...tablesAt(level)].sort((x, y) => x - y))
        expect('stageId' in p).toBe(false)
      })
    }
    it('an unknown stageId is level 1, not young', () => {
      const p = normalizeProfile({ stageId: 'zzz' })
      expect(p.level).toBe(1)
      expect(p.young).toBe(false)
    })
    it('an explicit level or young wins over the old stageId', () => {
      expect(normalizeProfile({ stageId: 'summit', level: 2 }).level).toBe(2)
      expect(normalizeProfile({ stageId: 'sprout', young: false }).young).toBe(false)
    })
    it('keeps facts, stars and companions', () => {
      const facts = { '2x3': { seen: 3 } }
      const p = normalizeProfile({ stageId: 'climber', facts, stars: 40, owned: ['penguin'], companion: 'penguin', name: 'Ada' })
      expect(p.facts).toBe(facts)
      expect(p.stars).toBe(40)
      expect(p.companion).toBe('penguin')
      expect(p.name).toBe('Ada')
    })
  })
  it('owns the free companions always, drops unknown ones, dedupes', () => {
    const p = normalizeProfile({ owned: ['penguin', 'penguin', 'ghost'] })
    expect(p.owned).toEqual([...FREE_COMPANIONS, 'penguin'])
    expect(normalizeProfile({}).owned).toEqual(FREE_COMPANIONS)
    expect(normalizeProfile({ owned: 'x' }).owned).toEqual(FREE_COMPANIONS)
    expect(normalizeProfile({ owned: [] }).owned).toEqual(FREE_COMPANIONS)
  })
  it('companion must be owned', () => {
    expect(normalizeProfile({ companion: 'dragon' }).companion).toBe(FREE_COMPANIONS[0])
    expect(normalizeProfile({ companion: 'dragon', owned: ['dragon'] }).companion).toBe('dragon')
    expect(normalizeProfile({ companion: 'turtle' }).companion).toBe('turtle')
  })
  it('clamps the name to 24 chars, trims, defaults to Player', () => {
    expect(normalizeProfile({ name: 'x'.repeat(50) }).name).toHaveLength(24)
    expect(normalizeProfile({ name: '   Bo   ' }).name).toBe('Bo')
    expect(normalizeProfile({ name: '   ' }).name).toBe('Player')
    expect(normalizeProfile({ name: null }).name).toBe('Player')
    expect(normalizeProfile({ name: 42 }).name).toBe('42')
  })
  it('sanitises stars, trails, facts, dates, id', () => {
    const p = normalizeProfile({ stars: -5, trails: 'abc', facts: 'x', createdAt: 'z', lastPlayed: 'z', id: 7 })
    expect(p.stars).toBe(0)
    expect(p.trails).toBe(0)
    expect(p.facts).toEqual({})
    expect(p.lastPlayed).toBeNull()
    expect(p.createdAt).toBeGreaterThan(0)
    expect(typeof p.id).toBe('string')
    expect(p.id.length).toBeGreaterThan(0)
    expect(normalizeProfile({ stars: 7.9 }).stars).toBe(7)
    expect(normalizeProfile({ id: 'keep' }).id).toBe('keep')
  })
  it('is idempotent', () => {
    for (const placement of PLACEMENTS) {
      const p = newProfile({ name: 'Zed', placementId: placement.id })
      expect(normalizeProfile(p)).toEqual(p)
    }
  })
  it('preserves facts by reference', () => {
    const facts = { '2x3': { seen: 1 } }
    expect(normalizeProfile({ facts }).facts).toBe(facts)
  })
})

describe('normalizeStore', () => {
  it('never throws on junk and returns an empty store', () => {
    for (const junk of [null, undefined, '', 'str', 42, true, [], {}, { profiles: 'x' }, { profiles: null }, { profiles: {} }]) {
      expect(() => normalizeStore(junk)).not.toThrow()
      expect(normalizeStore(junk)).toEqual({ activeId: null, profiles: [] })
    }
  })
  it('drops junk profile entries but keeps good ones', () => {
    const s = normalizeStore({ profiles: [null, 'x', { id: 'a', name: 'A' }, 7] })
    expect(s.profiles).toHaveLength(1)
    expect(s.activeId).toBe('a')
  })
  it('caps at MAX_PLAYERS', () => {
    const profiles = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
    const s = normalizeStore({ profiles, activeId: 'p1' })
    expect(s.profiles).toHaveLength(MAX_PLAYERS)
    expect(s.profiles.map((p) => p.id)).toEqual(profiles.slice(0, MAX_PLAYERS).map((p) => p.id))
  })
  it('an activeId beyond the cap falls back to the first profile', () => {
    const profiles = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` }))
    expect(normalizeStore({ profiles, activeId: 'p9' }).activeId).toBe('p0')
  })
  it('fixes a bad activeId, keeps a good one', () => {
    const profiles = [{ id: 'a' }, { id: 'b' }]
    expect(normalizeStore({ profiles, activeId: 'zzz' }).activeId).toBe('a')
    expect(normalizeStore({ profiles, activeId: null }).activeId).toBe('a')
    expect(normalizeStore({ profiles, activeId: 'b' }).activeId).toBe('b')
  })
  it('normalizes each profile', () => {
    const s = normalizeStore({ profiles: [{ id: 'a', name: 'y'.repeat(99), trailLength: 7 }] })
    expect(s.profiles[0].name).toHaveLength(24)
    expect(TRAIL_LENGTHS).toContain(s.profiles[0].trailLength)
  })
})

describe('loadStore / saveStore', () => {
  it('round-trips through a fake storage', () => {
    const storage = fakeStorage()
    const store = normalizeStore({ profiles: [newProfile({ name: 'A' }), newProfile({ name: 'B', placementId: 'most' })] })
    saveStore(store, storage)
    expect(storage.data[STORE_KEY]).toBeTruthy()
    expect(JSON.parse(storage.data[STORE_KEY]).version).toBe(1)
    expect(loadStore(storage)).toEqual(store)
  })
  it('empty storage gives an empty store', () => {
    expect(loadStore(fakeStorage())).toEqual({ activeId: null, profiles: [] })
  })
  it('corrupt JSON gives an empty store', () => {
    expect(loadStore(fakeStorage({ [STORE_KEY]: '{not json' }))).toEqual({ activeId: null, profiles: [] })
  })
  it('valid JSON of the wrong shape gives an empty store', () => {
    expect(loadStore(fakeStorage({ [STORE_KEY]: '"hello"' }))).toEqual({ activeId: null, profiles: [] })
    expect(loadStore(fakeStorage({ [STORE_KEY]: '{"profiles":"x"}' }))).toEqual({ activeId: null, profiles: [] })
  })
  it('storage whose getItem throws gives an empty store', () => {
    expect(() => loadStore(throwing)).not.toThrow()
    expect(loadStore(throwing)).toEqual({ activeId: null, profiles: [] })
  })
  it('storage whose setItem throws does not throw', () => {
    expect(() => saveStore({ activeId: null, profiles: [] }, throwing)).not.toThrow()
  })
  it('missing storage entirely does not throw', () => {
    expect(loadStore(null)).toEqual({ activeId: null, profiles: [] })
    expect(() => saveStore({ activeId: null, profiles: [] }, null)).not.toThrow()
  })
  it('loading repairs a stored store', () => {
    const storage = fakeStorage({
      [STORE_KEY]: JSON.stringify({ version: 1, activeId: 'gone', profiles: [{ id: 'a', trailLength: 7 }] }),
    })
    const s = loadStore(storage)
    expect(s.activeId).toBe('a')
    expect(TRAIL_LENGTHS).toContain(s.profiles[0].trailLength)
  })
})

describe('poolFor / unlockedTables', () => {
  const profile = newProfile({ placementId: 'basics' })
  it('is the facts of the tables unlocked at the level', () => {
    for (const level of [1, 3, 5, MAX_LEVEL]) {
      const p = { ...profile, level }
      expect(unlockedTables(p)).toEqual(tablesAt(level))
      expect(poolFor(p)).toEqual(factsForTables(tablesAt(level)))
    }
    expect(poolFor({ ...profile, level: MAX_LEVEL })).toHaveLength(78)
  })
  it('a single table narrows to its 12 facts', () => {
    const pool = poolFor(profile, 7)
    expect(pool).toHaveLength(12)
    expect(pool).toEqual(factsForTables([7]))
    for (const key of pool) expect(key.split('x').map(Number)).toContain(7)
  })
  it('table = null means all unlocked tables', () => {
    expect(poolFor(profile, null)).toEqual(poolFor(profile))
  })
  it('CHART_SIZE is 12', () => {
    expect(CHART_SIZE).toBe(12)
  })
})
