import {
  NOTE_COLOR_ORDER,
  newArrow,
  newBoard,
  newNote,
  normalizeBoardName,
  type Arrow,
  type Board,
  type Id,
  type Note,
  type NoteColor,
} from '@chart/shared'
import { extractTextColors } from '../canvas/textColors'
import { db, type Local } from './db'

// Sync contract: every write goes through this module, sets updatedAt = Date.now()
// and dirty = 1 on each touched row, and never hard-deletes (deleted = true).

export type BoardSummary = Board & {
  lastEditedAt: number
  /** Live notes on the board. */
  noteCount: number
  /** Up to three colours, most used first (ties in palette order). */
  colors: NoteColor[]
}

function strip<T>(row: Local<T>): T {
  const { dirty: _dirty, ...rest } = row
  return rest as T
}

/**
 * The updatedAt for a write: now, but always after every version it replaces. Last-write-wins needs
 * each edit to look newer than what it overwrites, even when this device's clock is behind the
 * device that wrote the previous version.
 */
const nextTime = (...previous: number[]) => Math.max(Date.now(), ...previous.map((t) => t + 1))

export async function listBoards(): Promise<BoardSummary[]> {
  const [boards, notes, arrows] = await Promise.all([db.boards.toArray(), db.notes.toArray(), db.arrows.toArray()])
  const lastEdit = new Map<Id, number>()
  for (const row of [...notes, ...arrows]) {
    lastEdit.set(row.boardId, Math.max(lastEdit.get(row.boardId) ?? 0, row.updatedAt))
  }
  const colorCounts = new Map<Id, Map<NoteColor, number>>()
  for (const n of notes) {
    if (n.deleted) continue
    const counts = colorCounts.get(n.boardId) ?? new Map<NoteColor, number>()
    counts.set(n.color, (counts.get(n.color) ?? 0) + 1)
    colorCounts.set(n.boardId, counts)
  }
  const summarize = (id: Id) => {
    const counts = colorCounts.get(id) ?? new Map<NoteColor, number>()
    const colors = [...counts.keys()]
      .sort((a, b) => counts.get(b)! - counts.get(a)! || NOTE_COLOR_ORDER.indexOf(a) - NOTE_COLOR_ORDER.indexOf(b))
      .slice(0, 3)
    return { noteCount: [...counts.values()].reduce((sum, c) => sum + c, 0), colors }
  }
  return boards
    .filter((b) => !b.deleted)
    .map((b) => ({ ...strip(b), lastEditedAt: Math.max(b.updatedAt, lastEdit.get(b.id) ?? 0), ...summarize(b.id) }))
    .sort((a, b) => b.lastEditedAt - a.lastEditedAt)
}

export async function getBoard(id: Id): Promise<Board | undefined> {
  const row = await db.boards.get(id)
  return row && strip(row)
}

export async function createBoard(name: string): Promise<Board> {
  const board = newBoard(name, Date.now())
  await db.boards.add({ ...board, dirty: 1 })
  return board
}

export async function renameBoard(id: Id, name: string): Promise<void> {
  const next = normalizeBoardName(name)
  await db.transaction('rw', db.boards, async () => {
    const row = await db.boards.get(id)
    // An unchanged name must not bump updatedAt: under last-write-wins it would undo a real rename elsewhere.
    if (!row || row.name === next) return
    await db.boards.update(id, { name: next, updatedAt: nextTime(row.updatedAt), dirty: 1 })
  })
}

export async function deleteBoard(id: Id): Promise<void> {
  await db.transaction('rw', db.boards, db.notes, db.arrows, async () => {
    const board = await db.boards.get(id)
    if (!board) return
    const notes = db.notes
      .where('boardId')
      .equals(id)
      .filter((n) => !n.deleted)
    const arrows = db.arrows
      .where('boardId')
      .equals(id)
      .filter((a) => !a.deleted)
    // One timestamp for the whole deletion, so restoreBoard can find what went with it.
    const at = nextTime(
      board.updatedAt,
      ...(await notes.toArray()).map((n) => n.updatedAt),
      ...(await arrows.toArray()).map((a) => a.updatedAt),
    )
    const tomb = { deleted: true, updatedAt: at, dirty: 1 as const }
    await db.boards.update(id, tomb)
    await notes.modify(tomb)
    await arrows.modify(tomb)
  })
}

/** Undo for deleteBoard: un-tombstones the board and the notes/arrows deleted in that same operation. */
export async function restoreBoard(id: Id): Promise<void> {
  await db.transaction('rw', db.boards, db.notes, db.arrows, async () => {
    const board = await db.boards.get(id)
    if (!board?.deleted) return
    const deletedAt = board.updatedAt
    const notes = db.notes
      .where('boardId')
      .equals(id)
      .filter((n) => n.deleted && n.updatedAt === deletedAt)
    const arrows = db.arrows
      .where('boardId')
      .equals(id)
      .filter((a) => a.deleted && a.updatedAt === deletedAt)
    const alive = { deleted: false, updatedAt: nextTime(deletedAt), dirty: 1 as const }
    await db.boards.update(id, alive)
    await notes.modify(alive)
    await arrows.modify(alive)
  })
}

