import { it, expect } from 'vitest'
import { filterBoards } from './filterBoards'
const s = (name: string) => ({ id: name, name, createdAt: 0, updatedAt: 0, deleted: false, lastEditedAt: 0 })

it('matches without accents or case', () => {
  const boards = [s('Hépatite B'), s('Cardio')]
  expect(filterBoards(boards, 'hepatite').map((b) => b.name)).toEqual(['Hépatite B'])
  expect(filterBoards(boards, 'CARDIO').map((b) => b.name)).toEqual(['Cardio'])
})
it('empty or blank query returns everything in the same order', () => {
  const boards = [s('B'), s('A')]
  expect(filterBoards(boards, '  ')).toEqual(boards)
})
