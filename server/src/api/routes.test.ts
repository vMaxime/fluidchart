import { beforeEach, it, expect } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { API_EXAMPLE_BOARD, newArrow, newBoard, newNote, type EntityChange, type SyncResponse } from '@chart/shared'
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
const post = (app: ReturnType<typeof make>, body: unknown) =>
  app.request('/api/v1/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
type Detail = {
  id: string
  name: string
  updatedAt: number
  url: string
  notes: { id: string; html: string; color: string; x: number; y: number; width: number }[]
  arrows: { from: string; to: string }[]
}
const read = async (app: ReturnType<typeof make>, id: string) =>
  (await (await app.request(`/api/v1/boards/${id}`, bearer())).json()) as Detail

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

it('POST creates the board with cleaned html, default colour and width, and returns it', async () => {
  const app = make()
  const res = await post(app, {
    name: '  Cardio ',
    notes: [
      { id: 'coeur', html: '<p><b>Cœur</b><script>alert(1)</script></p>' },
      { id: 'aorte', html: 'Aorte & artères', color: 'pink', width: 260 },
    ],
  })
  expect(res.status).toBe(201)
  const body = (await res.json()) as Detail
  expect(body.name).toBe('Cardio')
  expect(body.url).toBe(`http://localhost/b/${body.id}`)
  const coeur = body.notes.find((n) => n.html === '<p><strong>Cœur</strong></p>')!
  expect(coeur).toMatchObject({ color: 'yellow', width: 200 })
  expect(body.notes.find((n) => n.html === '<p>Aorte &amp; artères</p>')).toMatchObject({ color: 'pink', width: 260 })
  expect(body.arrows).toEqual([])
  expect(await read(app, body.id)).toEqual(body)
})

it('without positions the notes are laid out top-down along the arrows', async () => {
  const body = (await (
    await post(make(), {
      name: 'Glycémie',
      notes: [
        { id: 'enfant', html: 'Insuline' },
        { id: 'parent', html: 'Hyperglycémie' },
      ],
      arrows: [{ from: 'parent', to: 'enfant' }],
    })
  ).json()) as Detail
  const parent = body.notes.find((n) => n.html === '<p>Hyperglycémie</p>')!
  const enfant = body.notes.find((n) => n.html === '<p>Insuline</p>')!
  expect(parent.y + 64).toBeLessThan(enfant.y)
  expect(body.arrows).toEqual([{ from: parent.id, to: enfant.id }])
})

it('given positions are kept as is', async () => {
  const body = (await (
    await post(make(), {
      name: 'Placée',
      notes: [
        { id: 'a', html: 'A', x: -120.5, y: 40, width: 180 },
        { id: 'b', html: 'B', x: 300, y: -80 },
      ],
    })
  ).json()) as Detail
  expect(body.notes.map(({ x, y, width }) => ({ x, y, width }))).toEqual([
    { x: 300, y: -80, width: 200 },
    { x: -120.5, y: 40, width: 180 },
  ])
})

it('invalid boards answer 400 with the path of each problem and write nothing', async () => {
  const app = make()
  const notes = [
    { id: 'a', html: 'A' },
    { id: 'b', html: 'B' },
  ]
  const cases: [unknown, string][] = [
    [{ name: 'X', notes, arrows: [{ from: 'a', to: 'z' }] }, 'arrows.0.to'],
    [{ name: 'X', notes, arrows: [{ from: 'a', to: 'a' }] }, 'arrows.0'],
    [{ name: 'X', notes: [notes[0], { id: 'a', html: 'B' }] }, 'notes.1.id'],
    [{ name: 'X', notes: [{ ...notes[0], x: 0, y: 0 }, notes[1]] }, 'notes.1'],
    [{ name: 'X', notes: [{ ...notes[0], color: 'red' }, notes[1]] }, 'notes.0.color'],
    [{ name: 'X', notes: [{ ...notes[0], x: 10 }, notes[1]] }, 'notes.0'],
    [
      {
        name: 'X',
        notes: [
          { ...notes[0], x: 10 },
          { ...notes[1], x: 500 },
        ],
      },
      'notes.0',
    ],
    [{ name: 'X', notes: Array.from({ length: 1001 }, (_, i) => ({ id: `n${i}`, html: 'x' })) }, 'notes'],
  ]
  for (const [body, path] of cases) {
    const res = await post(app, body)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string; issues: { path: string; message: string }[] }
    expect(json.error).toBe('invalid board')
    expect(json.issues.map((i) => i.path)).toContain(path)
    for (const issue of json.issues) expect(issue.message).toMatch(/\w/)
  }
  const broken = await post(app, '{"name": "X", notes')
  expect(broken.status).toBe(400)
  expect(await broken.json()).toEqual({ error: 'invalid json' })
  expect(await (await app.request('/api/v1/boards', bearer())).json()).toEqual([])
})

