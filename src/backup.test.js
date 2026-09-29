import { describe, expect, it, vi } from 'vitest'

vi.mock('./profiles.js', () => ({
  normalizeStore: (raw) => ({
    activeId: raw?.activeId ?? null,
    profiles: Array.isArray(raw?.profiles) ? raw.profiles : [],
  }),
}))

import { deleteBackup, isValidCode, loadBackup, normalizeCode, packStore, saveBackup, unpackStore } from './backup.js'
import worker, { makeCode } from '../worker/index.js'

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const store = () => ({
  activeId: 'ada',
  profiles: [{ id: 'ada', name: 'Ada' }, { id: 'ben', name: 'Ben' }],
  settings: { voiceUri: 'some-local-voice' },
  backupCode: 'x',
})

const CODE = 'otter-summit-ridge-4821'

describe('backup codes', () => {
  it('builds a readable four-part code', () => {
    const code = makeCode(new Uint32Array([1, 2, 3, 4567]))
    expect(isValidCode(code)).toBe(true)
    expect(code.split('-')).toHaveLength(4)
  })

  it('pads the digits so the shape is always the same', () => {
    expect(makeCode(new Uint32Array([0, 1, 2, 7])).endsWith('-0007')).toBe(true)
  })

  it('accepts a code the parent retyped with spaces or capitals', () => {
    expect(normalizeCode('  Otter Summit Ridge 4821 ')).toBe(CODE)
    expect(isValidCode(normalizeCode('OTTER-SUMMIT-RIDGE-4821'))).toBe(true)
  })

  it('rejects codes of the wrong shape', () => {
    for (const bad of ['', 'otter', 'otter-summit-4821', 'otter-summit-ridge-482', 'a-b-c-12345']) {
      expect(isValidCode(normalizeCode(bad)), `${bad} should be invalid`).toBe(false)
    }
  })
})

describe('backup payload', () => {
  it('round-trips every player', () => {
    const restored = unpackStore(packStore(store()))
    expect(restored.profiles).toHaveLength(2)
    expect(restored.profiles.map((p) => p.name)).toContain('Ada')
    expect(restored.activeId).toBe('ada')
    expect(restored.savedAt).toEqual(expect.any(Number))
  })

  it('packs a versioned payload', () => {
    const parsed = JSON.parse(packStore(store()))
    expect(parsed.version).toBe(1)
    expect(Object.keys(parsed).sort()).toEqual(['activeId', 'profiles', 'savedAt', 'version'])
  })

  it('refuses a payload with no players rather than wiping the device', () => {
    expect(() => unpackStore(JSON.stringify({ profiles: [] }))).toThrow(/did not contain any players/)
    expect(() => unpackStore('{}')).toThrow(/did not contain any players/)
  })

  it('does not send the device-only settings', () => {
    expect(packStore(store())).not.toContain('some-local-voice')
  })
})

describe('backup transport', () => {
  it('mints a code on first save', async () => {
    const calls = []
    const fetcher = async (url, init) => { calls.push({ url, init }); return jsonResponse({ code: 'a-b-c-0001', savedAt: 5 }) }
    const result = await saveBackup(store(), null, fetcher)
    expect(result.code).toBe('a-b-c-0001')
    expect(JSON.parse(calls[0].init.body).code).toBeUndefined()
  })

  it('reuses the existing code on later saves', async () => {
    const calls = []
    const fetcher = async (url, init) => { calls.push(init); return jsonResponse({ code: 'a-b-c-0001' }) }
    await saveBackup(store(), 'a-b-c-0001', fetcher)
    expect(JSON.parse(calls[0].body).code).toBe('a-b-c-0001')
  })

  it('loads and unpacks a backup', async () => {
    const payload = packStore(store())
    const fetcher = async () => jsonResponse({ code: CODE, payload })
    const result = await loadBackup('Otter Summit Ridge 4821', fetcher)
    expect(result.code).toBe(CODE)
    expect(result.profiles).toHaveLength(2)
  })

  it('explains a missing code in words a parent can act on', async () => {
    const fetcher = async () => jsonResponse({ error: 'not-found' }, 404)
    await expect(loadBackup(CODE, fetcher)).rejects.toThrow(/Check for typos/)
  })

  it('rejects a malformed code before making a request', async () => {
    let called = false
    const fetcher = async () => { called = true; return jsonResponse({}) }
    await expect(loadBackup('nonsense', fetcher)).rejects.toThrow(/backup code/)
    expect(called).toBe(false)
  })

  it('reports a network failure without losing local data', async () => {
    const fetcher = async () => jsonResponse({}, 500)
    await expect(saveBackup(store(), null, fetcher)).rejects.toThrow(/Could not reach/)
  })
})

