import type { Arrow, Board, Note } from './model'

export type EntityKind = 'board' | 'note' | 'arrow'
export type EntityChange = { kind: 'board'; row: Board } | { kind: 'note'; row: Note } | { kind: 'arrow'; row: Arrow }
export type SyncRequest = { cursor: number; changes: EntityChange[] }
export type SyncResponse = { cursor: number; changes: EntityChange[] }

const KINDS = new Set<string>(['board', 'note', 'arrow'])

/** Minimal structural check of a change coming over the wire. */
export function isEntityChange(x: unknown): x is EntityChange {
  if (typeof x !== 'object' || x === null) return false
  const { kind, row } = x as { kind?: unknown; row?: unknown }
  if (typeof kind !== 'string' || !KINDS.has(kind) || typeof row !== 'object' || row === null) return false
  const r = row as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) && typeof r.deleted === 'boolean'
}
