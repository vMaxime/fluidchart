import { it, expect } from 'vitest'
import { API_EXAMPLE_BOARD } from '@chart/shared'
import { cleanNoteHtml } from './html'

it('keeps the subset and renames b/i/div/h1', () => {
  expect(cleanNoteHtml('<p><b>A</b> <i>B</i> <u>C</u></p>')).toBe('<p><strong>A</strong> <em>B</em> <u>C</u></p>')
  expect(cleanNoteHtml('<h1>T</h1><div>x</div><ul><li><p>i</p></li></ul>')).toBe(
    '<p>T</p><p>x</p><ul><li><p>i</p></li></ul>',
  )
})

// The editor's form is the browser's: ProseMirror sets styles through style.cssText, so colours
// read back as rgb() and every declaration ends with ';'.
it("normalizes colours, sizes and alignment to the editor's form", () => {
  expect(cleanNoteHtml('<p style="text-align:CENTER"><span style="color:#F00;font-size:17px">x</span></p>')).toBe(
    '<p style="text-align: center;"><span style="color: rgb(255, 0, 0); font-size: 18px;">x</span></p>',
  )
  expect(
    cleanNoteHtml('<p style="text-align: left"><span style="font-size:14px; color: rgb(220, 38, 38)">n</span></p>'),
  ).toBe('<p><span style="color: rgb(220, 38, 38);">n</span></p>')
  expect(cleanNoteHtml('<p><span style="font-size: 30px">a</span><span style="font-size: 7.5pt">b</span></p>')).toBe(
    '<p><span style="font-size: 22px;">a</span><span style="font-size: 12px;">b</span></p>',
  )
  expect(cleanNoteHtml('<p><mark style="background-color:#FDE047">h</mark></p>')).toBe(
    '<p><mark data-color="#fde047" style="background-color: rgb(253, 224, 71); color: inherit;">h</mark></p>',
  )
  // A span left without any accepted style is unwrapped.
  expect(cleanNoteHtml('<p><span style="font-family: x">t</span></p>')).toBe('<p>t</p>')
})

it('strips anything executable or outside the list', () => {
  expect(
    cleanNoteHtml(
      '<p onclick="x()">a<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">b</a></p><style>p{}</style>',
    ),
  ).toBe('<p>ab</p>')
  expect(cleanNoteHtml('<p><span style="color: red; background: url(https://evil.example/x)">c</span></p>')).toBe(
    '<p>c</p>',
  )
  expect(cleanNoteHtml('<p><span style="color: #123456; background-image: url(x)">d</span></p>')).toBe(
    '<p><span style="color: rgb(18, 52, 86);">d</span></p>',
  )
})

it('plain text becomes escaped paragraphs', () => {
  expect(cleanNoteHtml('Insuline & glucagon\n\nx < y')).toBe('<p>Insuline &amp; glucagon</p><p></p><p>x &lt; y</p>')
})

it('empty or emptied input gives an empty paragraph', () => {
  expect(cleanNoteHtml('  ')).toBe('<p></p>')
  expect(cleanNoteHtml('<script>x</script>')).toBe('<p></p>')
})

it("the API example is already in the editor's form", () => {
  for (const n of API_EXAMPLE_BOARD.notes) expect(cleanNoteHtml(n.html)).toBe(n.html)
})

it('block wrappers and loose text end up as editor paragraphs', () => {
  expect(cleanNoteHtml('<div><p>Titre</p><p>texte</p></div>')).toBe('<p>Titre</p><p>texte</p>')
  expect(cleanNoteHtml('<p>Effets<ul><li>a</li></ul></p>')).toBe('<p>Effets</p><ul><li><p>a</p></li></ul>')
  expect(cleanNoteHtml('Intro<p>a</p>')).toBe('<p>Intro</p><p>a</p>')
  expect(cleanNoteHtml('Titre<br>suite')).toBe('<p>Titre<br>suite</p>')
  expect(cleanNoteHtml('<ul>\n  <li>a</li>\n  <li><b>b</b> c</li>\n</ul>\n<p>d</p>')).toBe(
    '<ul><li><p>a</p></li><li><p><strong>b</strong> c</p></li></ul><p>d</p>',
  )
  expect(cleanNoteHtml('<p style="text-align:center">Titre<ul><li>x</li></ul></p>')).toBe(
    '<p style="text-align: center;">Titre</p><ul><li><p>x</p></li></ul>',
  )
})

it('a < that opens no tag is text, not a lost tag', () => {
  expect(cleanNoteHtml('PaO2<PaCO2 et Na+')).toBe('<p>PaO2&lt;PaCO2 et Na+</p>')
  expect(cleanNoteHtml('<p>PaO2<PaCO2</p>')).toBe('<p>PaO2&lt;PaCO2</p>')
  expect(cleanNoteHtml('x<y')).toBe('<p>x&lt;y</p>')
})
