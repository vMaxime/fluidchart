import { it, expect } from 'vitest'
import { Position } from '@xyflow/react'
import { sideAnchors } from './edgeGeometry'

const a = { x: 0, y: 0, width: 200, height: 80 } // centre (100, 40)

it('links facing sides horizontally when the target is mostly to the right', () => {
  expect(sideAnchors(a, { x: 300, y: 20, width: 200, height: 60 })).toEqual({
    sx: 200, sy: 40, sPos: Position.Right, tx: 300, ty: 50, tPos: Position.Left,
  })
})
it('links facing sides horizontally when the target is to the left', () => {
  expect(sideAnchors(a, { x: -300, y: 0, width: 200, height: 80 })).toMatchObject({ sx: 0, sPos: Position.Left, tx: -100, tPos: Position.Right })
})
it('links bottom to top when the target is mostly below (feedback loops stay vertical)', () => {
  expect(sideAnchors(a, { x: 0, y: 300, width: 200, height: 80 })).toEqual({
    sx: 100, sy: 80, sPos: Position.Bottom, tx: 100, ty: 300, tPos: Position.Top,
  })
})
it('links top to bottom when the target is above', () => {
  expect(sideAnchors(a, { x: 0, y: -300, width: 200, height: 80 })).toMatchObject({ sy: 0, sPos: Position.Top, ty: -220, tPos: Position.Bottom })
})
