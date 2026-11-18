import { NOTE_COLOR_ORDER, NOTE_COLORS, type Id, type NoteColor } from '@chart/shared'
import { updateNote } from '../db/repo'
import { setLastColor } from './lastColor'

const LABELS: Record<NoteColor, string> = {
  yellow: 'Jaune',
  pink: 'Rose',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
  purple: 'Violet',
}

export function ColorBar({ selectedIds }: { selectedIds: Id[] }) {
  if (selectedIds.length === 0) return null
  function pick(color: NoteColor) {
    for (const id of selectedIds) void updateNote(id, { color })
    setLastColor(color)
  }
  return (
    <div className="color-bar" role="toolbar" aria-label="Couleur du post-it">
      {NOTE_COLOR_ORDER.map((c) => (
        <button key={c} aria-label={LABELS[c]} title={LABELS[c]} style={{ background: NOTE_COLORS[c] }} onClick={() => pick(c)} />
      ))}
    </div>
  )
}
