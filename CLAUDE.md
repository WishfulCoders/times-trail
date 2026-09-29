# Times Trail — working notes

A calm, local-first times-tables game for kids, from first counting to instant recall.
Sibling of `../spell-trail`: same stack (Vite + React, a Cloudflare Worker serving `dist/`,
progress in `localStorage`, optional code-based backup in KV), a different game, and
**MIT-licensed** (spell-trail is AGPL + commercial; this one is deliberately permissive).

## Where things stand

| | |
| --- | --- |
| Live at | `times-trail.wishfulcoders.workers.dev` (no custom domain yet) |
| Cloudflare account | Wishfulcoders@gmail.com. The account ID is in `wrangler.prod.jsonc`, which is gitignored |
| Storage | `BACKUPS` KV (`times-trail-backups`), used for optional backups only |
| Repo | `github.com/WishfulCoders/times-trail`, public |

## Run it

```bash
npm install
npm run dev      # app only; /api/backup 404s without the Worker
npm test
npm run build
```

## The design in one screen

- **The fact is the unit.** `factKey(7, 8) === factKey(8, 7) === '7x8'`, so 12 × 12 is 78
  facts, not 144. Questions still ask both ways round (`makeItem` flips at random).
- **Levels, not ages** (`src/levels.js`). Tables open one level at a time along
  `UNLOCK_PATH`: ×2 → ×1 & ×10 → ×5 → ×3 → ×4 → ×11 → ×9 → ×6 → ×8 → ×7 → ×12. Every table
  runs to × 12, so there's no separate "bigger numbers" step. The next level opens at
  the end of a trail once `UNLOCK_SHARE` (¾) of the facts the newest level *added* are
  recalled (`newestFacts`: the 3s add 8 facts, not 12). Each level pays a star bonus. Home
  shows the path and a progress bar. Grown-ups can set the level directly.
- **Placement** (`PLACEMENTS`) is asked once, when a player is added: just starting,
  knows 2s/5s/10s, knows up to 5s, or knows most. It sets the level and marks those
  tables as `knownTables`. A never-met fact starts at multiple choice if either factor is
  a known table, at dot pictures for an early learner (`young`), and at skip counting
  otherwise (`startIndexFor`). `young` also means 3 choices and no missing-number
  questions (`roundSettings`). Old saves with an age `stageId` are migrated to a level.
- **Five modes, gentlest first** (`MODES` in `src/game.js`): `groups` (rows of dots),
  `skip` (skip-count stones with one missing), `choose` (pick from plausible answers),
  `missing` (7 × ? = 56), `type` (the recall checkpoint). `modeCeiling` unlocks one mode
  per right answer from the fact's start index; review camp holds a fact low until it's
  answered cleanly. `fitMode` swaps dot pictures for skip counting above 60 dots.
  Early learners skip `missing` (`allowedMode`).
- **Dots are grouped in fives** both ways, like a ten-frame, so an array reads as blocks
  rather than a wall. After answering, each row shows its running total (skip counting).
- **Decoys are plausible mistakes** (`decoysFor`): neighbouring facts, the classic
  mix-ups (54/56, 42/48), adding instead of multiplying, swapped digits. Random
  near-misses only fill in for tiny facts.
- **Mastery ladder:** new → seen → practising → recalled → fluent. `recalled` needs a
  first-try typed answer (`missing` or `type`). `fluent` needs a first-try `type` answer
  inside the player's speed goal on **two different days**. A first-try miss clears the
  fast days, so "fluent" means "knows it today". Timing is silent; children never see a
  clock. A speedy answer earns a bonus star instead.
- **Review camp:** missed facts, until `REVIEW_CLEAR` (2) clean answers since the miss.
  A missed fact also comes back within the trail, once, one mode gentler
  (`easierMode`, floored at skip counting), as a practice item that never moves the ladder.
- **Tips after a miss** (`tipFor`) give a strategy from an easier fact (×9 is ×10 minus
  one, ×6 is ×5 plus one more, 5-6-7-8 → 56 = 7 × 8), not just the answer.
- **The star chart** (`src/StarChart.jsx`) is the progress map. A cell's product only
  appears once the fact is recalled, so the chart fills in with the child's own work.
  Tapping a row or column header starts a trail for that table.
- **Stars and companions** (`src/shop.js`) are cosmetic only. Nothing is ever gated
  behind them.

## Printing: mad minute sheets

`src/print.js` holds the logic and `src/Print.jsx` the view. It opens from the footer
("Print sheets") and from Grown-ups. `madMinute` deals problems from a deck of t × 1 to
t × 12 for each chosen table, so every table gets an equal share. It never repeats a fact
back to back and puts the table's number on top or bottom at random. Optional focus facts
(the player's `trickiest`) take up to a quarter of the sheet, capped at three appearances
each. Sheets are seeded (`seededRandom`), so the preview is exactly what prints, and
"New problems" just picks a new seed. `madMinuteSet` gives up to `MAX_PAGES` different
sheets, each followed by its answer key on its own page.

Sizes are 20, 30, 50 or 100 problems. Each size has its own font and row spacing in
`styles.css` so it fills a Letter/A4 page. `@media print` strips the app chrome and the
`.print-controls`. On phones, 50- and 100-problem previews scroll inside `.sheets`
rather than squashing.

## Players, storage, backup

Up to six players (`src/profiles.js`), stored under `times-trail:v1`. `normalizeStore`
never throws, and `normalizeProfile` snaps any bad setting back to a default.
A saved `speedGoalMs: null` means "no speed goal" and is kept; a missing field takes the
default (none for early learners, 5s otherwise).

Backup (`src/backup.js`, `worker/index.js`) is a straight port of spell-trail's: a random
`word-word-word-1234` code is the only key, blobs live in the `BACKUPS` KV namespace for
two years, and there are no accounts. The Grown-ups page says so plainly and holds the
privacy statement. **Update it whenever data handling changes.**

## Config and deploys

Same split as spell-trail. `wrangler.jsonc` is the committed contributor config, with a
placeholder KV id and no account. Production deploys from the gitignored
`wrangler.prod.jsonc`, which holds the real account and KV IDs:

```bash
CLOUDFLARE_API_TOKEN="$(cat ~/Dev/.cloudflare-api)" npm run deploy
```

If `wrangler.prod.jsonc` is lost, both IDs are readable from the Cloudflare dashboard.
Don't put them in `wrangler.jsonc`.

## Ideas not built yet

- Printable blank 12 × 12 grids to fill in.
- Quick-draw true/false, "which facts make 24?", a match-pairs memory game.
- A stepping-stones mode (7 × 8 = 7 × 7 + __).
- Weighting review towards the mode a fact keeps failing in.
