import { createContext, type PointerEvent as ReactPointerEvent } from 'react'
import type { Id, NoteColor } from '@chart/shared'

export type Tool = 'select' | 'note' | 'arrow'

export const CanvasContext = createContext<{
  tool: Tool
  editingId: Id | null
  /** Text typed on a selected note that opened its editor (type-to-edit). */
  initialInput: string | undefined
  /** The note showing the colour palette: the one being edited, else the single selected one. */
  paletteFor: Id | null
  /** Note under the pointer while drawing an arrow. */
  arrowTarget: Id | null
  freshIds: ReadonlySet<Id>
  startEditing(id: Id, initialInput?: string): void
  stopEditing(): void
  recolor(id: Id, color: NoteColor): void
  startArrow(id: Id, e: ReactPointerEvent): void
}>({
  tool: 'select',
  editingId: null,
  initialInput: undefined,
  paletteFor: null,
  arrowTarget: null,
  freshIds: new Set(),
  startEditing() {},
  stopEditing() {},
  recolor() {},
  startArrow() {},
})
