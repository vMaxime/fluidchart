import { it, expect } from 'vitest'
import { extractTextColors } from './textColors'

it('extracts span colors, ignores highlight background-color, dedupes case-insensitively', () => {
  const html =
    '<p><span style="color: #DC2626">a</span> <mark data-color="#fde047" style="background-color: #fde047; color: inherit">b</mark>' +
    '<span style="font-size: 18px; color: rgb(37, 99, 235)">c</span><span style="color:#dc2626">d</span></p>'
  expect(extractTextColors(html)).toEqual(['#dc2626', '#2563eb'])
  expect(extractTextColors('<p>plain</p>')).toEqual([])
})

it('normalises rgb() to hex so the same colour is listed once', () => {
  expect(
    extractTextColors('<span style="color: rgb(220, 38, 38)">a</span><span style="color: #DC2626">b</span>'),
  ).toEqual(['#dc2626'])
})
