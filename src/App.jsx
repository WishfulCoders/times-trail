import { useEffect, useMemo, useState } from 'react'
import { parseKey } from './facts.js'
import { climbed, reviewFacts, scoreAnswer } from './game.js'
import { Game } from './Game.jsx'
import { Grownups } from './Grownups.jsx'
import { MAX_LEVEL, UNLOCK_PATH, settleUnlocks, tableLabel, unlockProgress } from './levels.js'
import { PlayerForm } from './PlayerForm.jsx'
import { PrintSheets } from './Print.jsx'
import { MAX_PLAYERS, loadStore, newProfile, poolFor, saveStore } from './profiles.js'
import { COMPANIONS, buy, canBuy, companionOf } from './shop.js'
import { ChartLegend, MASTERY_COPY, StarChart, masteryCounts } from './StarChart.jsx'

export const STUDIO_URL = 'https://wishfulcoders.com'
const UNLOCK_BONUS = 10

export default function App() {
  const [store, setStore] = useState(() => loadStore())
  const [view, setView] = useState(() => (store.profiles.length ? 'home' : 'welcome'))
  const [trail, setTrail] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => saveStore(store), [store])

  // A new view starts at the top, with focus on its content, as a page load
  // would. Otherwise a view opened from the footer appears scrolled away.
  useEffect(() => {
    window.scrollTo(0, 0)
    const main = document.getElementById('main')
    if (main) {
      main.setAttribute('tabindex', '-1')
      main.focus({ preventScroll: true })
    }
  }, [view])

  const profile = store.profiles.find((p) => p.id === store.activeId) || null

  const updateProfile = (id, fn) =>
    setStore((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? fn(p) : p)) }))

  function addPlayer(fields) {
    const created = newProfile(fields)
    setStore((s) => ({ activeId: created.id, profiles: [...s.profiles, created].slice(0, MAX_PLAYERS) }))
    setView('home')
  }

  function choosePlayer(id) {
    setStore((s) => ({ ...s, activeId: id }))
    setView('home')
  }

  function startTrail({ table = null, review = false } = {}) {
    let pool = review ? reviewFacts(profile.facts, poolFor(profile)) : poolFor(profile, table)
    // Review camp can empty during a trail; "another trail" then means a normal one.
    if (!pool.length) {
      review = false
      pool = poolFor(profile)
    }
    const title = review ? 'Review camp' : table ? `The ${table}s` : ''
    setTrail({ id: Date.now(), pool, title, before: profile.facts })
    setView('game')
  }

  function recordAnswer(item, { correct, ms, stars }) {
    updateProfile(profile.id, (p) => ({
      ...p,
      facts: scoreAnswer(p.facts, item, { correct, ms, speedGoalMs: p.speedGoalMs }),
      stars: p.stars + stars,
      lastPlayed: Date.now(),
    }))
  }

  // Unlocks are checked when a trail ends, not mid-trail, so a new table is
  // a finish-line moment. Each one pays a star bonus.
  function finishTrail(summary) {
    const settled = settleUnlocks(profile)
    const bonus = UNLOCK_BONUS * (settled.profile.level - profile.level)
    updateProfile(profile.id, (p) => {
      const next = settleUnlocks(p).profile
      return { ...next, trails: p.trails + 1, stars: next.stars + UNLOCK_BONUS * (next.level - p.level) }
    })
    setDone({ ...summary, before: trail.before, trail, unlocked: settled.unlocked, bonus })
    setView('done')
  }

  if (view === 'welcome' || !profile) {
    return (
      <Shell>
        <main className="page narrow" id="main">
          <div className="welcome">
            <span className="big-mark" aria-hidden="true">×</span>
            <h1>Welcome to <em>Times Trail</em></h1>
            <p>Short, calm practice for the times tables. Add a player to begin — each child gets their own trail, star chart, and companions.</p>
          </div>
          <PlayerForm onSubmit={addPlayer} />
        </main>
      </Shell>
    )
  }

  const header = (
    <Header
      profile={profile}
      onHome={() => setView('home')}
      onSwitch={() => setView('players')}
      onShop={() => setView('shop')}
    />
  )

  if (view === 'game' && trail) {
    return (
      <Shell header={header} bare>
        <Game
          key={trail.id}
          profile={profile}
          pool={trail.pool}
          title={trail.title}
          onAnswer={recordAnswer}
          onFinish={finishTrail}
          onQuit={() => setView('home')}
        />
      </Shell>
    )
  }

  return (
    <Shell header={header} onGrownups={() => setView('grownups')} onPrint={() => setView('print')}>
      {view === 'players' && (
        <Players store={store} onChoose={choosePlayer} onAdd={() => setView('add')} />
      )}
      {view === 'add' && (
        <main className="page narrow" id="main">
          <h1 className="page-title">Add a player</h1>
          <PlayerForm onSubmit={addPlayer} onCancel={() => setView('players')} />
        </main>
      )}
      {view === 'home' && <Home profile={profile} onStart={startTrail} onShop={() => setView('shop')} onPrint={() => setView('print')} />}
      {view === 'done' && done && (
        <Done profile={profile} done={done} onAgain={() => startTrail(againArgs(done.trail))} onHome={() => setView('home')} />
      )}
      {view === 'shop' && (
        <Shop
          profile={profile}
          onBuy={(id) => updateProfile(profile.id, (p) => buy(p, id))}
          onEquip={(id) => updateProfile(profile.id, (p) => ({ ...p, companion: id }))}
          onBack={() => setView('home')}
        />
      )}
      {view === 'grownups' && (
        <Grownups store={store} setStore={setStore} onPrint={() => setView('print')} onBack={() => setView(store.profiles.length ? 'home' : 'welcome')} />
      )}
      {view === 'print' && <PrintSheets store={store} onBack={() => setView('home')} />}
    </Shell>
  )
}

