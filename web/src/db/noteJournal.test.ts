import { beforeEach, it, expect } from 'vitest'
import { db } from './db'
import * as repo from './repo'
import { clearJournal, journalNoteHtml, replayJournal } from './noteJournal'

beforeEach(async () => {
  localStorage.clear()
  await db.delete(); await db.open()
})

it('replays a journaled draft into the note and clears it', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  journalNoteHtml(n.id, '<p>Insuline</p>')
  expect(await replayJournal()).toBe(1)
  expect((await repo.listNotes(b.id))[0].html).toBe('<p>Insuline</p>')
  expect(await replayJournal()).toBe(0)
})

it('clearJournal keeps a newer draft than the one that was saved', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  journalNoteHtml(n.id, '<p>Insul</p>')
  journalNoteHtml(n.id, '<p>Insuline</p>')
  clearJournal(n.id, '<p>Insul</p>')
  await replayJournal()
  expect((await repo.listNotes(b.id))[0].html).toBe('<p>Insuline</p>')
})

it('drops drafts of deleted notes and malformed entries without writing', async () => {
  const b = await repo.createBoard('A')
  const n = await repo.addNote(b.id, { x: 0, y: 0 }, 'yellow')
  await repo.deleteNotes([n.id])
  journalNoteHtml(n.id, '<p>ghost</p>')
  localStorage.setItem('chart.journal.broken', '{not json')
  expect(await replayJournal()).toBe(0)
  expect(localStorage.length).toBe(0)
  expect((await db.notes.get(n.id))!.html).toBe('<p></p>')
})
