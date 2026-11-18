import { describe, it, expect } from 'vitest'
import { Position } from '@xyflow/react'
import { besidePosition, sideAnchors } from './edgeGeometry'

const a = { x: 0, y: 0, width: 200, height: 80 } // centre (100, 40)

it('links facing sides horizontally when the target is mostly to the right', () => {
  expect(sideAnchors(a, { x: 300, y: 20, width: 200, height: 60 })).toEqual({
    sx: 200,
    sy: 40,
    sPos: Position.Right,
    tx: 300,
    ty: 50,
    tPos: Position.Left,
  })
})
it('links facing sides horizontally when the target is to the left', () => {
  expect(sideAnchors(a, { x: -300, y: 0, width: 200, height: 80 })).toMatchObject({
    sx: 0,
    sPos: Position.Left,
    tx: -100,
    tPos: Position.Right,
  })
})
it('links bottom to top when the target is mostly below (feedback loops stay vertical)', () => {
  expect(sideAnchors(a, { x: 0, y: 300, width: 200, height: 80 })).toEqual({
    sx: 100,
    sy: 80,
    sPos: Position.Bottom,
    tx: 100,
    ty: 300,
    tPos: Position.Top,
  })
})
it('links top to bottom when the target is above', () => {
  expect(sideAnchors(a, { x: 0, y: -300, width: 200, height: 80 })).toMatchObject({
    sy: 0,
    sPos: Position.Top,
    ty: -220,
    tPos: Position.Bottom,
  })
})

describe('besidePosition (the + knobs)', () => {
  const src = { x: 0, y: 0, width: 200, height: 80 }
  it('places the new note to the right, top-aligned, with a gap', () => {
    expect(besidePosition(src, 'right', [src])).toEqual({ x: 290, y: 0 })
  })
  it('places it below, centred under the source', () => {
    expect(besidePosition(src, 'bottom', [src])).toEqual({ x: 0, y: 136 })
  })
  it('places it to the left and above', () => {
    expect(besidePosition(src, 'left', [src])).toEqual({ x: -290, y: 0 })
    expect(besidePosition(src, 'top', [src])).toEqual({ x: 0, y: -136 })
  })
  it('slides down past notes already in the way (right side)', () => {
    const blocker = { x: 290, y: 0, width: 200, height: 120 }
    expect(besidePosition(src, 'right', [src, blocker])).toEqual({ x: 290, y: 140 })
  })
  it('slides right past notes already in the way (below)', () => {
    const blocker = { x: 0, y: 136, width: 200, height: 80 }
    expect(besidePosition(src, 'bottom', [src, blocker])).toEqual({ x: 230, y: 136 })
  })
})