function againArgs(trail) {
  if (trail.title === 'Review camp') return { review: true }
  const match = /^The (\d+)s$/.exec(trail.title)
  return match ? { table: Number(match[1]) } : {}
}

function Shell({ header, children, onGrownups, onPrint, bare = false }) {
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      {header}
      {children}
      {!bare && (
        <footer>
          {onGrownups && <button type="button" onClick={onGrownups}>Grown-ups</button>}
          {onPrint && <button type="button" onClick={onPrint}>Print sheets</button>}
          <a className="studio-line" href={STUDIO_URL} target="_blank" rel="noreferrer">A <b>Wishful Coders</b> app</a>
        </footer>
      )}
    </div>
  )
}

function Header({ profile, onHome, onSwitch, onShop }) {
  const companion = companionOf(profile.companion)
  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={onHome} aria-label="Times Trail home">
        <span className="brand-mark" aria-hidden="true">×</span>
        <strong>Times Trail</strong>
      </button>
      <div className="top-actions">
        <button type="button" className="chip stars" onClick={onShop} aria-label={`${profile.stars} stars — open the companion shop`}>
          ⭐ <b>{profile.stars}</b>
        </button>
        <button type="button" className="chip who" onClick={onSwitch} aria-label={`Playing as ${profile.name}. Switch player`}>
          <span aria-hidden="true">{companion.emoji}</span> <b>{profile.name}</b>
        </button>
      </div>
    </header>
  )
}

function Players({ store, onChoose, onAdd }) {
  return (
    <main className="page narrow" id="main">
      <h1 className="page-title">Who's practising?</h1>
      <div className="player-grid">
        {store.profiles.map((p) => {
          const { counts, total } = masteryCounts(p)
          return (
            <button key={p.id} type="button" className={`player-card ${p.id === store.activeId ? 'selected' : ''}`} onClick={() => onChoose(p.id)}>
              <span className="player-emoji" aria-hidden="true">{companionOf(p.companion).emoji}</span>
              <strong>{p.name}</strong>
              <small>Level {p.level} · {counts.fluent} of {total} fluent</small>
            </button>
          )
        })}
        {store.profiles.length < MAX_PLAYERS && (
          <button type="button" className="player-card add" onClick={onAdd}>
            <span className="player-emoji" aria-hidden="true">＋</span>
            <strong>Add a player</strong>
          </button>
        )}
      </div>
    </main>
  )
}

