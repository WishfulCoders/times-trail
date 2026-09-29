<div align="center">

# ✖️ Times Trail

**Calm, local-first times-tables practice for kids — from counting dots to instant recall.**

[**Play free →**](https://times-trail.wishfulcoders.workers.dev) ·
[A Wishful Coders app](https://wishfulcoders.com)

![License: MIT](https://img.shields.io/badge/license-MIT-4fb58f.svg)
![No accounts](https://img.shields.io/badge/accounts-none-4fb58f.svg)
![Data stays on device](https://img.shields.io/badge/data-stays%20on%20device-4fb58f.svg)

</div>

---

Times Trail is a short daily **trail** of times-table questions that adapts to each child.
It starts wherever they are, opens new tables as they learn them, and keeps coming back
to the facts they missed until those facts stick.

No accounts, no ads, no sign-up. Progress lives in the browser. The only thing that ever
leaves the device is a backup a grown-up explicitly asks for.

## How it works

- **Tables unlock along a trail:** ×2 → ×1 & ×10 → ×5 → ×3 → ×4 → ×11 → ×9 → ×6 → ×8 → ×7 →
  ×12. The next table opens when a child knows three-quarters of the facts the newest one
  added (the 3s only add eight new facts, because 3 × 2 came with the 2s). A new player
  picks a starting point: just starting, knows 2s/5s/10s, knows up to 5s, or knows most.
- **Five question modes**, gentlest first: rows of dots grouped in fives, skip-counting
  stones, multiple choice, missing number (7 × ? = 56), and typed recall. Each fact climbs
  through them as it's answered correctly.
- **Wrong answers are real mistakes**, so they can't be ruled out by guessing: the
  neighbouring fact (49 or 63 for 7 × 8), the classic mix-ups (54/56), adding instead of
  multiplying, and swapped digits.
- **Fluent means fast.** A fact turns gold on the star chart once it's typed right, inside
  the speed goal, on two different days. Timing is silent: kids never see a clock, and
  quick answers earn bonus stars.
- **Misses teach a strategy**, such as "× 9 is × 10, take one away: 70 − 7 = 63". The fact
  returns later in the trail in an easier mode, then stays in review camp until it's
  answered right twice.
- **The star chart fills itself in.** A product only appears on the 12 × 12 grid once the
  child has recalled it.
- Up to six players per device, stars that buy cosmetic companions, an early-learner mode
  (pictures, read-aloud, three choices), and optional code-based backup.

## Running it

```bash
npm install
npm run dev     # the app; backup calls 404 without the Worker
npm test
npm run build
```

To run the backup API locally, create your own KV namespace
(`npx wrangler kv namespace create BACKUPS`), paste its id into `wrangler.jsonc`, then
run `npm run build && npx wrangler dev`.

`CLAUDE.md` has the working notes: how trails are built, the mastery ladder, and deploys.

## License

[MIT](./LICENSE). Copy it, change it, and use it with your own kids or classroom.

The bundled fonts, [DM Sans](https://fonts.google.com/specimen/DM+Sans) and
[Manrope](https://fonts.google.com/specimen/Manrope), are under the SIL Open Font License.
