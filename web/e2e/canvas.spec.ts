import { test, expect, type Locator, type Page } from '@playwright/test'

async function newBoard(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
}
const notes = (page: Page) => page.getByTestId('note')
const editor = (page: Page) => page.getByRole('textbox', { name: 'Texte du post-it' })
// Double-click creates a note in edit mode: wait for the editor, then leave it with Escape.
async function createNote(page: Page, position: { x: number; y: number }) {
  await page.locator('.react-flow__pane').dblclick({ position })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
}
// L'ordre des post-it dans le DOM suit leur id (aléatoire) : on les distingue par couleur.
const byColor = (page: Page, c: string) => page.locator(`[data-testid="note"][data-color="${c}"]`)
// Reads note rows straight from IndexedDB, to wait for a write to land before reloading.
const storedNotes = (page: Page) =>
  page.evaluate(() => new Promise<{ color: string; y: number }[]>((resolve) => {
    const req = indexedDB.open('chart')
    req.onsuccess = () => {
      const all = req.result.transaction('notes').objectStore('notes').getAll()
      all.onsuccess = () => resolve(all.result)
    }
  }))
// locator.dragTo() sends a single mousemove, which React Flow does not treat as a node drag.
const center = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
// Arrow tool (A): drag from one note to another; the tool returns to selection afterwards.
async function drawArrow(page: Page, from: Locator, to: Locator) {
  await page.keyboard.press('a')
  const a = await center(from)
  const b = await center(to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
}
async function dragBy(page: Page, target: Locator, dx: number, dy: number) {
  const b = (await target.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 10 })
  await page.mouse.up()
}

test('double-click on empty canvas creates a note, not on a note', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 200 })
  await expect(notes(page)).toHaveCount(1)
  await notes(page).first().dblclick()
  await expect(notes(page)).toHaveCount(1)
})

test('drag, arrow and color survive a reload', async ({ page }) => {
  await newBoard(page)
  const pane = page.locator('.react-flow__pane')
  await createNote(page, { x: 200, y: 200 })
  await createNote(page, { x: 600, y: 200 })
  await drawArrow(page, notes(page).nth(0), notes(page).nth(1))
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await notes(page).nth(1).click()
  await page.getByRole('button', { name: 'Rose' }).click()
  await dragBy(page, byColor(page, 'pink'), 0, 250)
  await expect.poll(async () => {
    const rows = await storedNotes(page)
    const y = (c: string) => rows.find((r) => r.color === c)!.y
    return y('pink') - y('yellow')
  }).toBeGreaterThan(100)
  await page.reload() // fitView change le cadrage : on compare des positions relatives
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  const yellow = (await byColor(page, 'yellow').boundingBox())!
  const pink = (await byColor(page, 'pink').boundingBox())!
  expect(pink.y).toBeGreaterThan(yellow.y + 50)
  await pane.dblclick({ position: { x: 50, y: 50 } })
  await expect(byColor(page, 'pink')).toHaveCount(2) // dernière couleur = défaut
})

test('Backspace on a selected note deletes it and its arrows', async ({ page }) => {
  await newBoard(page)
  const pane = page.locator('.react-flow__pane')
  await createNote(page, { x: 200, y: 200 })
  await createNote(page, { x: 600, y: 200 })
  await drawArrow(page, notes(page).nth(0), notes(page).nth(1))
  await notes(page).nth(1).click()
  await page.keyboard.press('Backspace')
  await expect(notes(page)).toHaveCount(1)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
})

test('same board open in two tabs stays in sync', async ({ page, context }) => {
  await newBoard(page)
  const other = await context.newPage()
  await other.goto(page.url())
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(other.getByTestId('note')).toHaveCount(1)
})

test('arrow tool draws one arrow then goes back to selection; Escape cancels it', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 200, y: 200 })
  await createNote(page, { x: 600, y: 200 })
  const select = page.getByRole('button', { name: 'Sélectionner' })
  const arrowTool = page.getByRole('button', { name: 'Ajouter une flèche' })
  await page.keyboard.press('a')
  await expect(arrowTool).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(select).toHaveAttribute('aria-pressed', 'true')
  await drawArrow(page, notes(page).nth(0), notes(page).nth(1))
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(select).toHaveAttribute('aria-pressed', 'true')
})

test('note tool: N then a click places a note in edit mode, then back to selection', async ({ page }) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').click({ position: { x: 50, y: 50 } })
  await page.keyboard.press('n')
  await page.locator('.react-flow__pane').click({ position: { x: 400, y: 300 } })
  await expect(editor(page)).toBeFocused()
  await expect(notes(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Sélectionner' })).toHaveAttribute('aria-pressed', 'true')
})

test('the colour palette sits above a new or selected note and keeps editing going', async ({ page }) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
  await expect(editor(page)).toBeFocused()
  const palette = page.getByRole('group', { name: 'Couleur du post-it' })
  await expect(palette).toBeVisible()
  expect((await palette.boundingBox())!.y).toBeLessThan((await notes(page).first().boundingBox())!.y)
  await palette.getByRole('button', { name: 'Vert' }).click()
  await expect(notes(page).first()).toHaveAttribute('data-color', 'green')
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(palette).toHaveCount(0)
  await notes(page).first().click()
  await expect(palette).toBeVisible()
})

test('tool tooltips pop to the right of the button', async ({ page }) => {
  await newBoard(page)
  const button = page.getByRole('button', { name: 'Ajouter une flèche' })
  await button.hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toHaveText(/Ajouter une flèche/)
  expect((await tip.boundingBox())!.x).toBeGreaterThan((await button.boundingBox())!.x + (await button.boundingBox())!.width)
})

test('canvas stays light when the system is in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await newBoard(page)
  await expect(page.locator('.react-flow')).toHaveClass(/\blight\b/)
})
