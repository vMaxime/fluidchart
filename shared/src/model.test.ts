import { describe, it, expect } from 'vitest'
import { newBoard, newNote, newArrow, normalizeBoardName, DEFAULT_NOTE_WIDTH, UNTITLED_BOARD } from './model'

describe('model', () => {
  it('newBoard normalizes the name and sets timestamps', () => {
    const b = newBoard('  Cardio  ', 1000)
    expect(b).toMatchObject({ name: 'Cardio', createdAt: 1000, updatedAt: 1000, deleted: false })
    expect(b.id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('normalizeBoardName falls back to Sans titre for blank names', () => {
    expect(UNTITLED_BOARD).toBe('Sans titre')
    expect(normalizeBoardName('   ')).toBe('Sans titre')
    expect(normalizeBoardName('')).toBe('Sans titre')
  })
  it('newNote uses default width and an empty paragraph', () => {
    expect(DEFAULT_NOTE_WIDTH).toBe(200)
    expect(newNote('b1', { x: 10, y: 20 }, 'pink', 5)).toMatchObject({
      boardId: 'b1', x: 10, y: 20, width: 200, color: 'pink', html: '<p></p>', updatedAt: 5, deleted: false,
    })
  })
  it('newArrow links two notes', () => {
    expect(newArrow('b1', 'n1', 'n2', 7)).toMatchObject({ boardId: 'b1', from: 'n1', to: 'n2', updatedAt: 7, deleted: false })
  })
})
