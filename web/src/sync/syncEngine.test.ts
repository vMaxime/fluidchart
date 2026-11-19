import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import type { EntityChange, Note, SyncRequest, SyncResponse } from '@chart/shared'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { syncOnce } from './syncEngine'
import { getSyncState } from './syncStatus'

const ok = (body: Omit<SyncResponse, 'serverId'> & { serverId?: string }) =>
  new Response(JSON.stringify({ serverId: 'S1', ...body }), { status: 200, headers: { 'Content-Type': 'application/json' } })

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1000)
})
afterEach(() => vi.useRealTimers())

it('pushes dirty rows and clears dirty after a successful sync', async () => {
  const b = await repo.createBoard('Cardio')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const sent: SyncRequest[] = []
  const outcome = await syncOnce(async (body) => {
    sent.push(body)
    return ok({ cursor: 2, changes: body.changes })
  })
  expect(outcome).toBe('ok')
  expect(sent[0].cursor).toBe(0)
  expect(sent[0].changes.map((c) => c.row.id).sort()).toEqual([b.id, n.id].sort())
  expect((await db.notes.get(n.id))!.dirty).toBe(0)
  expect((await db.boards.get(b.id))!.dirty).toBe(0)
  expect(getSyncState()).toBe('synced')
})

it('a write made while the sync is in flight stays dirty (compare-and-clear)', async () => {
  const b = await repo.createBoard('Cardio')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const outcome = await syncOnce(async (body) => {
    vi.setSystemTime(2000)
    await repo.updateNote(n.id, { html: '<p>tapé pendant la synchro</p>' })
    return ok({ cursor: 2, changes: body.changes })
  })
  expect(outcome).toBe('ok')
  expect(await db.notes.get(n.id)).toMatchObject({ html: '<p>tapé pendant la synchro</p>', dirty: 1, updatedAt: 2000 })
  expect(getSyncState()).toBe('pending')
})

it('pulled rows apply only when newer, per element', async () => {
  const b = await repo.createBoard('Cardio')
  const a = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  const keep = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  vi.setSystemTime(5000)
  await repo.updateNote(keep.id, { html: '<p>local récent</p>' })
  const remote = (n: Note, html: string, updatedAt: number): EntityChange => ({
    kind: 'note',
    row: { ...n, html, updatedAt },
  })
  await syncOnce(async () =>
    ok({ cursor: 9, changes: [remote(a, '<p>distant récent</p>', 3000), remote(keep, '<p>distant ancien</p>', 4000)] }),
  )
  expect(await db.notes.get(a.id)).toMatchObject({ html: '<p>distant récent</p>', dirty: 0 })
  expect(await db.notes.get(keep.id)).toMatchObject({ html: '<p>local récent</p>' })
})

it('the cursor is saved and sent next time', async () => {
  await syncOnce(async () => ok({ cursor: 42, changes: [] }))
  let seen = -1
  await syncOnce(async (body) => {
    seen = body.cursor
    return ok({ cursor: 42, changes: [] })
  })
  expect(seen).toBe(42)
})

it('network failure → offline, 401 → unauthorized, 500 → error; nothing local changes', async () => {
  const b = await repo.createBoard('Cardio')
  expect(await syncOnce(async () => Promise.reject(new TypeError('Failed to fetch')))).toBe('offline')
  expect(getSyncState()).toBe('offline')
  expect(await syncOnce(async () => new Response(null, { status: 401 }))).toBe('unauthorized')
  expect(getSyncState()).toBe('locked')
  expect(await syncOnce(async () => new Response(null, { status: 500 }))).toBe('error')
  expect(getSyncState()).toBe('error')
  expect((await db.boards.get(b.id))!.dirty).toBe(1)
})

it('background sync turns an unexpected failure into the error state (no unhandled rejection) and stops cleanly', async () => {
  vi.useRealTimers()
  const { startSync } = await import('./syncEngine')
  const { setSyncState } = await import('./syncStatus')
  setSyncState('synced')
  const stop = startSync(async () => new Response('not json', { status: 200 }))
  await vi.waitFor(() => expect(getSyncState()).toBe('error'))
  stop()
})

it('a pushed row the server refused takes the server version instead of passing as sent', async () => {
  const b = await repo.createBoard('Cardio')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await syncOnce(async (body) => ok({ cursor: 2, changes: body.changes }))
  vi.setSystemTime(7000)
  await repo.updateNote(n.id, { html: '<p>Mac</p>' })
  const local = (await db.notes.get(n.id))!
  const serverWinner: EntityChange = { kind: 'note', row: { ...(local as Note), html: '<p>autre appareil</p>' } } // same updatedAt, other content
  await syncOnce(async () => ok({ cursor: 3, changes: [serverWinner] }))
  expect(await db.notes.get(n.id)).toMatchObject({ html: '<p>autre appareil</p>', dirty: 0 })
})

it('a new server id resends everything from scratch', async () => {
  const b = await repo.createBoard('Cardio')
  await syncOnce(async (body) => ok({ cursor: 7, changes: body.changes, serverId: 'OLD' }))
  expect((await db.boards.get(b.id))!.dirty).toBe(0)
  const sent: SyncRequest[] = []
  const outcome = await syncOnce(async (body) => {
    sent.push(body)
    return ok({ cursor: sent.length, changes: [], serverId: 'NEW' })
  })
  expect(outcome).toBe('ok')
  expect(sent.map((r) => r.cursor)).toEqual([7, 0])
  expect(sent[1].changes.map((c) => c.row.id)).toEqual([b.id])
  expect((await db.boards.get(b.id))!.dirty).toBe(0)
})

it('an edit during an in-flight background sync triggers another sync within about a second', async () => {
  vi.useRealTimers()
  const { startSync } = await import('./syncEngine')
  const b = await repo.createBoard('Cardio')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  let calls = 0
  let release!: () => void
  const stop = startSync(async (body) => {
    calls++
    if (calls === 1) {
      await repo.updateNote(n.id, { html: '<p>pendant</p>' }) // the row is already dirty: the hook must still notice
      await new Promise<void>((r) => (release = r))
    }
    return ok({ cursor: calls, changes: body.changes })
  })
  await vi.waitFor(() => expect(calls).toBe(1))
  release()
  await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(2), { timeout: 2500 })
  await vi.waitFor(async () => expect((await db.notes.get(n.id))!.dirty).toBe(0))
  stop()
})
