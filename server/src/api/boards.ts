import type { DatabaseSync } from 'node:sqlite'
import {
  DEFAULT_ARROW_COLOR,
  MAX_NOTE_HEIGHT,
  newArrow,
  newBoard,
  newNote,
  type Arrow,
  type ArrowColor,
  type Board,
  type Note,
  type NoteColor,
} from '@chart/shared'
import { applyChanges } from '../store'
import { cleanNoteHtml } from './html'
import { estimateNoteHeight, layoutNotes } from './layout'
import type { BoardInput } from './schema'

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

export type BoardDetail = {
  id: string
  name: string
  updatedAt: number
  /** Opens the board in the web app. */
  url: string
  /** Sorted top to bottom, then left to right. */
  notes: { id: string; html: string; color: NoteColor; x: number; y: number; width: number; height?: number }[]
  arrows: { from: string; to: string; color: ArrowColor }[]
}

const live = (db: DatabaseSync, kind: 'note' | 'arrow', boardId: string) =>
  (
    db.prepare('SELECT data FROM entities WHERE kind = ? AND board_id = ? AND deleted = 0').all(kind, boardId) as {
      data: string
    }[]
  ).map((r) => JSON.parse(r.data))

/** A live board with its live notes and arrows, in the shape POST /boards accepts. */
export function readBoard(db: DatabaseSync, id: string, origin: string): BoardDetail | null {
  const row = db.prepare("SELECT data FROM entities WHERE kind = 'board' AND id = ? AND deleted = 0").get(id) as
    { data: string } | undefined
  if (!row) return null
  const board = JSON.parse(row.data) as Board
  const notes = (live(db, 'note', id) as Note[]).sort((a, b) => a.y - b.y || a.x - b.x)
  const order = new Map(notes.map((n, i) => [n.id, i]))
  const lastChild = db.prepare('SELECT MAX(updated_at) AS t FROM entities WHERE board_id = ?').get(id) as {
    t: number | null
  }
  return {
    id: board.id,
    name: board.name,
    updatedAt: Math.max(board.updatedAt, lastChild.t ?? 0),
    url: `${origin}/b/${board.id}`,
    notes: notes.map(({ id, html, color, x, y, width, height }) => ({
      id,
      html,
      color,
      x,
      y,
      width,
      // A client may have stored more than the API accepts: clamp, so a read board posts back.
      ...(height !== undefined && { height: Math.min(height, MAX_NOTE_HEIGHT) }),
    })),
    // An arrow whose note is gone would make this output an invalid POST body. Sorted by their
    // notes' order, so reading the same board always gives the same output.
    arrows: (live(db, 'arrow', id) as Arrow[])
      .filter((a) => order.has(a.from) && order.has(a.to))
      .sort((a, b) => order.get(a.from)! - order.get(b.from)! || order.get(a.to)! - order.get(b.to)!)
      .map(({ from, to, color }) => ({ from, to, color: color ?? DEFAULT_ARROW_COLOR })),
  }
}

/**
 * Writes a whole board (cleaned html, positions given or laid out) as ordinary synced rows: devices
 * receive it through the normal sync.
 */
export function createBoard(db: DatabaseSync, input: BoardInput, now: number, origin: string): BoardDetail {
  const board = newBoard(input.name, now)
  const ids = new Map(input.notes.map((n) => [n.id, crypto.randomUUID()]))
  const html = input.notes.map((n) => cleanNoteHtml(n.html))
  const seen = new Set<string>()
  const arrows = input.arrows.filter((a) => {
    const key = JSON.stringify([a.from, a.to])
    return !seen.has(key) && seen.add(key)
  })
  const placed = input.notes.every((n) => n.x !== undefined && n.y !== undefined)
  const at = placed
    ? null
    : layoutNotes(
        input.notes.map((n, i) => ({
          id: n.id,
          width: n.width,
          height: Math.max(estimateNoteHeight(html[i], n.width), n.height ?? 0),
        })),
        arrows,
      )
  const notes: Note[] = input.notes.map((n, i) => ({
    ...newNote(board.id, at?.get(n.id) ?? { x: n.x!, y: n.y! }, n.color, now),
    id: ids.get(n.id)!,
    width: n.width,
    ...(n.height !== undefined && { height: n.height }),
    html: html[i],
  }))
  const arrowRows: Arrow[] = arrows.map((a) => ({
    ...newArrow(board.id, ids.get(a.from)!, ids.get(a.to)!, now),
    ...(a.color && { color: a.color }),
  }))
  applyChanges(db, [
    { kind: 'board', row: board },
    ...notes.map((row) => ({ kind: 'note', row }) as const),
    ...arrowRows.map((row) => ({ kind: 'arrow', row }) as const),
  ])
  return readBoard(db, board.id, origin)!
}
