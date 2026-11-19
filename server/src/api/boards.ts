import type { DatabaseSync } from 'node:sqlite'

export type BoardSummary = { id: string; name: string; updatedAt: number; noteCount: number }

/**
 * Live boards, most recently edited first. A board's last edit is its own or that of any of its
 * notes and arrows (as in the web app's board list).
 */
export function listBoards(db: DatabaseSync): BoardSummary[] {
  const rows = db
    .prepare(
      `SELECT b.id, b.data,
         MAX(b.updated_at, COALESCE((SELECT MAX(e.updated_at) FROM entities e WHERE e.board_id = b.id), 0)) AS last_edit,
         (SELECT COUNT(*) FROM entities n WHERE n.kind = 'note' AND n.board_id = b.id AND n.deleted = 0) AS note_count
       FROM entities b
       WHERE b.kind = 'board' AND b.deleted = 0
       ORDER BY last_edit DESC`,
    )
    .all() as { id: string; data: string; last_edit: number; note_count: number }[]
  return rows.map((r) => ({
    id: r.id,
    name: (JSON.parse(r.data) as { name: string }).name,
    updatedAt: r.last_edit,
    noteCount: r.note_count,
  }))
}
