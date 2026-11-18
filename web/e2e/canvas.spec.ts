import { test, expect, type Locator, type Page } from '@playwright/test'

async function newBoard(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
}
const notes = (page: Page) => page.getByTestId('note')
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
async function connect(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
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
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(notes(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await notes(page).first().dblclick()
  await expect(notes(page)).toHaveCount(1)
})

test('drag, arrow and color survive a reload', async ({ page }) => {
  await newBoard(page)
  const pane = page.locator('.react-flow__pane')
  await pane.dblclick({ position: { x: 200, y: 200 } }); await page.keyboard.press('Escape')
  await pane.dblclick({ position: { x: 600, y: 200 } }); await page.keyboard.press('Escape')
  await connect(page, notes(page).nth(0).locator('.react-flow__handle-right'), notes(page).nth(1).locator('.react-flow__handle-left'))
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
  await pane.dblclick({ position: { x: 200, y: 200 } }); await page.keyboard.press('Escape')
  await pane.dblclick({ position: { x: 600, y: 200 } }); await page.keyboard.press('Escape')
  await connect(page, notes(page).nth(0).locator('.react-flow__handle-right'), notes(page).nth(1).locator('.react-flow__handle-left'))
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
