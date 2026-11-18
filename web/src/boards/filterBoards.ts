import type { BoardSummary } from '../db/repo'

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Accent- and case-insensitive name filter; keeps the input order. */
export function filterBoards(boards: BoardSummary[], query: string): BoardSummary[] {
  const q = fold(query.trim())
  if (!q) return boards
  return boards.filter((b) => fold(b.name).includes(q))
}
