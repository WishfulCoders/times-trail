// Trail companions: bought with stars, cosmetic only. Nothing in the tables
// is ever locked behind them. Three are free so every new player starts
// owning their own icon; the last one is a long goal.
export const COMPANIONS = [
  { id: 'fox', emoji: '🦊', name: 'Fox', price: 0 },
  { id: 'turtle', emoji: '🐢', name: 'Turtle', price: 0 },
  { id: 'owl', emoji: '🦉', name: 'Owl', price: 0 },
  { id: 'penguin', emoji: '🐧', name: 'Penguin', price: 25 },
  { id: 'hedgehog', emoji: '🦔', name: 'Hedgehog', price: 45 },
  { id: 'raccoon', emoji: '🦝', name: 'Raccoon', price: 70 },
  { id: 'octopus', emoji: '🐙', name: 'Octopus', price: 100 },
  { id: 'sloth', emoji: '🦥', name: 'Sloth', price: 140 },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn', price: 200 },
  { id: 'dragon', emoji: '🐉', name: 'Dragon', price: 280 },
  { id: 'trex', emoji: '🦖', name: 'T. rex', price: 380 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', price: 500 },
]

export const FREE_COMPANIONS = COMPANIONS.filter((c) => c.price === 0).map((c) => c.id)

export function companionOf(id) {
  return COMPANIONS.find((c) => c.id === id) || COMPANIONS[0]
}

export function canBuy(profile, id) {
  const companion = COMPANIONS.find((c) => c.id === id)
  return !!companion && !profile.owned.includes(id) && profile.stars >= companion.price
}

export function buy(profile, id) {
  if (!canBuy(profile, id)) return profile
  const companion = companionOf(id)
  return { ...profile, stars: profile.stars - companion.price, owned: [...profile.owned, id], companion: id }
}
