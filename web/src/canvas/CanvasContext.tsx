import { createContext } from 'react'
import type { Id } from '@chart/shared'

export const CanvasContext = createContext<{
  editingId: Id | null
  startEditing(id: Id): void
  stopEditing(): void
}>({ editingId: null, startEditing() {}, stopEditing() {} })