describe('deleting a backup', () => {
  it('sends a DELETE for the normalized code', async () => {
    const calls = []
    const fetcher = async (url, init) => { calls.push({ url, method: init?.method }); return jsonResponse({ deleted: true }) }
    await deleteBackup('OTTER SUMMIT RIDGE 4821', fetcher)
    expect(calls[0]).toEqual({ url: `/api/backup/${CODE}`, method: 'DELETE' })
  })

  it('treats an already-missing backup as deleted', async () => {
    const fetcher = async () => jsonResponse({ error: 'not-found' }, 404)
    await expect(deleteBackup(CODE, fetcher)).resolves.toMatchObject({ deleted: true })
  })

  it('refuses a malformed code without calling the service', async () => {
    let called = false
    const fetcher = async () => { called = true; return jsonResponse({}) }
    await expect(deleteBackup('nope', fetcher)).rejects.toThrow(/backup code/)
    expect(called).toBe(false)
  })

  it('surfaces a server failure rather than claiming success', async () => {
    const fetcher = async () => jsonResponse({}, 500)
    await expect(deleteBackup(CODE, fetcher)).rejects.toThrow(/Could not reach/)
  })
})

describe('worker', () => {
  function makeEnv() {
    const data = new Map()
    const puts = []
    return {
      data,
      puts,
      BACKUPS: {
        get: async (key) => data.get(key) ?? null,
        put: async (key, value, opts) => { puts.push({ key, opts }); data.set(key, value) },
        delete: async (key) => { data.delete(key) },
      },
      ASSETS: { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) },
    }
  }
  const call = (env, path, init) => worker.fetch(new Request(`https://example.test${path}`, init), env)
  const post = (env, body) => call(env, '/api/backup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

  it('serves non-api paths from assets', async () => {
    const env = makeEnv()
    const res = await call(env, '/some/page')
    expect(await res.text()).toBe('asset:/some/page')
  })

  it('mints a code, stores the payload with a two-year TTL, and loads it back', async () => {
    const env = makeEnv()
    const res = await post(env, { payload: 'hello' })
    expect(res.status).toBe(200)
    const { code } = await res.json()
    expect(isValidCode(code)).toBe(true)
    expect(env.puts[0].opts.expirationTtl).toBe(60 * 60 * 24 * 365 * 2)

    const loaded = await call(env, `/api/backup/${code}`)
    expect(await loaded.json()).toEqual({ code, payload: 'hello' })
  })

  it('normalizes a retyped code on load', async () => {
    const env = makeEnv()
    env.data.set(CODE, 'x')
    const res = await call(env, '/api/backup/Otter-Summit-Ridge-4821')
    expect(res.status).toBe(200)
  })

  it('overwrites an existing code in place', async () => {
    const env = makeEnv()
    env.data.set(CODE, 'old')
    const res = await post(env, { code: CODE, payload: 'new' })
    expect((await res.json()).code).toBe(CODE)
    expect(env.data.get(CODE)).toBe('new')
  })

  it('rejects overwriting an unknown code, a bad code, bad json, and missing payloads', async () => {
    const env = makeEnv()
    expect((await post(env, { code: CODE, payload: 'x' })).status).toBe(404)
    expect((await post(env, { code: 'nope', payload: 'x' })).status).toBe(400)
    expect((await post(env, 'not json')).status).toBe(400)
    expect((await post(env, {})).status).toBe(400)
    expect((await post(env, { payload: 123 })).status).toBe(400)
  })

  it('rejects an oversized payload', async () => {
    const env = makeEnv()
    const res = await post(env, { payload: 'a'.repeat(256 * 1024 + 1) })
    expect(res.status).toBe(413)
    expect(env.data.size).toBe(0)
  })

  it('returns 404 for a missing backup and 400 for a malformed code', async () => {
    const env = makeEnv()
    expect((await call(env, `/api/backup/${CODE}`)).status).toBe(404)
    expect((await call(env, '/api/backup/nope')).status).toBe(400)
  })

  it('deletes a backup, then reports it gone', async () => {
    const env = makeEnv()
    env.data.set(CODE, 'x')
    const res = await call(env, `/api/backup/${CODE}`, { method: 'DELETE' })
    expect(await res.json()).toEqual({ code: CODE, deleted: true })
    expect(env.data.has(CODE)).toBe(false)
    expect((await call(env, `/api/backup/${CODE}`, { method: 'DELETE' })).status).toBe(404)
    expect((await call(env, '/api/backup/nope', { method: 'DELETE' })).status).toBe(400)
  })

  it('404s unknown api routes', async () => {
    const env = makeEnv()
    expect((await call(env, '/api/other')).status).toBe(404)
  })
})
