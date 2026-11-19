import { beforeEach, it, expect } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { newArrow, newBoard, newNote, type EntityChange } from '@chart/shared'
import { openDb } from '../db'
import { createAuth } from '../auth'
import { createApp } from '../app'
import { readConfig } from '../config'
import { applyChanges } from '../store'

const TOKEN = 'test-token-0123456789abcdef0123456789'
let db: DatabaseSync
const make = (env: Record<string, string> = { API_TOKEN: TOKEN }) => {
  const config = readConfig({ APP_PIN: '2468', STATIC_DIR: '/nonexistent', ...env })
  return createApp({ db, auth: createAuth(db, { pin: config.pin }), config })
}
const bearer = (token = TOKEN) => ({ headers: { Authorization: `Bearer ${token}` } })

beforeEach(() => {
  db = openDb(':memory:')
})

it('without API_TOKEN, the API answers 503 api disabled', async () => {
  const res = await make({}).request('/api/v1/boards', bearer())
  expect(res.status).toBe(503)
  expect(await res.json()).toEqual({ error: 'api disabled' })
})

it('a missing or wrong bearer token answers 401, even with a session cookie', async () => {
  const app = make()
  const login = await app.request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '2468' }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const wrong = TOKEN.slice(0, -1) + (TOKEN.endsWith('9') ? '8' : '9')
  for (const init of [{}, { headers: { Cookie: cookie } }, bearer(wrong), { headers: { Authorization: TOKEN } }]) {
    const res = await app.request('/api/v1/boards', init)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  }
})

it('the right token lists live boards, most recently edited first, with their note count', async () => {
  const a = { ...newBoard('Cardio', 10), id: 'a' }
  const b = { ...newBoard('Pneumo', 20), id: 'b' }
  const c = { ...newBoard('Supprimée', 30), id: 'c', deleted: true }
  const n1 = { ...newNote('a', { x: 0, y: 0 }, 'yellow', 40), id: 'n1' } // edits board a after b
  const n2 = { ...newNote('a', { x: 0, y: 0 }, 'yellow', 11), id: 'n2' }
  const n3 = { ...newNote('a', { x: 0, y: 0 }, 'yellow', 12), id: 'n3', deleted: true }
  const n4 = { ...newNote('b', { x: 0, y: 0 }, 'blue', 21), id: 'n4' }
  const arrow = { ...newArrow('b', 'n4', 'n4', 50), id: 'r1' } // edits board b last
  const changes: EntityChange[] = [
    { kind: 'board', row: a },
    { kind: 'board', row: b },
    { kind: 'board', row: c },
    ...[n1, n2, n3, n4].map((row) => ({ kind: 'note', row }) as EntityChange),
    { kind: 'arrow', row: arrow },
  ]
  applyChanges(db, changes)
  const res = await make().request('/api/v1/boards', bearer())
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([
    { id: 'b', name: 'Pneumo', updatedAt: 50, noteCount: 1 },
    { id: 'a', name: 'Cardio', updatedAt: 40, noteCount: 2 },
  ])
})
