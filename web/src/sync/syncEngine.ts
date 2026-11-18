import type { Arrow, Board, EntityChange, EntityKind, Note, SyncRequest, SyncResponse } from '@chart/shared'
import { db, type Local } from '../db/db'
import { getSyncState, setSyncState } from './syncStatus'

export type SyncOutcome = 'ok' | 'offline' | 'unauthorized' | 'error'
type Post = (body: SyncRequest) => Promise<Response>

const tables = { board: db.boards, note: db.notes, arrow: db.arrows } as const
const tableOf = (kind: EntityKind) => tables[kind] as unknown as typeof db.notes

const defaultPost: Post = (body) =>
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })

function strip<T>(row: Local<T>): T {
  const { dirty: _dirty, ...rest } = row
  return rest as T
}

async function dirtyChanges(): Promise<EntityChange[]> {
  const [boards, notes, arrows] = await Promise.all([
    db.boards.where('dirty').equals(1).toArray(),
    db.notes.where('dirty').equals(1).toArray(),
    db.arrows.where('dirty').equals(1).toArray(),
  ])
  return [
    ...boards.map((r) => ({ kind: 'board' as const, row: strip<Board>(r) })),
    ...notes.map((r) => ({ kind: 'note' as const, row: strip<Note>(r) })),
    ...arrows.map((r) => ({ kind: 'arrow' as const, row: strip<Arrow>(r) })),
  ]
}

const hasDirty = async () =>
  (await Promise.all([db.boards, db.notes, db.arrows].map((t) => t.where('dirty').equals(1).count()))).some(
    (n) => n > 0,
  )

/**
 * One round trip: push local dirty rows, pull everything after our cursor.
 * Pulled rows replace local ones only when strictly newer (last-write-wins per element);
 * a pushed row is marked clean only if it still has the updatedAt we sent (compare-and-clear),
 * so an edit made while the request was in flight is sent next time.
 */
export async function syncOnce(post: Post = defaultPost): Promise<SyncOutcome> {
  const cursor = (await db.meta.get('cursor'))?.value ?? 0
  const changes = await dirtyChanges()
  let res: Response
  try {
    res = await post({ cursor, changes })
  } catch {
    setSyncState('offline')
    return 'offline'
  }
  if (res.status === 401) {
    setSyncState('locked')
    return 'unauthorized'
  }
  if (!res.ok) {
    setSyncState('error')
    return 'error'
  }
  const body = (await res.json()) as SyncResponse
  await db.transaction('rw', db.boards, db.notes, db.arrows, db.meta, async () => {
    for (const c of body.changes) {
      const table = tableOf(c.kind)
      const local = await table.get(c.row.id)
      if (!local || c.row.updatedAt > local.updatedAt) await table.put({ ...(c.row as Note), dirty: 0 })
    }
    for (const c of changes) {
      const table = tableOf(c.kind)
      const local = await table.get(c.row.id)
      if (local?.dirty && local.updatedAt === c.row.updatedAt) await table.update(c.row.id, { dirty: 0 })
    }
    await db.meta.put({ key: 'cursor', value: body.cursor })
  })
  setSyncState((await hasDirty()) ? 'pending' : 'synced')
  return 'ok'
}

const PERIOD_MS = 30_000
const LOCAL_DEBOUNCE_MS = 1000

/**
 * Keeps the device in sync: at start, when the network or the tab comes back, every 30 s, and
 * one second after local edits (Dexie hooks on rows written with dirty = 1). Returns a stop function.
 */
export function startSync(post: Post = defaultPost): () => void {
  let running = false
  let again = false
  let debounce: ReturnType<typeof setTimeout> | undefined

  const run = async () => {
    if (running) {
      again = true
      return
    }
    running = true
    try {
      do {
        again = false
        await syncOnce(post)
      } while (again)
    } finally {
      running = false
    }
  }
  const soon = () => {
    if (getSyncState() !== 'locked') setSyncState('pending')
    clearTimeout(debounce)
    debounce = setTimeout(run, LOCAL_DEBOUNCE_MS)
  }
  const onCreating = (_key: unknown, obj: { dirty?: number }) => {
    if (obj.dirty === 1) soon()
  }
  const onUpdating = (mods: { dirty?: number }) => {
    if (mods.dirty === 1) soon()
  }
  const onVisible = () => document.visibilityState === 'visible' && void run()
  const onOnline = () => void run()
  const tablesList = [db.boards, db.notes, db.arrows]

  for (const t of tablesList) {
    t.hook('creating', onCreating)
    t.hook('updating', onUpdating)
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(run, PERIOD_MS)
  void run()

  return () => {
    for (const t of tablesList) {
      t.hook('creating').unsubscribe(onCreating)
      t.hook('updating').unsubscribe(onUpdating)
    }
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
    clearTimeout(debounce)
  }
}
