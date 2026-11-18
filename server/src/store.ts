import type { DatabaseSync } from 'node:sqlite'
import type { EntityChange, SyncResponse } from '@chart/shared'
import { transaction } from './db'

/**
 * Last-write-wins per element: an incoming row replaces the stored one only if its updatedAt is
 * strictly newer. Every accepted write takes the next sequence number, which clients use as a cursor.
 */
export function applyChanges(db: DatabaseSync, changes: EntityChange[]): void {
  transaction(db, () => {
    const current = db.prepare('SELECT updated_at FROM entities WHERE kind = ? AND id = ?')
    const bump = db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'seq' RETURNING value")
    const upsert = db.prepare(`
      INSERT INTO entities (kind, id, board_id, data, updated_at, deleted, seq) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (kind, id) DO UPDATE SET
        board_id = excluded.board_id, data = excluded.data, updated_at = excluded.updated_at,
        deleted = excluded.deleted, seq = excluded.seq`)
    for (const c of changes) {
      const existing = current.get(c.kind, c.row.id) as { updated_at: number } | undefined
      if (existing && c.row.updatedAt <= existing.updated_at) continue
      const { value: seq } = bump.get() as { value: number }
      const boardId = c.kind === 'board' ? null : c.row.boardId
      upsert.run(c.kind, c.row.id, boardId, JSON.stringify(c.row), c.row.updatedAt, c.row.deleted ? 1 : 0, seq)
    }
  })
}

/** Everything written after `cursor`, in write order, with the new cursor. */
export function changesSince(db: DatabaseSync, cursor: number): SyncResponse {
  const rows = db.prepare('SELECT kind, data, seq FROM entities WHERE seq > ? ORDER BY seq').all(cursor) as {
    kind: EntityChange['kind']
    data: string
    seq: number
  }[]
  return {
    cursor: rows.length ? rows[rows.length - 1].seq : cursor,
    changes: rows.map((r) => ({ kind: r.kind, row: JSON.parse(r.data) }) as EntityChange),
  }
}
