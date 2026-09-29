import { MAX_TABLE, TABLES, factsForTables } from './facts.js'
import { MAX_LEVEL, clampLevel, placementOf, tablesAt } from './levels.js'
import { COMPANIONS, FREE_COMPANIONS } from './shop.js'

export const STORE_KEY = 'times-trail:v1'
export const MAX_PLAYERS = 6
export const TRAIL_LENGTHS = [5, 8, 10, 12, 15, 20]
export const SPEED_GOALS = [null, 7000, 5000, 4000, 3000]
const DEFAULT_SPEED_GOAL = 5000

// Saves from before levels had an age-based stage instead.
const STAGE_LEVELS = { sprout: 1, explorer: 3, climber: 5, summit: MAX_LEVEL }

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

export function newProfile({ name = '', placementId = 'start', companion = 'fox' } = {}) {
  const placement = placementOf(placementId)
  return normalizeProfile({
    id: randomId(),
    name,
    level: placement.level,
    knownTables: placement.known ? tablesAt(placement.level) : [],
    young: placement.young,
    readAloud: placement.young,
    speedGoalMs: placement.speedGoalMs,
    trailLength: placement.trailLength,
    companion,
    createdAt: Date.now(),
  })
}

function snap(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

export function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const level = clampLevel(raw.level ?? STAGE_LEVELS[raw.stageId] ?? 1)
  const young = typeof raw.young === 'boolean' ? raw.young : raw.stageId === 'sprout'
  const knownTables = Array.isArray(raw.knownTables)
    ? [...new Set(raw.knownTables.map(Number).filter((t) => TABLES.includes(t)))].sort((x, y) => x - y)
    : raw.stageId && raw.stageId !== 'sprout' ? tablesAt(level).sort((x, y) => x - y) : []
  const owned = Array.isArray(raw.owned)
    ? [...new Set([...FREE_COMPANIONS, ...raw.owned.filter((id) => COMPANIONS.some((c) => c.id === id))])]
    : [...FREE_COMPANIONS]
  const companion = owned.includes(raw.companion) ? raw.companion : owned[0]
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomId(),
    name: String(raw.name || '').trim().slice(0, 24) || 'Player',
    level,
    knownTables,
    young,
    readAloud: typeof raw.readAloud === 'boolean' ? raw.readAloud : young,
    // null is a real choice (no speed goal); only a missing field takes the default.
    speedGoalMs: 'speedGoalMs' in raw
      ? snap(raw.speedGoalMs, SPEED_GOALS, DEFAULT_SPEED_GOAL)
      : young ? null : DEFAULT_SPEED_GOAL,
    trailLength: snap(Number(raw.trailLength), TRAIL_LENGTHS, young ? 5 : 10),
    companion,
    owned,
    stars: Math.max(0, Math.floor(Number(raw.stars) || 0)),
    trails: Math.max(0, Math.floor(Number(raw.trails) || 0)),
    facts: raw.facts && typeof raw.facts === 'object' ? raw.facts : {},
    createdAt: Number(raw.createdAt) || Date.now(),
    lastPlayed: Number(raw.lastPlayed) || null,
  }
}

// Never throws: junk in, an empty store out.
export function normalizeStore(raw) {
  const profiles = (Array.isArray(raw?.profiles) ? raw.profiles : [])
    .map(normalizeProfile)
    .filter(Boolean)
    .slice(0, MAX_PLAYERS)
  const activeId = profiles.some((p) => p.id === raw?.activeId) ? raw.activeId : profiles[0]?.id ?? null
  return { activeId, profiles }
}

export function loadStore(storage = globalThis.localStorage) {
  try {
    return normalizeStore(JSON.parse(storage.getItem(STORE_KEY) || 'null'))
  } catch {
    return normalizeStore(null)
  }
}

export function saveStore(store, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify({ version: 1, ...store }))
  } catch {
    // Private mode or full storage: the trail still plays, it just won't be remembered.
  }
}

export function unlockedTables(profile) {
  return tablesAt(profile.level)
}

// Every fact this player has unlocked, or just one unlocked table's facts.
export function poolFor(profile, table = null) {
  return factsForTables(table ? [table] : unlockedTables(profile))
}

export const CHART_SIZE = MAX_TABLE
