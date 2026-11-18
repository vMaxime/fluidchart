import { it, expect } from 'vitest'
import { borderPoint, floatingEndpoints } from './edgeGeometry'
const r = { x: 0, y: 0, width: 100, height: 50 } // centre (50, 25)

it('borderPoint toward the right hits the middle of the right border', () => {
  expect(borderPoint(r, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 })
})
it('borderPoint toward a steep diagonal hits the bottom border', () => {
  expect(borderPoint(r, { x: 70, y: 125 })).toEqual({ x: 55, y: 50 })
})
it('borderPoint returns the centre when toward is the centre', () => {
  expect(borderPoint(r, { x: 50, y: 25 })).toEqual({ x: 50, y: 25 })
})
it('floatingEndpoints uses each rect actual height (tall notes)', () => {
  const tall = { x: 300, y: -200, width: 100, height: 450 } // centre (350, 25)
  expect(floatingEndpoints(r, tall)).toEqual({ sx: 100, sy: 25, tx: 300, ty: 25 })
})
