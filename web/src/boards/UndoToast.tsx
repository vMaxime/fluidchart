import { useEffect } from 'react'
import type { Id } from '@chart/shared'

/** "« X » supprimée · Annuler" instead of a confirm dialog; goes away after 6 s. */
export function UndoToast({
  undo,
  onUndo,
  onClose,
}: {
  undo: { id: Id; name: string } | null
  onUndo(id: Id): void
  onClose(): void
}) {
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [undo, onClose])
  if (!undo) return null
  return (
    <div className="toast" role="status" key={undo.id}>
      <span>« {undo.name} » supprimée</span>
      <button
        onClick={() => {
          onUndo(undo.id)
          onClose()
        }}
      >
        Annuler
      </button>
    </div>
  )
}
