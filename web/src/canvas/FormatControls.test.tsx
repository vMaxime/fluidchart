import { afterEach, beforeEach, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import type { NoteColor } from '@chart/shared'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { noteEditorExtensions } from './editorExtensions'
import { FormatControls } from './FormatControls'

let editor: Editor
beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => editor?.destroy())

function setup(html = '<p>Insuline</p>', noteColor: NoteColor = 'yellow') {
  editor = new Editor({ extensions: noteEditorExtensions, content: html })
  editor.commands.selectAll()
  render(<FormatControls editor={editor} noteColor={noteColor} />)
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

it('Gras / Italique / Souligné toggle marks', () => {
  setup()
  click('Gras')
  click('Italique')
  click('Souligné')
  expect(editor.getHTML()).toBe('<p><strong><em><u>Insuline</u></em></strong></p>')
  click('Gras')
  expect(editor.getHTML()).not.toContain('<strong>')
})

it('Surligner applies the chosen colour', () => {
  setup()
  click('Surligner')
  click('Surligner en vert')
  expect(editor.getHTML()).toContain('data-color="#86efac"')
})

it('Couleur du texte applies a preset and lists colours already used on notes of the same background', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'pink')
  await repo.updateNote(n.id, { html: '<p><span style="color: #0d9488">vu</span></p>' })
  setup('<p>Insuline</p>', 'pink')
  click('Couleur du texte')
  expect(await screen.findByRole('button', { name: 'Couleur #0d9488' })).toBeInTheDocument()
  expect(screen.getByText('Déjà utilisées')).toBeInTheDocument()
  click('Rouge')
  expect(editor.getHTML()).toMatch(/color: (#dc2626|rgb\(220, 38, 38\))/)
})

it('Taille du texte sets 18px, then back to normal', () => {
  setup()
  click('Taille du texte')
  click('Grand')
  expect(editor.getHTML()).toContain('font-size: 18px')
  click('Taille du texte')
  click('Normal')
  expect(editor.getHTML()).not.toContain('font-size')
})

it('alignment buttons set text-align on the paragraph', () => {
  setup()
  click('Centrer')
  expect(editor.getHTML()).toContain('text-align: center')
  click('Aligner à droite')
  expect(editor.getHTML()).toContain('text-align: right')
})
