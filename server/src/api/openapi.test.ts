import { beforeEach, it, expect } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { API_EXAMPLE_BOARD, ARROW_COLOR_ORDER, NOTE_COLOR_ORDER } from '@chart/shared'
import { openDb } from '../db'
import { createAuth } from '../auth'
import { createApp } from '../app'
import { readConfig } from '../config'
import { BoardInputSchema } from './schema'

const TOKEN = 'test-token-0123456789abcdef0123456789'
let db: DatabaseSync
const make = (env: Record<string, string> = { API_TOKEN: TOKEN }) => {
  const config = readConfig({ APP_PIN: '2468', STATIC_DIR: '/nonexistent', ...env })
  return createApp({ db, auth: createAuth(db, { pin: config.pin }), config })
}
const docOf = async (app: ReturnType<typeof make>, headers: Record<string, string> = {}): Promise<any> =>
  (await app.request('/api/v1/openapi.json', { headers })).json()

beforeEach(() => {
  db = openDb(':memory:')
})

it('openapi.json is public and describes the four routes with bearer auth', async () => {
  const app = make({ API_TOKEN: TOKEN, TRUST_PROXY: '1' })
  const res = await app.request('/api/v1/openapi.json', {
    headers: { Host: 'fluidchart.example', 'X-Forwarded-Proto': 'https' },
  })
  expect(res.status).toBe(200)
  const doc: any = await res.json()
  expect(doc.openapi).toBe('3.1.0')
  expect(doc.servers[0].url).toBe('https://fluidchart.example')
  expect(Object.keys(doc.paths).sort()).toEqual(['/api/v1/boards', '/api/v1/boards/{id}', '/api/v1/openapi.json'])
  expect(Object.keys(doc.paths['/api/v1/boards']).sort()).toEqual(['get', 'post'])
  expect(doc.components.securitySchemes.bearer).toEqual({ type: 'http', scheme: 'bearer' })
  expect(doc.security).toEqual([{ bearer: [] }])
  expect(doc.paths['/api/v1/openapi.json'].get.security).toEqual([])
  // Served even while the API itself is disabled: it holds no secret.
  expect((await make({}).request('/api/v1/openapi.json')).status).toBe(200)
})

it('the documented example is a valid board and creates it', async () => {
  const app = make()
  const doc = await docOf(app)
  const example = doc.paths['/api/v1/boards'].post.requestBody.content['application/json'].example
  expect(example).toEqual(API_EXAMPLE_BOARD)
  expect(BoardInputSchema.safeParse(example).success).toBe(true)
  const res = await app.request('/api/v1/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(example),
  })
  expect(res.status).toBe(201)
  expect(((await res.json()) as { notes: unknown[] }).notes).toHaveLength(API_EXAMPLE_BOARD.notes.length)
})

it('the input schema lists the note colours and the limits', async () => {
  const schema = (await docOf(make())).components.schemas.BoardInput
  expect(schema.properties.notes.maxItems).toBe(1000)
  expect(schema.properties.notes.items.properties.color.enum).toEqual(NOTE_COLOR_ORDER)
  expect(schema.properties.notes.items.properties.html.maxLength).toBe(20000)
  expect(schema.properties.arrows.items.properties.color.enum).toEqual(ARROW_COLOR_ORDER)
  expect(schema.required).toEqual(['name', 'notes'])
})
