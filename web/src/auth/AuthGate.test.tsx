import { afterEach, beforeEach, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { setSyncState } from '../sync/syncStatus'
import { AuthGate } from './AuthGate'

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>
let handler: Handler
const calls: { url: string; body?: unknown }[] = []
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  calls.length = 0
  setSyncState('synced')
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined })
    return handler(url, init)
  })
})
afterEach(() => vi.unstubAllGlobals())

const app = () =>
  render(
    <AuthGate>
      <p>Mes cartes</p>
    </AuthGate>,
  )
const typePin = (pin: string) => {
  for (const d of pin) fireEvent.click(screen.getByRole('button', { name: d }))
}

it('valid session shows the app', async () => {
  handler = (url) => (url === '/api/session' ? reply(204) : reply(200, { cursor: 0, changes: [] }))
  app()
  expect(await screen.findByText('Mes cartes')).toBeInTheDocument()
})

it('no session shows the PIN screen; a right code shows the app and remembers the device', async () => {
  handler = (url) =>
    url === '/api/session'
      ? reply(401)
      : url === '/api/login'
        ? reply(200, { ok: true })
        : reply(200, { cursor: 0, changes: [] })
  app()
  expect(await screen.findByRole('heading', { name: 'Entrez votre code' })).toBeInTheDocument()
  typePin('2468')
  expect(await screen.findByText('Mes cartes')).toBeInTheDocument()
  expect(calls.find((c) => c.url === '/api/login')?.body).toEqual({ pin: '2468' })
  expect(localStorage.getItem('chart.unlocked')).toBe('1')
})

it('offline on a remembered device shows the app', async () => {
  localStorage.setItem('chart.unlocked', '1')
  handler = () => Promise.reject(new TypeError('Failed to fetch'))
  app()
  expect(await screen.findByText('Mes cartes')).toBeInTheDocument()
})

it('offline on a new device shows the PIN screen', async () => {
  handler = () => Promise.reject(new TypeError('Failed to fetch'))
  app()
  expect(await screen.findByRole('heading', { name: 'Entrez votre code' })).toBeInTheDocument()
})

it('a 401 during sync brings the PIN screen back; local edits survive and are pushed after unlocking', async () => {
  const board = await repo.createBoard('Cardio')
  let syncs = 0
  handler = (url, init) => {
    if (url === '/api/session') return reply(204)
    if (url === '/api/login') return reply(200, { ok: true })
    syncs++
    if (syncs === 1) return reply(401)
    return reply(200, { cursor: 1, changes: JSON.parse(init!.body as string).changes })
  }
  app()
  expect(await screen.findByRole('heading', { name: 'Entrez votre code' })).toBeInTheDocument()
  expect((await db.boards.get(board.id))!.dirty).toBe(1)
  await act(async () => typePin('2468'))
  expect(await screen.findByText('Mes cartes')).toBeInTheDocument()
  await waitFor(async () => expect((await db.boards.get(board.id))!.dirty).toBe(0))
  const pushed = calls.filter((c) => c.url === '/api/sync').at(-1)!.body as { changes: { row: { id: string } }[] }
  expect(pushed.changes.map((c) => c.row.id)).toContain(board.id)
})

it('a remembered device opens at once, even when the server hangs', async () => {
  localStorage.setItem('chart.unlocked', '1')
  handler = () => new Promise<Response>(() => {})
  app()
  expect(screen.getByText('Mes cartes')).toBeInTheDocument()
})

it('a remembered device opens on its local data when the server answers 502', async () => {
  localStorage.setItem('chart.unlocked', '1')
  handler = () => reply(502)
  app()
  expect(await screen.findByText('Mes cartes')).toBeInTheDocument()
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('heading', { name: 'Entrez votre code' })).toBeNull()
})

it('a remembered device whose session expired is asked for the PIN', async () => {
  localStorage.setItem('chart.unlocked', '1')
  handler = (url) => (url === '/api/session' ? reply(401) : reply(401))
  app()
  expect(await screen.findByRole('heading', { name: 'Entrez votre code' })).toBeInTheDocument()
})
