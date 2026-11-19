import { it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { API_EXAMPLE_BOARD } from '@chart/shared'
import { noteEditorExtensions } from './editorExtensions'

// The server cleans API html into the editor's own form; the documented example must already be in it.
it('every API example note keeps its exact html through the editor', () => {
  for (const note of API_EXAMPLE_BOARD.notes) {
    const editor = new Editor({ extensions: noteEditorExtensions, content: note.html })
    expect(editor.getHTML()).toBe(note.html)
    editor.destroy()
  }
})