function Home({ profile, onStart, onShop, onPrint }) {
  const companion = companionOf(profile.companion)
  const pool = useMemo(() => poolFor(profile), [profile.level])
  const review = reviewFacts(profile.facts, pool)
  const { counts, total } = masteryCounts(profile)
  const nextCompanion = COMPANIONS.find((c) => !profile.owned.includes(c.id))
  const known = counts.recalled + counts.fluent

  return (
    <main className="page" id="main">
      <section className="hero card">
        <div className="hero-companion" aria-hidden="true">{companion.emoji}</div>
        <div className="hero-copy">
          <span className="soft-label">Level {profile.level} of {MAX_LEVEL}</span>
          <h1>Hi, {profile.name}!</h1>
          <p>
            {Object.keys(profile.facts).length === 0
              ? `Ready for your first trail? It's ${profile.trailLength} quick questions.`
              : `You know ${known} of your ${total} facts. ${counts.fluent ? `${counts.fluent} are fluent. ` : ''}Keep going!`}
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button big" onClick={() => onStart()}>
              Start today's trail <span aria-hidden="true">→</span>
            </button>
            {review.length > 0 && (
              <button type="button" className="camp-button" onClick={() => onStart({ review: true })}>
                ⛺ Review camp <b>{review.length}</b>
              </button>
            )}
          </div>
        </div>
      </section>

      <TrailPath profile={profile} onStart={onStart} />

      <div className="home-links">
        <button type="button" className="card shop-card" onClick={onShop}>
          <span className="shop-emoji" aria-hidden="true">{nextCompanion ? nextCompanion.emoji : '🏆'}</span>
          <span>
            <strong>Companion shop</strong>
            <small>
              {nextCompanion
                ? `${profile.stars} ⭐ saved · ${nextCompanion.name} costs ${nextCompanion.price}`
                : 'You have every companion!'}
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="card shop-card" onClick={onPrint}>
          <span className="shop-emoji" aria-hidden="true">🖨️</span>
          <span>
            <strong>Print a practice sheet</strong>
            <small>A timed mad minute on paper, from your tables</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <section className="card chart-card" aria-labelledby="chart-heading">
        <div className="card-head">
          <div>
            <h2 id="chart-heading">Your star chart</h2>
            <p>Numbers appear as you learn them. Gold means fluent.</p>
          </div>
          <div className="chart-count"><b>{counts.fluent}</b><small>of {total} fluent</small></div>
        </div>
        <StarChart profile={profile} onPickTable={(t) => onStart({ table: t })} />
        <ChartLegend />
      </section>

    </main>
  )
}

// The unlock path, one stone per table in the order they open. Open tables
// are buttons that start a trail of just that table; the next one shows
// exactly what it takes to open it.
function TrailPath({ profile, onStart }) {
  const progress = unlockProgress(profile)
  const next = new Set(progress.next || [])
  const pct = progress.needed ? Math.min(100, Math.round((progress.known / progress.needed) * 100)) : 100

  return (
    <section className="card path-card" aria-labelledby="path-heading">
      <h2 id="path-heading">Your trail</h2>
      <ol className="path">
        {UNLOCK_PATH.map((step, i) =>
          step.map((t) => {
            const level = i + 1
            if (level <= profile.level) {
              return (
                <li key={t}>
                  <button type="button" className={`path-stone open ${level === profile.level ? 'newest' : ''}`} onClick={() => onStart({ table: t })} aria-label={`Practise the ${t} times table`}>
                    <small>×</small>{t}
                  </button>
                </li>
              )
            }
            return (
              <li key={t}>
                <span className={`path-stone ${next.has(t) ? 'next' : 'locked'}`} aria-label={`${t} times table: ${next.has(t) ? 'opens next' : 'locked'}`}>
                  <i aria-hidden="true">🔒</i>×{t}
                </span>
              </li>
            )
          }),
        )}
      </ol>
      {progress.next ? (
        <div className="unlock-progress">
          <p>
            Know <b>{progress.needed}</b> of the {progress.total} new {tableLabel(progress.newest)} facts to open{' '}
            <b>{tableLabel(progress.next)}</b>. You know <b>{progress.known}</b> so far.
          </p>
          <div className="unlock-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.needed} aria-valuenow={Math.min(progress.known, progress.needed)} aria-label="Progress to the next table">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="hint">A fact counts once you've typed it right from memory. Tap an open table to practise just that one.</p>
        </div>
      ) : (
        <p className="unlock-progress">Every table is open! Now turn the whole star chart gold.</p>
      )}
    </section>
  )
}

