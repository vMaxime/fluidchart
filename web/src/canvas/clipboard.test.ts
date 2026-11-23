import { it, expect } from 'vitest'
import { noteText, textToHtml } from './clipboard'

it('noteText gives the whole text of a note: one line per paragraph, dashes for bullets, no markup', () => {
  expect(noteText('<p>Insuline</p><p></p><p>Hormone <strong>hypo</strong>glycémiante</p>')).toBe(
    'Insuline\n\nHormone hypoglycémiante',
  )
  expect(
    noteText('<p>Effets</p><ul><li><p>Captage</p><ul><li><p>muscle</p></li></ul></li><li><p>Lipolyse</p></li></ul>'),
  ).toBe('Effets\n- Captage\n  - muscle\n- Lipolyse')
  expect(noteText('<p>a<br>b</p>')).toBe('a\nb')
  expect(noteText('<p>x &lt; y &amp; z</p>')).toBe('x < y & z')
  expect(noteText('<p></p>')).toBe('')
})

it('textToHtml makes escaped paragraphs, keeps blank lines, drops empty or whitespace-only text', () => {
  expect(textToHtml('Insuline\nGlucagon')).toBe('<p>Insuline</p><p>Glucagon</p>')
  expect(textToHtml('a\r\n\r\nx < y & z')).toBe('<p>a</p><p></p><p>x &lt; y &amp; z</p>')
  expect(textToHtml('\n\ntexte\n\n')).toBe('<p>texte</p>')
  expect(textToHtml('   \n ')).toBeNull()
  expect(textToHtml('')).toBeNull()
})
