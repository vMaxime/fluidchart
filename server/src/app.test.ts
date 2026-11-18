import { beforeEach, it, expect } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { newNote, type EntityChange, type SyncResponse } from '@chart/shared'
import { openDb } from './db'
import { createAuth } from './auth'
import { createApp } from './app'
import { readConfig } from './config'

let db: DatabaseSync
const make = (env: Record<string, string> = {}) => {
  const config = readConfig({ APP_PIN: '2468', STATIC_DIR: '/nonexistent', ...env })
  return createApp({ db, auth: createAuth(db, { pin: config.pin }), config })
}
const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
})
async function loginCookie(app: ReturnType<typeof make>) {
  const res = await app.request('/api/login', json({ pin: '2468' }))
  return res.headers.get('set-cookie')!.split(';')[0]
}

beforeEach(() => {
  db = openDb(':memory:')
})

it('login sets an HttpOnly SameSite=Lax cookie, then session answers 204', async () => {
  const app = make()
  const res = await app.request('/api/login', json({ pin: '2468' }))
  expect(await res.json()).toEqual({ ok: true })
  const cookie = res.headers.get('set-cookie')!
  expect(cookie).toMatch(/^chart_session=[\w-]+;/)
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('SameSite=Lax')
  expect(cookie).toContain('Secure')
  expect(cookie).toContain('Max-Age=31536000')
  expect((await app.request('/api/session', { headers: { Cookie: cookie.split(';')[0] } })).status).toBe(204)
  expect((await app.request('/api/session')).status).toBe(401)
})

it('sync without a session is 401', async () => {
  expect((await make().request('/api/sync', json({ cursor: 0, changes: [] }))).status).toBe(401)
})

it('sync round-trip: pushed changes come back through the cursor', async () => {
  const app = make()
  const cookie = await loginCookie(app)
  const change: EntityChange = { kind: 'note', row: newNote('b1', { x: 0, y: 0 }, 'pink', 5) }
  const first = (await (await app.request('/api/sync', json({ cursor: 0, changes: [change] }, { Cookie: cookie }))).json()) as SyncResponse
  expect(first.changes).toEqual([change])
  const again = (await (await app.request('/api/sync', json({ cursor: first.cursor, changes: [] }, { Cookie: cookie }))).json()) as SyncResponse
  expect(again).toEqual({ cursor: first.cursor, changes: [] })
})

it('non-JSON POST is refused with 415', async () => {
  const res = await make().request('/api/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"pin":"2468"}' })
  expect(res.status).toBe(415)
})

it('invalid changes are refused with 400', async () => {
  const app = make()
  const cookie = await loginCookie(app)
  for (const body of [{ cursor: 'x', changes: [] }, { cursor: 0, changes: [{ kind: 'shape' }] }, { cursor: 0 }])
    expect((await app.request('/api/sync', json(body, { Cookie: cookie }))).status).toBe(400)
})

it('test reset is 404 unless E2E_RESET=1', async () => {
  expect((await make().request('/api/test/reset', json({}))).status).toBe(404)
  expect((await make({ E2E_RESET: '1' }).request('/api/test/reset', json({}))).status).toBe(204)
})

it('X-Forwarded-For is ignored unless TRUST_PROXY=1', async () => {
  const app = make()
  await app.request('/api/login', json({ pin: '0000' }, { 'X-Forwarded-For': '1.1.1.1' }))
  const res = await app.request('/api/login', json({ pin: '2468' }, { 'X-Forwarded-For': '2.2.2.2' }))
  expect(await res.json()).toMatchObject({ ok: false, reason: 'cooldown' })
  const trusting = make({ TRUST_PROXY: '1' })
  await trusting.request('/api/login', json({ pin: '0000' }, { 'X-Forwarded-For': '1.1.1.1' }))
  expect(await (await trusting.request('/api/login', json({ pin: '2468' }, { 'X-Forwarded-For': '2.2.2.2' }))).json()).toEqual({ ok: true })
})
