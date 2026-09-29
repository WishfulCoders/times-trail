import { factsForTables, parseKey } from './facts.js'
import { masteryOf } from './game.js'

// The trail: one new table per level, in the order they are easiest to learn.
// Every table runs to × 12, so there is no separate "bigger numbers" step —
// unlocking the 7s opens 7 × 1 to 7 × 12. The 1s ride along with the 10s
// because on their own they are too easy to be a level.
export const UNLOCK_PATH = [[2], [1, 10], [5], [3], [4], [11], [9], [6], [8], [7], [12]]
export const MAX_LEVEL = UNLOCK_PATH.length

// The next table opens once this share of the newest level's facts are known
// (recalled or fluent). Not all of them: one stubborn fact shouldn't wall off
// the rest of the trail, and it keeps coming back through review anyway.
export const UNLOCK_SHARE = 0.75

export function clampLevel(level) {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(level)) || 1))
}

export function tablesAt(level) {
  return UNLOCK_PATH.slice(0, Math.max(0, Math.min(MAX_LEVEL, level))).flat()
}

export function newestTables(level) {
  return UNLOCK_PATH[clampLevel(level) - 1]
}

export function nextTables(level) {
  return level >= MAX_LEVEL ? null : UNLOCK_PATH[level]
}

export function levelOfTable(table) {
  return UNLOCK_PATH.findIndex((step) => step.includes(table)) + 1
}

export function tableLabel(tables) {
  return tables.map((t) => `×${t}`).join(' & ')
}

// The facts a level added: its tables, minus facts an earlier table already
// covers. The 3s add eight facts, not twelve — 3 × 2 came with the 2s.
export function newestFacts(level) {
  const before = new Set(factsForTables(tablesAt(level - 1)))
  return factsForTables(tablesAt(level)).filter((key) => !before.has(key))
}

const KNOWS = new Set(['recalled', 'fluent'])

export function unlockProgress(profile) {
  const facts = newestFacts(profile.level)
  const known = facts.filter((key) => KNOWS.has(masteryOf(profile.facts[key]))).length
  const needed = Math.ceil(facts.length * UNLOCK_SHARE)
  const next = nextTables(profile.level)
  return { known, needed, total: facts.length, newest: newestTables(profile.level), next, ready: !!next && known >= needed }
}

// Called when a trail ends. Returns the (possibly) levelled-up profile and the
// tables that just opened, for the celebration.
export function settleUnlocks(profile) {
  let current = profile
  const unlocked = []
  while (unlockProgress(current).ready) {
    unlocked.push(...nextTables(current.level))
    current = { ...current, level: current.level + 1 }
  }
  return { profile: current, unlocked }
}

// Where a new player starts. Asked once, when they're added; after that the
// trail itself decides what opens next. Tables marked as already known start
// at multiple choice instead of counting, so a child who knows their 5s isn't
// made to count dots to prove it.
export const PLACEMENTS = [
  {
    id: 'start',
    emoji: '🌱',
    name: 'Just starting',
    blurb: 'Begins with the 2s, with dot pictures and questions read aloud.',
    level: 1,
    known: false,
    young: true,
    speedGoalMs: null,
    trailLength: 5,
  },
  {
    id: 'basics',
    emoji: '🧭',
    name: 'Knows 2s, 5s and 10s',
    blurb: 'A quick check of those, then the 3s open.',
    level: 3,
    known: true,
    young: false,
    speedGoalMs: 5000,
    trailLength: 8,
  },
  {
    id: 'middle',
    emoji: '🧗',
    name: 'Knows up to the 5s',
    blurb: '2s, 3s, 4s, 5s and 10s — then on to the 11s, 9s and beyond.',
    level: 5,
    known: true,
    young: false,
    speedGoalMs: 5000,
    trailLength: 10,
  },
  {
    id: 'most',
    emoji: '🏔️',
    name: 'Knows most of them',
    blurb: 'Every table open. Find the tricky ones and build speed.',
    level: MAX_LEVEL,
    known: true,
    young: false,
    speedGoalMs: 4000,
    trailLength: 12,
  },
]

export function placementOf(id) {
  return PLACEMENTS.find((p) => p.id === id) || PLACEMENTS[0]
}

// Index into MODES (game.js) that a never-met fact starts at: multiple choice
// for a table the child already knew, dot pictures for an early learner,
// skip counting for everyone else learning a new table.
export function startIndexFor(profile, key) {
  const { a, b } = parseKey(key)
  if (profile.knownTables?.includes(a) || profile.knownTables?.includes(b)) return 2
  return profile.young ? 0 : 1
}

// What the round builder needs from a player.
export function roundSettings(profile) {
  return {
    startFor: (key) => startIndexFor(profile, key),
    newLimit: 3,
    choices: profile.young ? 3 : 4,
    // "2 × ? = 10" is algebra to a five-year-old; early learners type products only.
    skipModes: profile.young ? ['missing'] : [],
  }
}