function Done({ profile, done, onAgain, onHome }) {
  const rises = climbed(done.before, profile.facts, done.keys)
  const pct = done.firstTries ? Math.round((done.right / done.firstTries) * 100) : 0
  const cheer = pct === 100 ? 'Perfect trail!' : pct >= 80 ? 'Great trail!' : pct >= 50 ? 'Nice work!' : 'Trail complete!'

  return (
    <main className="page narrow" id="main">
      <section className="card done-card">
        <div className="done-companion" aria-hidden="true">{companionOf(profile.companion).emoji}</div>
        <h1>{cheer}</h1>
        {done.unlocked?.length > 0 && (
          <div className="unlocked-banner" role="status">
            <span aria-hidden="true">🔓</span>
            <div>
              <b>{done.unlocked.length > 1 ? 'New tables' : 'New table'} unlocked: {tableLabel(done.unlocked)}!</b>
              <small>+{done.bonus} ⭐ bonus. {done.unlocked.length > 1 ? "They're" : "It's"} on your trail now.</small>
            </div>
          </div>
        )}
        <div className="done-stats">
          <div><b>{done.right}/{done.firstTries}</b><small>right first time</small></div>
          <div><b>{done.stars}</b><small>stars earned</small></div>
          <div><b>{done.bestStreak}</b><small>best streak</small></div>
          {profile.speedGoalMs != null && <div><b>{done.speedy}</b><small>speedy answers</small></div>}
        </div>
        {rises.length > 0 && (
          <div className="climbed">
            <h2>Climbing the chart</h2>
            <ul>
              {rises.map(({ key, to }) => {
                const { a, b } = parseKey(key)
                return (
                  <li key={key} className={`m-${to}`}>
                    <b>{a} × {b}</b> <span>{MASTERY_COPY[to].short}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div className="form-actions center">
          <button type="button" className="quiet-button" onClick={onHome}>Home</button>
          <button type="button" className="primary-button" onClick={onAgain}>Another trail →</button>
        </div>
      </section>
    </main>
  )
}

function Shop({ profile, onBuy, onEquip, onBack }) {
  return (
    <main className="page" id="main">
      <div className="page-head">
        <button type="button" className="back-button" onClick={onBack}>← Home</button>
        <h1 className="page-title">Companion shop</h1>
        <p>You have <b>{profile.stars} ⭐</b>. Earn one star for each right answer, and a bonus star for speedy ones.</p>
      </div>
      <div className="shop-grid">
        {COMPANIONS.map((c) => {
          const owned = profile.owned.includes(c.id)
          const equipped = profile.companion === c.id
          return (
            <div key={c.id} className={`companion-card ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`}>
              <span className="companion-emoji" aria-hidden="true">{c.emoji}</span>
              <strong>{c.name}</strong>
              {equipped ? (
                <span className="tag">With you now</span>
              ) : owned ? (
                <button type="button" className="quiet-button" onClick={() => onEquip(c.id)}>Choose</button>
              ) : (
                <button type="button" className="buy-button" disabled={!canBuy(profile, c.id)} onClick={() => onBuy(c.id)}>
                  {c.price} ⭐
                </button>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
