import type { ArrowColor, NoteColor } from './model'

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

/** Display order of arrow colours: the default gray, then the text editor's colours. */
export const ARROW_COLOR_ORDER: ArrowColor[] = ['gray', 'black', 'red', 'blue', 'green', 'purple', 'orange']

export const ARROW_COLORS: Record<ArrowColor, string> = {
  gray: '#78716c',
  black: '#1c1917',
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  purple: '#9333ea',
  orange: '#ea580c',
}

export const DEFAULT_ARROW_COLOR: ArrowColor = 'gray'
