import { createContext, type PointerEvent as ReactPointerEvent } from 'react'
import type { ArrowColor, Id, NoteColor } from '@chart/shared'
import type { Side } from './edgeGeometry'

export type Tool = 'select' | 'note' | 'arrow'

export const CanvasContext = createContext<{
  tool: Tool
  editingId: Id | null
  /** Text typed on a selected note that opened its editor (type-to-edit). */
  initialInput: string | undefined
  /** The note showing the colour palette: the one being edited, else the single selected one. */
  paletteFor: Id | null
  /** The arrow showing its colour palette: the single selected arrow, when no note is selected. */
  arrowPaletteFor: Id | null
  /** Note under the pointer while drawing an arrow. */
  arrowTarget: Id | null
  freshIds: ReadonlySet<Id>
  startEditing(id: Id, initialInput?: string): void
  /**
   * Ends editing. From the editor itself: `finalHtml` and the note `id` (one undo step per writing
   * session). From elsewhere (pane click…): no arguments; the editor then reports its text as it closes.
   */
  stopEditing(finalHtml?: string, id?: Id): void
  recolor(id: Id, color: NoteColor): void
  recolorArrow(id: Id, color: ArrowColor): void
  startArrow(id: Id, e: ReactPointerEvent): void
  /** Press on a + knob: tap grows a connected note on that side, drag connects or grows where dropped. */
  startKnob(id: Id, side: Side, e: ReactPointerEvent): void
  growBeside(id: Id, side: Side): void
}>({
  tool: 'select',
  editingId: null,
  initialInput: undefined,
  paletteFor: null,
  arrowPaletteFor: null,
  arrowTarget: null,
  freshIds: new Set(),
  startEditing() {},
  stopEditing() {},
  recolor() {},
  recolorArrow() {},
  startArrow() {},
  startKnob() {},
  growBeside() {},
})
