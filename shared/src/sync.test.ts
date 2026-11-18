import { it, expect } from 'vitest'
import { newNote } from './model'
import { isEntityChange } from './sync'

it('accepts a well-formed change', () => {
  expect(isEntityChange({ kind: 'note', row: newNote('b', { x: 0, y: 0 }, 'yellow', 1) })).toBe(true)
})

it('rejects junk', () => {
  for (const x of [null, 42, {}, { kind: 'shape', row: { id: 'a', updatedAt: 1, deleted: false } }, { kind: 'note', row: { id: 'a', updatedAt: '1', deleted: false } }, { kind: 'note', row: { id: 1, updatedAt: 1, deleted: false } }, { kind: 'board', row: { id: 'a', updatedAt: 1 } }])
    expect(isEntityChange(x)).toBe(false)
})
