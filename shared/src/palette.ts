import type { NoteColor } from './model'

/** Display order of note background colors. */
export const NOTE_COLOR_ORDER: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple']

/** Provisional hex values — the final look is chosen after /prototype. */
export const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: '#FFE58F',
  pink: '#FFC9DE',
  blue: '#BFE3FF',
  green: '#C8F0C2',
  orange: '#FFD3A8',
  purple: '#E2D2FF',
}

export const DEFAULT_NOTE_COLOR: NoteColor = 'yellow'
