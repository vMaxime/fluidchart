import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NoteEditor } from './NoteEditor'

it('renders the initial html', async () => {
  render(<NoteEditor html="<p>Insuline</p>" onChange={() => {}} onDone={() => {}} />)
  expect(await screen.findByText('Insuline')).toBeInTheDocument()
})
it('Escape calls onDone without a spurious save when nothing changed', async () => {
  const onChange = vi.fn(); const onDone = vi.fn()
  render(<NoteEditor html="<p>Insuline</p>" onChange={onChange} onDone={onDone} />)
  fireEvent.keyDown(await screen.findByRole('textbox', { name: 'Texte du post-it' }), { key: 'Escape' })
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(onChange).not.toHaveBeenCalled()
})


it('appends initialInput after the existing text once focused (type-to-edit)', async () => {
  const onChange = vi.fn()
  render(<NoteEditor html="<p>Insuline</p>" initialInput="X" onChange={onChange} onDone={() => {}} />)
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Texte du post-it' })).toHaveTextContent('InsulineX'))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('<p>InsulineX</p>'), { timeout: 1500 })
})
