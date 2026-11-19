import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  // The editor mounts once the new note is stored: wait for focus before typing.
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
})

test('typed text survives an immediate reload without leaving the note', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.reload()
  await expect(page.getByTestId('note')).toContainText('Insuline')
})

test('typed text survives closing the tab right away', async ({ page, context }) => {
  await page.keyboard.type('Glucagon')
  const url = page.url()
  await page.close({ runBeforeUnload: true })
  const again = await context.newPage()
  await again.goto(url)
  await expect(again.getByTestId('note')).toContainText('Glucagon')
})

test('Backspace while editing deletes characters, never the note', async ({ page }) => {
  await page.keyboard.type('Insuline')
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('note')).toHaveCount(1)
  await expect(page.getByTestId('note')).toHaveText('Insul')
})

test('"- " starts a bullet list', async ({ page }) => {
  await page.keyboard.type('- glucose')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('note').locator('ul li')).toHaveText('glucose')
})

test('Backspace right after leaving an existing note does not delete it', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.keyboard.press('Escape')
  const note = page.getByTestId('note')
  await note.dblclick()
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(300) // deletion is async (IndexedDB then live query): let it land if it is going to
  await expect(note).toHaveCount(1)
  await expect(note).toContainText('Insuline')
})

test('typing on a selected note opens it and appends the text', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.keyboard.press('Escape')
  const note = page.getByTestId('note')
  await note.click()
  await page.keyboard.press('X')
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(note).toHaveText('InsulineX')
})

test('while writing, the format bar sits above the note (no selection needed); Gras persists after reload', async ({ page }) => {
  const bar = page.locator('.note-toolbar')
  const note = page.getByTestId('note')
  await expect(bar).toBeVisible()
  const barBox = (await bar.boundingBox())!
  expect(barBox.y + barBox.height).toBeLessThanOrEqual((await note.boundingBox())!.y)
  await page.keyboard.type('Insuline')
  await page.keyboard.press('ControlOrMeta+A')
  await bar.getByRole('button', { name: 'Gras' }).click()
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
  await page.waitForTimeout(600)
  await page.reload()
  await expect(note.locator('strong')).toHaveText('Insuline')
})

test('picking a text colour keeps the note in edit mode', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.keyboard.press('ControlOrMeta+A')
  const bar = page.locator('.note-toolbar')
  await bar.getByRole('button', { name: 'Couleur du texte' }).click()
  await bar.getByRole('button', { name: 'Rouge' }).click()
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('note').locator('span[style*="color"]')).toHaveCSS('color', 'rgb(220, 38, 38)')
})

test('undo then redo of a new note brings its text back, even after a reload', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.keyboard.press('Escape')
  const note = page.getByTestId('note')
  await page.keyboard.press('ControlOrMeta+z') // the writing session
  await expect(note).toHaveText('')
  await page.keyboard.press('ControlOrMeta+z') // the creation
  await expect(note).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(note).toHaveText('Insuline')
  await page.waitForTimeout(300)
  await page.reload()
  await expect(note).toHaveText('Insuline')
})

test('double-clicking a word while writing keeps one writing step', async ({ page }) => {
  await page.keyboard.type('alpha beta')
  await page.waitForTimeout(600)
  // Double-click on the first word (the middle of the line is the space between the words).
  await page.getByRole('textbox', { name: 'Texte du post-it' }).getByText('alpha beta').dblclick({ position: { x: 12, y: 8 } })
  await page.locator('.note-toolbar').getByRole('button', { name: 'Gras' }).click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByTestId('note')).toHaveText('')
})

test('"Autre couleur…" applies the picked colour and keeps editing', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.keyboard.press('ControlOrMeta+A')
  const bar = page.locator('.note-toolbar')
  await bar.getByRole('button', { name: 'Couleur du texte' }).click()
  await bar.getByLabel('Autre couleur').fill('#123456')
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('note').locator('span[style*="color"]')).toHaveCSS('color', 'rgb(18, 52, 86)')
})

test('an instant click on Annuler while writing keeps the note', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.getByRole('button', { name: 'Annuler' }).click({ delay: 0 })
  await expect(page.getByTestId('note')).toHaveCount(1)
})

test('leaving the format bar for the canvas ends the edit cleanly and keeps it as one undo step', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.keyboard.type('Premier')
  await page.keyboard.press('ControlOrMeta+A')
  const bar = page.locator('.note-toolbar')
  await bar.getByRole('button', { name: 'Couleur du texte' }).click()
  await bar.getByLabel('Autre couleur').focus()
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 400 } })
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toHaveCount(0)
  expect(errors).toEqual([])
  await page.keyboard.press('ControlOrMeta+z') // undoes the writing session, not the creation
  await expect(page.getByTestId('note')).toHaveCount(1)
  await expect(page.getByTestId('note')).toHaveText('')
})