it('a board created through the API reaches a device through /api/sync', async () => {
  const app = make()
  const created = (await (await post(app, API_EXAMPLE_BOARD)).json()) as Detail
  const login = await app.request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '2468' }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const sync = (await (
    await app.request('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ cursor: 0, changes: [] }),
    })
  ).json()) as SyncResponse
  const boards = sync.changes.filter((c) => c.kind === 'board').map((c) => c.row)
  expect(boards).toEqual([
    {
      id: created.id,
      name: API_EXAMPLE_BOARD.name,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      deleted: false,
    },
  ])
  const notes = sync.changes.filter((c) => c.kind === 'note').map((c) => c.row)
  expect(notes).toHaveLength(API_EXAMPLE_BOARD.notes.length)
  for (const n of notes) {
    expect(Object.keys(n).sort()).toEqual(['boardId', 'color', 'deleted', 'html', 'id', 'updatedAt', 'width', 'x', 'y'])
    expect(n).toMatchObject({ boardId: created.id, deleted: false })
  }
  const noteIds = new Set(notes.map((n) => n.id))
  const arrows = sync.changes.filter((c) => c.kind === 'arrow').map((c) => c.row)
  expect(arrows).toHaveLength(API_EXAMPLE_BOARD.arrows.length)
  for (const a of arrows) {
    expect(Object.keys(a).sort()).toEqual(['boardId', 'deleted', 'from', 'id', 'to', 'updatedAt'])
    expect(a).toMatchObject({ boardId: created.id, deleted: false })
    expect(noteIds.has(a.from) && noteIds.has(a.to)).toBe(true)
  }
  const empty = (await (await post(app, { name: '', notes: [{ id: 'v', html: '' }] })).json()) as Detail
  expect(empty.name).toBe('Sans titre')
  expect(empty.notes[0].html).toBe('<p></p>')
})

it('reading a board and posting it back recreates the same board', async () => {
  const app = make()
  const first = await read(app, ((await (await post(app, API_EXAMPLE_BOARD)).json()) as Detail).id)
  const again = await post(app, first)
  expect(again.status).toBe(201)
  const second = await read(app, ((await again.json()) as Detail).id)
  const shape = (d: Detail) => ({
    name: d.name,
    notes: d.notes.map(({ id: _id, ...n }) => n),
    arrows: d.arrows.map((a) => [d.notes.findIndex((n) => n.id === a.from), d.notes.findIndex((n) => n.id === a.to)]),
  })
  expect(shape(second)).toEqual(shape(first))
  expect(second.id).not.toBe(first.id)
  expect(second.notes.some((n) => first.notes.some((m) => m.id === n.id))).toBe(false)
})

it('GET of an unknown or deleted board answers 404', async () => {
  const app = make()
  expect((await app.request('/api/v1/boards/nope', bearer())).status).toBe(404)
  const created = (await (await post(app, { name: 'Éphémère', notes: [] })).json()) as Detail
  applyChanges(db, [
    {
      kind: 'board',
      row: { ...newBoard('Éphémère', 1), id: created.id, updatedAt: created.updatedAt + 1, deleted: true },
    },
  ])
  const res = await app.request(`/api/v1/boards/${created.id}`, bearer())
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ error: 'not found' })
})

it('duplicate arrows are stored once', async () => {
  const body = (await (
    await post(make(), {
      name: 'Doublons',
      notes: [
        { id: 'a', html: 'A' },
        { id: 'b', html: 'B' },
      ],
      arrows: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'b' },
      ],
    })
  ).json()) as Detail
  expect(body.arrows).toHaveLength(1)
})

// Last in this file: before the fix, these ids polluted Object.prototype for the whole process.
it('note ids such as __proto__ or constructor are mere labels', async () => {
  const res = await post(make(), {
    name: 'Proto',
    notes: ['__proto__', 'b', 'constructor', 'toString'].map((id) => ({ id, html: id })),
    arrows: [
      { from: '__proto__', to: 'b' },
      { from: 'constructor', to: 'toString' },
    ],
  })
  expect(res.status).toBe(201)
  const body = (await res.json()) as Detail
  for (const n of body.notes) expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true)
  expect(body.arrows).toHaveLength(2)
  expect(({} as Record<string, unknown>).b).toBeUndefined()
})
