import { ARROW_COLOR_ORDER, ARROW_COLORS, type ArrowColor } from '@chart/shared'

const LABELS: Record<ArrowColor, string> = {
  gray: 'Gris',
  black: 'Noir',
  red: 'Rouge',
  blue: 'Bleu',
  green: 'Vert',
  purple: 'Violet',
  orange: 'Orange',
}

/** Colour dots shown on the selected (or just drawn) arrow. */
export function ArrowPalette({ color, onPick }: { color: ArrowColor; onPick(c: ArrowColor): void }) {
  return (
    <div className="arrow-palette" role="group" aria-label="Couleur de la flèche">
      {ARROW_COLOR_ORDER.map((c) => (
        <button
          key={c}
          className={c === color ? 'is-active' : undefined}
          style={{ background: ARROW_COLORS[c] }}
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
