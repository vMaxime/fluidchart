import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest runs without globals, so Testing Library cannot auto-cleanup.
afterEach(cleanup)

// ProseMirror (TipTap) calls layout APIs that jsdom does not implement.
const emptyRect = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({}) }
Range.prototype.getBoundingClientRect = () => emptyRect as DOMRect
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
document.elementFromPoint = () => null
