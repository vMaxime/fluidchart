import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Highlight } from './Highlight'

it('marks the accent-insensitive match inside the name', () => {
  const { container } = render(<Highlight text="Hépatite B — sérologies" query="hepat" />)
  expect(container.querySelector('mark')?.textContent).toBe('Hépat')
  expect(container.textContent).toBe('Hépatite B — sérologies')
})

it('marks a match across a ligature', () => {
  const { container } = render(<Highlight text="Œdème aigu" query="oede" />)
  expect(container.querySelector('mark')?.textContent).toBe('Œdè')
})

it('renders plain text without a query or a match', () => {
  expect(render(<Highlight text="Asthme" query="" />).container.querySelector('mark')).toBeNull()
  expect(render(<Highlight text="Asthme" query="zzz" />).container.querySelector('mark')).toBeNull()
})
