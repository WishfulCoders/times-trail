import { useState } from 'react'
import { parseKey } from './facts.js'
import { trickiest } from './game.js'
import { deleteBackup, loadBackup, saveBackup } from './backup.js'
import { PlayerForm } from './PlayerForm.jsx'
import { UNLOCK_PATH, tableLabel } from './levels.js'
import { MAX_PLAYERS, SPEED_GOALS, TRAIL_LENGTHS, newProfile, poolFor } from './profiles.js'
import { companionOf } from './shop.js'
import { ChartLegend, StarChart, masteryCounts } from './StarChart.jsx'

const BACKUP_KEY = 'times-trail:backup-code'

function readBackupCode() {
  try {
    return localStorage.getItem(BACKUP_KEY) || ''
  } catch {
    return ''
  }
}

function writeBackupCode(code) {
  try {
    if (code) localStorage.setItem(BACKUP_KEY, code)
    else localStorage.removeItem(BACKUP_KEY)
  } catch {
    // Not remembered on this device; the grown-up still has the code on screen.
  }
}

function speedLabel(ms) {
  return ms == null ? 'Off — accuracy only' : `${ms / 1000} seconds`
}

export function Grownups({ store, setStore, onBack }) {
  const [adding, setAdding] = useState(false)

  const update = (id, fn) => setStore((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? fn(p) : p)) }))
  const remove = (id) =>
    setStore((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id)
      return { profiles, activeId: s.activeId === id ? profiles[0]?.id ?? null : s.activeId }
    })

  return (
    <main className="page" id="main">
      <div className="page-head">
        <button type="button" className="back-button" onClick={onBack}>← Back</button>
        <h1 className="page-title">Grown-ups</h1>
        <p>See how each child is doing, open more tables if they're ready, and back up progress.</p>
      </div>

      <section className="grownup-section" aria-labelledby="players-heading">
        <h2 id="players-heading">Players</h2>
        {store.profiles.map((p) => (
          <PlayerSettings key={p.id} profile={p} onChange={(fn) => update(p.id, fn)} onRemove={() => remove(p.id)} />
        ))}
        {adding ? (
          <PlayerForm
            onSubmit={(fields) => {
              const created = newProfile(fields)
              setStore((s) => ({ activeId: s.activeId ?? created.id, profiles: [...s.profiles, created] }))
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          store.profiles.length < MAX_PLAYERS && (
            <button type="button" className="quiet-button" onClick={() => setAdding(true)}>＋ Add a player</button>
          )
        )}
      </section>

      <Backup store={store} setStore={setStore} />
      <Privacy />
    </main>
  )
}

function Confirm({ label, question, onYes, danger = false }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return <button type="button" className={`quiet-button ${danger ? 'danger' : ''}`} onClick={() => setAsking(true)}>{label}</button>
  }
  return (
    <span className="confirm">
      {question}
      <button type="button" className="quiet-button danger" onClick={() => { setAsking(false); onYes() }}>Yes</button>
      <button type="button" className="quiet-button" onClick={() => setAsking(false)}>No</button>
    </span>
  )
}

