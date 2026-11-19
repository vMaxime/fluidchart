import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style'

/** Everything a note's text can carry (StarterKit includes bold, italic, underline, lists, "- " input rule). */
export const noteEditorExtensions = [
  StarterKit,
  TextStyle,
  Color,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['paragraph'] }),
]
