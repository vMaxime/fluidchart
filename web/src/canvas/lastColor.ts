import { DEFAULT_NOTE_COLOR, NOTE_COLOR_ORDER, type NoteColor } from '@chart/shared'

const KEY = 'chart.lastColor'

export function getLastColor(): NoteColor {
  try {
    const v = localStorage.getItem(KEY)
    return NOTE_COLOR_ORDER.includes(v as NoteColor) ? (v as NoteColor) : DEFAULT_NOTE_COLOR
  } catch {
    return DEFAULT_NOTE_COLOR
  }
}

export function setLastColor(c: NoteColor): void {
  try {
    localStorage.setItem(KEY, c)
  } catch {
    // storage blocked: the default color is an acceptable fallback
  }
}