function PlayerSettings({ profile, onChange, onRemove }) {
  const { counts, total } = masteryCounts(profile)
  const tricky = trickiest(profile.facts, poolFor(profile))
  const set = (field) => (event) => {
    const raw = event.target.value
    const value = raw === 'off' ? null : Number(raw)
    onChange((p) => ({ ...p, [field]: value }))
  }
  const toggle = (field) => (event) => onChange((p) => ({ ...p, [field]: event.target.checked }))

  return (
    <details className="card player-settings">
      <summary>
        <span className="player-emoji" aria-hidden="true">{companionOf(profile.companion).emoji}</span>
        <span>
          <strong>{profile.name}</strong>
          <small>
            Level {profile.level} · {counts.fluent} fluent, {counts.recalled} known of {total} · {profile.trails} trails
          </small>
        </span>
      </summary>

      <div className="settings-grid">
        <label className="field">
          <span>Name</span>
          <input
            value={profile.name}
            maxLength={24}
            onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))}
            onBlur={(e) => onChange((p) => ({ ...p, name: e.target.value.trim() || 'Player' }))}
          />
        </label>

        <label className="field">
          <span>Tables open</span>
          <select value={profile.level} onChange={(e) => onChange((p) => ({ ...p, level: Number(e.target.value) }))}>
            {UNLOCK_PATH.map((step, i) => (
              <option key={i} value={i + 1}>Level {i + 1} — adds {tableLabel(step)}</option>
            ))}
          </select>
          <small className="hint">Tables open by themselves as facts are learned (order: {UNLOCK_PATH.map(tableLabel).join(', ')}). Open more here if they already know them.</small>
        </label>

        <fieldset className="field">
          <legend>Help</legend>
          <label className="switch">
            <input type="checkbox" checked={profile.young} onChange={toggle('young')} />
            <span>
              <b>Early learner</b>
              <small>New facts start as dot pictures, three answer choices, and no “7 × ? = 56” questions.</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={profile.readAloud} onChange={toggle('readAloud')} />
            <span>
              <b>Read questions aloud</b>
              <small>Uses the device's built-in voice.</small>
            </span>
          </label>
        </fieldset>

        <label className="field">
          <span>Speed goal for “fluent”</span>
          <select value={profile.speedGoalMs ?? 'off'} onChange={set('speedGoalMs')}>
            {SPEED_GOALS.map((ms) => <option key={ms ?? 'off'} value={ms ?? 'off'}>{speedLabel(ms)}</option>)}
          </select>
          <small className="hint">Timed quietly — children never see a clock. A typed answer inside the goal, on two different days, makes a fact fluent.</small>
        </label>

        <label className="field">
          <span>Questions per trail</span>
          <select value={profile.trailLength} onChange={set('trailLength')}>
            {TRAIL_LENGTHS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="settings-chart">
        <h3>Star chart</h3>
        <StarChart profile={profile} compact />
        <ChartLegend />
        {tricky.length > 0 && (
          <p className="tricky">
            <b>Trickiest right now:</b>{' '}
            {tricky.map((k) => {
              const { a, b } = parseKey(k)
              return `${a} × ${b}`
            }).join(', ')}
          </p>
        )}
      </div>

      <div className="form-actions">
        <Confirm label="Reset progress" question={`Clear all of ${profile.name}'s progress and stars?`} onYes={() => onChange((p) => ({ ...p, facts: {}, stars: 0, trails: 0 }))} />
        <Confirm label="Remove player" question={`Remove ${profile.name} from this device?`} onYes={onRemove} danger />
      </div>
    </details>
  )
}

function Backup({ store, setStore }) {
  const [code, setCode] = useState(readBackupCode)
  const [restoreCode, setRestoreCode] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run(action) {
    setBusy(true)
    setStatus(null)
    try {
      await action()
    } catch (error) {
      setStatus({ error: true, text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const result = await saveBackup(store, code || null)
      setCode(result.code)
      writeBackupCode(result.code)
      setStatus({ text: code ? 'Backup updated.' : 'Backup saved. Write the code down somewhere safe.' })
    })

  const restore = () =>
    run(async () => {
      const result = await loadBackup(restoreCode)
      setStore({ activeId: result.activeId, profiles: result.profiles })
      setCode(result.code)
      writeBackupCode(result.code)
      setRestoreCode('')
      setStatus({ text: `Restored ${result.profiles.length} player${result.profiles.length === 1 ? '' : 's'}.` })
    })

  const remove = () =>
    run(async () => {
      await deleteBackup(code)
      setCode('')
      writeBackupCode('')
      setStatus({ text: 'Backup deleted from the server.' })
    })

  return (
    <section className="grownup-section card" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Backup</h2>
      <p>
        Progress lives only in this browser. A backup stores a copy online under a random code, so you can move it to
        another device. There's no account — <b>the code is the only key</b>, so anyone who has it can read that backup
        (nicknames and progress, nothing else). Unused backups are deleted after two years.
      </p>
      {code && (
        <p className="backup-code">Your code: <code>{code}</code></p>
      )}
      <div className="form-actions">
        <button type="button" className="primary-button" onClick={save} disabled={busy || !store.profiles.length}>
          {code ? 'Update backup' : 'Make a backup code'}
        </button>
        {code && <Confirm label="Delete backup" question="Delete the online copy?" onYes={remove} danger />}
      </div>
      <form className="restore-row" onSubmit={(e) => { e.preventDefault(); if (restoreCode.trim()) restore() }}>
        <label className="field">
          <span>Restore from a code (replaces everything on this device)</span>
          <input value={restoreCode} onChange={(e) => setRestoreCode(e.target.value)} placeholder="otter-sequoia-thicket-3341" autoComplete="off" />
        </label>
        <button type="submit" className="quiet-button" disabled={busy || !restoreCode.trim()}>Restore</button>
      </form>
      {status && <p className={status.error ? 'status error' : 'status'} role="status">{status.text}</p>}
    </section>
  )
}

function Privacy() {
  return (
    <section className="grownup-section card" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading">Privacy</h2>
      <ul className="privacy-list">
        <li>No accounts, no ads, no tracking cookies. Progress is saved in this browser's local storage.</li>
        <li>The only thing that leaves the device is a backup you make yourself, stored under a random code.</li>
        <li>
          “Read it aloud” uses your browser's built-in speech. Some browsers make the voice in the cloud, so the question
          text (like “7 times 8”) may go to the browser maker.
        </li>
      </ul>
    </section>
  )
}
