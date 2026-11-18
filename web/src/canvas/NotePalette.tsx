import { NOTE_COLOR_ORDER, NOTE_COLORS, type NoteColor } from '@chart/shared'

const LABELS: Record<NoteColor, string> = {
  yellow: 'Jaune',
  pink: 'Rose',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
  purple: 'Violet',
}

/** Colour dots shown above the focused note. Pressing a dot never steals focus from the editor. */
export function NotePalette({ color, onPick }: { color: NoteColor; onPick(c: NoteColor): void }) {
  return (
    <div className="note-palette" role="group" aria-label="Couleur du post-it">
      {NOTE_COLOR_ORDER.map((c) => (
        <button
          key={c}
          className={c === color ? 'is-active' : undefined}
          style={{ background: NOTE_COLORS[c] }}
          aria-label={LABELS[c]}
          aria-pressed={c === color}
          title={LABELS[c]}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  )
}
