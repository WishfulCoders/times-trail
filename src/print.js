import { MAX_TABLE, TABLES, factKey, parseKey } from './facts.js'

// Mad minute sheets: a page of vertical problems, a time limit, a score box,
// and an answer key on its own page. Paper practice needs no screen, and a
// timed sheet is the classic way to see fluency at a glance.

export const SHEET_SIZES = [20, 30, 50, 100]
export const TIME_LIMITS = [1, 2, 3, 5, null]
export const MAX_PAGES = 5
const FOCUS_REPEATS = 3

// Seeded, so the preview and the printout are the same sheet and "new
// problems" is just a new seed.
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function columnsFor(count) {
  if (count <= 20) return 5
  if (count <= 30) return 6
  return 10
}

// Problems for one sheet. Every chosen table gets an equal share: the deck
// holds t × 1 to t × 12 for each table and is dealt out, reshuffled when it
// runs dry. Focus facts (a child's tricky ones) take up to a quarter of the
// sheet, but no more than three appearances each — a page of 7 × 8 teaches
// guessing the pattern, not the fact. The table's number lands on top or bottom at random, and the same
// fact never appears twice in a row.
export function madMinute({ tables, count = 30, focus = [], rng = Math.random }) {
  const chosen = tables.filter((t) => TABLES.includes(t))
  if (!chosen.length || count <= 0) return []
  const pairs = chosen.flatMap((t) => Array.from({ length: MAX_TABLE }, (_, i) => [t, i + 1]))

  let deck = []
  const draw = () => {
    if (!deck.length) deck = shuffle(pairs, rng)
    return deck.pop()
  }

  const focusCount = Math.min(Math.floor(count / 4), focus.length * FOCUS_REPEATS)
  const focusSlots = new Set(shuffle(Array.from({ length: count }, (_, i) => i), rng).slice(0, focusCount))
  const focusDeck = focus.map((key) => {
    const { a, b } = parseKey(key)
    return [a, b]
  })
  let focusIndex = 0

  const out = []
  for (let i = 0; i < count; i += 1) {
    let pair = focusSlots.has(i) ? focusDeck[focusIndex++ % focusDeck.length] : draw()
    const previous = out[out.length - 1]
    // Try a few times to avoid a repeat; a one-fact sheet has no choice.
    for (let tries = 0; previous && factKey(...pair) === factKey(previous.a, previous.b) && tries < 5; tries += 1) {
      pair = draw()
    }
    const [x, y] = rng() < 0.5 ? pair : [pair[1], pair[0]]
    out.push({ a: x, b: y })
  }
  return out
}

// Several different sheets from one seed, one per printed page.
export function madMinuteSet({ pages = 1, seed = 1, ...options }) {
  return Array.from({ length: Math.max(1, Math.min(MAX_PAGES, pages)) }, (_, i) =>
    madMinute({ ...options, rng: seededRandom(seed + i * 7919) }),
  )
}

export function tablesTitle(tables) {
  const sorted = [...tables].sort((x, y) => x - y)
  if (sorted.length === TABLES.length) return 'All tables'
  return sorted.map((t) => `×${t}`).join('  ')
}
