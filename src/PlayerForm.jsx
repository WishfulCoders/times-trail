import { useState } from 'react'
import { MAX_LEVEL, PLACEMENTS, tablesAt } from './levels.js'
import { FREE_COMPANIONS, companionOf } from './shop.js'

export function PlayerForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [placementId, setPlacementId] = useState(PLACEMENTS[0].id)
  const [companion, setCompanion] = useState(FREE_COMPANIONS[0])

  return (
    <form
      className="player-form card"
      onSubmit={(event) => {
        event.preventDefault()
        if (name.trim()) onSubmit({ name, placementId, companion })
      }}
    >
      <label className="field">
        <span>Name or nickname</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="off" required />
      </label>

      <fieldset className="field">
        <legend>Where are they now?</legend>
        <div className="stage-grid">
          {PLACEMENTS.map((place) => (
            <label key={place.id} className={`stage-card ${placementId === place.id ? 'selected' : ''}`}>
              <input type="radio" name="placement" value={place.id} checked={placementId === place.id} onChange={() => setPlacementId(place.id)} />
              <span className="stage-emoji" aria-hidden="true">{place.emoji}</span>
              <strong>{place.name}</strong>
              <small>{place.level === MAX_LEVEL ? 'All 12 tables open' : `Opens ${tablesAt(place.level).slice().sort((x, y) => x - y).map((t) => `×${t}`).join(', ')}`}</small>
              <p>{place.blurb}</p>
            </label>
          ))}
        </div>
        <p className="hint">New tables unlock as they learn. A grown-up can open more at any time.</p>
      </fieldset>

      <fieldset className="field">
        <legend>Trail companion</legend>
        <div className="companion-pick">
          {FREE_COMPANIONS.map((id) => {
            const c = companionOf(id)
            return (
              <label key={id} className={companion === id ? 'selected' : ''}>
                <input type="radio" name="companion" value={id} checked={companion === id} onChange={() => setCompanion(id)} />
                <span aria-hidden="true">{c.emoji}</span>
                <small>{c.name}</small>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="form-actions">
        {onCancel && <button type="button" className="quiet-button" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="primary-button" disabled={!name.trim()}>Start the trail →</button>
      </div>
    </form>
  )
}
