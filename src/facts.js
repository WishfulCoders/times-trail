// The fact table. Every multiplication fact up to 12 × 12, keyed so that 7 × 8
// and 8 × 7 share one record: a child who knows one knows the other, and 78
// facts is a far less daunting chart than 144.

export const MAX_TABLE = 12
export const TABLES = Array.from({ length: MAX_TABLE }, (_, i) => i + 1)

export function factKey(a, b) {
  return a <= b ? `${a}x${b}` : `${b}x${a}`
}

export function parseKey(key) {
  const [a, b] = String(key).split('x').map(Number)
  return { a, b }
}

// Easiest table first — the order a child can lean on to work a fact out.
// 7 × 8 is hard because neither 7 nor 8 offers a shortcut.
const EASE_ORDER = [1, 10, 2, 5, 11, 3, 4, 9, 6, 12, 7, 8]
const EASE_RANK = Object.fromEntries(EASE_ORDER.map((table, i) => [table, i]))

export function difficulty(key) {
  const { a, b } = parseKey(key)
  const ra = EASE_RANK[a]
  const rb = EASE_RANK[b]
  return Math.min(ra, rb) * MAX_TABLE + Math.max(ra, rb)
}

// Facts for a set of tables: every t × m with t in the tables and m from 1 to
// 12. Easiest first, so a new player meets 2 × 3 before 7 × 8.
export function factsForTables(tables, maxFactor = MAX_TABLE) {
  const keys = new Set()
  for (const t of tables) {
    for (let m = 1; m <= maxFactor; m += 1) keys.add(factKey(t, m))
  }
  return [...keys].sort((x, y) => difficulty(x) - difficulty(y))
}

// Wrong answers a child might actually give. Random numbers near the answer
// can be ruled out without knowing the fact; these cannot.
const MIX_UPS = {
  12: [16, 14], 14: [16, 21], 16: [18, 12], 18: [16, 21], 21: [24, 27], 24: [28, 21],
  27: [24, 21], 28: [24, 32], 32: [36, 28], 36: [32, 42], 42: [48, 49], 48: [42, 46],
  49: [42, 56], 54: [56, 45], 56: [54, 63], 63: [64, 56], 64: [62, 56], 72: [74, 63],
  81: [72, 18], 84: [88, 72], 96: [98, 84], 108: [118, 96], 132: [122, 144], 144: [124, 132],
}

function shuffle(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function digitSwap(n) {
  const s = String(n)
  if (s.length !== 2 || s[0] === s[1] || s[1] === '0') return null
  return Number(s[1] + s[0])
}

// Plausible wrong answers for a × b: the neighbouring fact first (7 × 8 said
// as 49 or 63), then the classic mix-ups, adding instead of multiplying, and
// swapped digits. Plain near-misses only fill in when a small fact runs out.
export function decoysFor(a, b, count = 3, rng = Math.random) {
  const p = a * b
  const neighbours = shuffle([a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b], rng)
  const slips = shuffle([...(MIX_UPS[p] || []), a + b, digitSwap(p)], rng)
  const nearby = [p + 1, p - 1, p + 2, p + 10, p - 2, p + 3, p + 4, p + 5]
  const out = []
  // Alternate the two plausible pools so four choices are not all neighbours.
  const merged = []
  for (let i = 0; i < Math.max(neighbours.length, slips.length); i += 1) {
    if (neighbours[i] != null) merged.push(neighbours[i])
    if (slips[i] != null) merged.push(slips[i])
  }
  for (const n of [...merged, ...nearby]) {
    if (out.length >= count) break
    if (n == null || !Number.isInteger(n) || n <= 0 || n === p || out.includes(n)) continue
    out.push(n)
  }
  return out
}

export function choicesFor(a, b, count, rng = Math.random) {
  return shuffle([a * b, ...decoysFor(a, b, count - 1, rng)], rng)
}

// The strategy shown after a miss: a way to work the fact out from one the
// child already knows, which is what actually rescues it next time.
export function tipFor(a, b) {
  const p = a * b
  const x = Math.min(a, b)
  const y = Math.max(a, b)
  const other = (t) => (x === t ? y : x)
  const has = (t) => x === t || y === t

  if (x === 1) return `Anything × 1 stays the same: ${y} × 1 = ${y}.`
  if (has(10)) return `× 10: put a zero on the end. ${other(10)} → ${p}.`
  if (has(2)) return `× 2 is a double: ${other(2)} + ${other(2)} = ${p}.`
  if (has(5)) return `× 5 is half of × 10: ${other(5)} × 10 = ${other(5) * 10}, and half is ${p}.`
  if (y === 11 && x <= 9) return `× 11 up to 9: write the number twice. ${x} → ${p}.`
  if (has(9)) return `× 9 is × 10, take one away: ${other(9) * 10} − ${other(9)} = ${p}.`
  if (has(4)) return `× 4 is double, then double again: ${other(4)} → ${other(4) * 2} → ${p}.`
  if (has(12)) return `× 12 is × 10 plus × 2: ${other(12) * 10} + ${other(12) * 2} = ${p}.`
  if (has(11)) return `× 11 is × 10 plus one more: ${other(11) * 10} + ${other(11)} = ${p}.`
  if (p === 56) return `5, 6, 7, 8 — 56 = 7 × 8.`
  if (x === y) return `A square: ${x} × ${x - 1} = ${x * (x - 1)}, plus one more ${x} makes ${p}.`
  if (has(3)) return `× 3 is a double plus one more: ${other(3) * 2} + ${other(3)} = ${p}.`
  if (has(6)) return `× 6 is × 5 plus one more: ${other(6) * 5} + ${other(6)} = ${p}.`
  return `Step from a square: ${x} × ${x} = ${x * x}, then ${y - x} more ${x}s makes ${p}.`
}