export async function listNotes(boardId: Id): Promise<Note[]> {
  const rows = await db.notes
    .where('boardId')
    .equals(boardId)
    .filter((n) => !n.deleted)
    .toArray()
  return rows.map(strip)
}

export async function listArrows(boardId: Id): Promise<Arrow[]> {
  const rows = await db.arrows
    .where('boardId')
    .equals(boardId)
    .filter((a) => !a.deleted)
    .toArray()
  return rows.map(strip)
}

export async function addNote(boardId: Id, pos: { x: number; y: number }, color: NoteColor): Promise<Note> {
  const note = newNote(boardId, pos, color, Date.now())
  await db.notes.add({ ...note, dirty: 1 })
  return note
}

export async function updateNote(
  id: Id,
  patch: Partial<Pick<Note, 'x' | 'y' | 'width' | 'height' | 'color' | 'html'>>,
): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    const row = await db.notes.get(id)
    if (row) await db.notes.update(id, { ...patch, updatedAt: nextTime(row.updatedAt), dirty: 1 })
  })
}

export async function deleteNotes(ids: Id[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.notes, db.arrows, async () => {
    const notes = db.notes
      .where('id')
      .anyOf(ids)
      .filter((n) => !n.deleted)
    const from = db.arrows
      .where('from')
      .anyOf(ids)
      .filter((a) => !a.deleted)
    const to = db.arrows
      .where('to')
      .anyOf(ids)
      .filter((a) => !a.deleted)
    const rows = [...(await notes.toArray()), ...(await from.toArray()), ...(await to.toArray())]
    const tomb = { deleted: true, updatedAt: nextTime(...rows.map((r) => r.updatedAt)), dirty: 1 as const }
    await notes.modify(tomb)
    await from.modify(tomb)
    await to.modify(tomb)
  })
}

export async function addArrow(boardId: Id, from: Id, to: Id): Promise<Arrow | null> {
  if (from === to) return null
  return db.transaction('rw', db.arrows, async () => {
    const duplicate = await db.arrows
      .where('from')
      .equals(from)
      .filter((a) => a.to === to && !a.deleted)
      .first()
    if (duplicate) return null
    const arrow = newArrow(boardId, from, to, Date.now())
    await db.arrows.add({ ...arrow, dirty: 1 })
    return arrow
  })
}

export async function updateArrow(id: Id, patch: Partial<Pick<Arrow, 'color'>>): Promise<void> {
  await db.transaction('rw', db.arrows, async () => {
    const row = await db.arrows.get(id)
    if (row) await db.arrows.update(id, { ...patch, updatedAt: nextTime(row.updatedAt), dirty: 1 })
  })
}

export async function deleteArrows(ids: Id[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.arrows, async () => {
    const arrows = db.arrows
      .where('id')
      .anyOf(ids)
      .filter((a) => !a.deleted)
    const at = nextTime(...(await arrows.toArray()).map((a) => a.updatedAt))
    await arrows.modify({ deleted: true, updatedAt: at, dirty: 1 })
  })
}

/** Text colours already used on live notes with this background, across every board (max 12). */
export async function usedTextColors(noteColor: NoteColor): Promise<string[]> {
  const notes = await db.notes.filter((n) => !n.deleted && n.color === noteColor).toArray()
  const colors = new Set<string>()
  for (const n of notes) for (const c of extractTextColors(n.html)) colors.add(c)
  return [...colors].slice(0, 12)
}

export type TableName = 'boards' | 'notes' | 'arrows'
export type Fields = Record<string, unknown>
export type FieldChange = { table: TableName; id: Id; from: Fields; to: Fields }

/**
 * Undo / redo writes. For each field, `to[k]` is written only where the row still holds `from[k]`:
 * a field someone changed since (another device, a write outside the history) is left alone.
 * Written rows get a fresh updatedAt and dirty = 1, so they sync like any edit.
 */
export async function applyFieldChanges(changes: FieldChange[]): Promise<void> {
  await db.transaction('rw', db.boards, db.notes, db.arrows, async () => {
    for (const c of changes) {
      const table = db[c.table] as unknown as typeof db.notes
      const current = (await table.get(c.id)) as unknown as Fields | undefined
      if (!current) continue
      const patch: Fields = {}
      for (const [k, v] of Object.entries(c.to)) if (current[k] === c.from[k] && current[k] !== v) patch[k] = v
      if (Object.keys(patch).length)
        await table.update(c.id, { ...patch, updatedAt: nextTime(current.updatedAt as number), dirty: 1 })
    }
  })
}
