export type Id = string

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple'
export type ArrowColor = 'gray' | 'black' | 'red' | 'blue' | 'green' | 'purple' | 'orange'

/** Fields every synced entity carries. `updatedAt` drives last-write-wins. */
export interface Entity {
  id: Id
  updatedAt: number
  deleted: boolean
}

export interface Board extends Entity {
  name: string
  createdAt: number
}

export interface Note extends Entity {
  boardId: Id
  x: number
  y: number
  width: number
  /** Minimum height in px; absent = automatic (the height follows the text). */
  height?: number
  color: NoteColor
  html: string
}

export interface Arrow extends Entity {
  boardId: Id
  from: Id
  to: Id
  /** Absent on arrows never recoloured: gray. */
  color?: ArrowColor
}

export const DEFAULT_NOTE_WIDTH = 200
export const MIN_NOTE_WIDTH = 120
export const MAX_NOTE_WIDTH = 800
/** Smallest minimum height; a height at or under it means "automatic". */
export const MIN_NOTE_HEIGHT = 64
export const MAX_NOTE_HEIGHT = 5000
export const UNTITLED_BOARD = 'Sans titre'

export function normalizeBoardName(name: string): string {
  return name.trim() || UNTITLED_BOARD
}

export function newBoard(name: string, now: number): Board {
  return { id: crypto.randomUUID(), name: normalizeBoardName(name), createdAt: now, updatedAt: now, deleted: false }
}

export function newNote(boardId: Id, pos: { x: number; y: number }, color: NoteColor, now: number): Note {
  return {
    id: crypto.randomUUID(),
    boardId,
    x: pos.x,
    y: pos.y,
    width: DEFAULT_NOTE_WIDTH,
    color,
    html: '<p></p>',
    updatedAt: now,
    deleted: false,
  }
}

export function newArrow(boardId: Id, from: Id, to: Id, now: number): Arrow {
  return { id: crypto.randomUUID(), boardId, from, to, updatedAt: now, deleted: false }
}
