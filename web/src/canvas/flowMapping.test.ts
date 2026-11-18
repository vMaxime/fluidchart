import { it, expect } from 'vitest'
import { MarkerType } from '@xyflow/react'
import { newArrow, newNote } from '@chart/shared'
import { ARROW_COLOR, mergeEdges, mergeNodes } from './flowMapping'
const note = { ...newNote('b', { x: 10, y: 10 }, 'yellow', 0), id: 'n1' }
const arrow = { ...newArrow('b', 'n1', 'n2', 0), id: 'a1' }

it('takes position from the db when not dragging, keeps selection and measured size', () => {
  const current = [{ id: 'n1', type: 'note', position: { x: 0, y: 0 }, data: { note }, selected: true, measured: { width: 200, height: 80 } }] as any
  const [n] = mergeNodes([note], current)
  expect(n).toMatchObject({ position: { x: 10, y: 10 }, selected: true, measured: { width: 200, height: 80 }, width: 200 })
})
it('keeps the local position while the node is being dragged', () => {
  const current = [{ id: 'n1', type: 'note', position: { x: 99, y: 99 }, data: { note }, dragging: true }] as any
  expect(mergeNodes([note], current)[0].position).toEqual({ x: 99, y: 99 })
})
it('drops nodes whose note is gone', () => {
  const current = [{ id: 'old', type: 'note', position: { x: 0, y: 0 }, data: { note } }] as any
  expect(mergeNodes([note], current).map((n) => n.id)).toEqual(['n1'])
})
it('mergeEdges maps arrows to elbow edges with a closed arrow head in the arrow colour', () => {
  expect(mergeEdges([arrow], [])).toEqual([
    {
      id: 'a1',
      source: 'n1',
      target: 'n2',
      type: 'elbow',
      markerEnd: { type: MarkerType.ArrowClosed, color: ARROW_COLOR, width: 16, height: 16 },
      selected: false,
    },
  ])
})
it('mergeEdges keeps selection', () => {
  const current = [{ id: 'a1', source: 'n1', target: 'n2', selected: true }] as any
  expect(mergeEdges([arrow], current)[0].selected).toBe(true)
})
