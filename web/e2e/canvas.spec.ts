import { test, expect, type Locator, type Page } from './fixtures'

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
  page.evaluate(
    () =>
      new Promise<{ color: string; y: number }[]>((resolve) => {
        const req = indexedDB.open('chart')
        req.onsuccess = () => {
          const all = req.result.transaction('notes').objectStore('notes').getAll()
          all.onsuccess = () => resolve(all.result)
        }
      }),
  )
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
  await expect
    .poll(async () => {
      const rows = await storedNotes(page)
      const y = (c: string) => rows.find((r) => r.color === c)!.y
      return y('pink') - y('yellow')
    })
    .toBeGreaterThan(100)
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

test('while writing, the note colour is in the format bar; once selected, the palette sits above the note', async ({
  page,
}) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
  await expect(editor(page)).toBeFocused()
  const bar = page.locator('.note-toolbar')
  await bar.getByRole('button', { name: 'Couleur du post-it' }).click()
  await bar.getByRole('button', { name: 'Vert' }).click()
  await expect(notes(page).first()).toHaveAttribute('data-color', 'green')
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(bar).toHaveCount(0)
  await notes(page).first().click()
  const palette = page.getByRole('group', { name: 'Couleur du post-it' })
  await expect(palette).toBeVisible()
  expect((await palette.boundingBox())!.y).toBeLessThan((await notes(page).first().boundingBox())!.y)
  // On a selected note the palette sits above the top + knob instead of covering it.
  const knob = (await page.getByRole('button', { name: 'Nouveau post-it au-dessus' }).boundingBox())!
  expect((await palette.boundingBox())!.y + (await palette.boundingBox())!.height).toBeLessThanOrEqual(knob.y)
})

test('tool tooltips pop to the right of the button', async ({ page }) => {
  await newBoard(page)
  const button = page.getByRole('button', { name: 'Ajouter une flèche' })
  await button.hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toHaveText(/Ajouter une flèche/)
  expect((await tip.boundingBox())!.x).toBeGreaterThan(
    (await button.boundingBox())!.x + (await button.boundingBox())!.width,
  )
})

test('canvas stays light when the system is in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await newBoard(page)
  await expect(page.locator('.react-flow')).toHaveClass(/\blight\b/)
})

test('arrows are smooth curves', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 200, y: 200 })
  await createNote(page, { x: 600, y: 350 })
  await drawArrow(page, notes(page).nth(0), notes(page).nth(1))
  expect(await page.locator('.react-flow__edge path.arrow').getAttribute('d')).toContain('C')
})

test('clicking the + on the right of a note grows a connected note there, in edit mode', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 250, y: 250 })
  const source = notes(page).first()
  const sourceX = (await source.boundingBox())!.x // measured now: .first() may resolve to the new note later
  await source.hover()
  await page.getByRole('button', { name: 'Nouveau post-it à droite' }).click()
  await expect(editor(page)).toBeFocused()
  await expect(notes(page)).toHaveCount(2)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.keyboard.type('Suite')
  await page.keyboard.press('Escape')
  const grown = notes(page).filter({ hasText: 'Suite' })
  expect((await grown.boundingBox())!.x).toBeGreaterThan(sourceX + 100)
})

test('dragging a + onto another note connects them; onto empty canvas grows a note there', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 200, y: 200 })
  await createNote(page, { x: 650, y: 200 })
  const [a, b] = [notes(page).nth(0), notes(page).nth(1)]
  await a.hover()
  const knob = await center(a.getByRole('button', { name: 'Nouveau post-it en dessous' }))
  const target = await center(b)
  await page.mouse.move(knob.x, knob.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(notes(page)).toHaveCount(2)
  await a.hover()
  const knob2 = await center(a.getByRole('button', { name: 'Nouveau post-it en dessous' }))
  await page.mouse.move(knob2.x, knob2.y)
  await page.mouse.down()
  await page.mouse.move(knob2.x, knob2.y + 220, { steps: 10 })
  await page.mouse.up()
  await expect(editor(page)).toBeFocused()
  await expect(notes(page)).toHaveCount(3)
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
})

test('⌘Z undoes a note deletion, ⇧⌘Z redoes it', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 250 })
  await notes(page).first().click()
  await page.keyboard.press('Backspace')
  await expect(notes(page)).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(notes(page)).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(notes(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(notes(page)).toHaveCount(1)
})

test('⌘Z while typing undoes the typing, not the canvas', async ({ page }) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 250 } })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type('Insuline')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(editor(page)).toBeFocused()
  await expect(notes(page)).toHaveCount(1)
  await expect(editor(page)).not.toContainText('Insuline')
})

const storedArrowColors = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<(string | undefined)[]>((resolve) => {
        const req = indexedDB.open('chart')
        req.onsuccess = () => {
          const all = req.result.transaction('arrows').objectStore('arrows').getAll()
          all.onsuccess = () =>
            resolve(all.result.filter((a: { deleted: boolean }) => !a.deleted).map((a: { color?: string }) => a.color))
        }
      }),
  )

test('a new arrow shows its colour palette; the colour can be undone and survives a reload', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 200, y: 200 })
  await createNote(page, { x: 600, y: 200 })
  await drawArrow(page, notes(page).nth(0), notes(page).nth(1))
  const palette = page.getByRole('group', { name: 'Couleur de la flèche' })
  await expect(palette).toBeVisible()
  await palette.getByRole('button', { name: 'Rouge' }).click()
  const path = page.locator('.react-flow__edge path.arrow')
  await expect(path).toHaveCSS('stroke', 'rgb(220, 38, 38)')

  // Clicking the empty canvas hides the palette; clicking the arrow brings it back.
  await page.locator('.react-flow__pane').click({ position: { x: 400, y: 450 } })
  await expect(palette).toHaveCount(0)
  // Click the middle of the arrow, between the two notes (the SVG group itself is not clickable).
  const [left, right] = [(await notes(page).nth(0).boundingBox())!, (await notes(page).nth(1).boundingBox())!].sort(
    (p, q) => p.x - q.x,
  )
  await page.mouse.click((left.x + left.width + right.x) / 2, left.y + left.height / 2)
  await expect(palette).toBeVisible()

  await page.keyboard.press('ControlOrMeta+z')
  await expect(path).toHaveCSS('stroke', 'rgb(120, 113, 108)')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(path).toHaveCSS('stroke', 'rgb(220, 38, 38)')
  await expect.poll(() => storedArrowColors(page)).toEqual(['red'])
  await page.reload()
  await expect(page.locator('.react-flow__edge path.arrow')).toHaveCSS('stroke', 'rgb(220, 38, 38)')
})

// Resizing: the ◢ handle of the selected note, dragged by (dx, dy).
const resizeHandle = (page: Page) => page.locator('.react-flow__resize-control')
async function dragHandle(page: Page, dx: number, dy: number) {
  const b = (await resizeHandle(page).boundingBox())!
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 10 })
  await page.mouse.up()
}
const size = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { width: Math.round(b.width), height: Math.round(b.height) }
}
const storedSizes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ width: number; height?: number }[]>((resolve) => {
        const req = indexedDB.open('chart')
        req.onsuccess = () => {
          const all = req.result.transaction('notes').objectStore('notes').getAll()
          all.onsuccess = () =>
            resolve(all.result.map((n: { width: number; height?: number }) => ({ width: n.width, height: n.height })))
        }
      }),
  )

test('dragging the corner handle resizes the note; reload keeps it; ⌘Z / ⇧⌘Z undo it in one step', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 200 })
  await notes(page).first().click()
  await expect(resizeHandle(page)).toHaveCount(1)
  const before = await size(notes(page).first())
  await dragHandle(page, 120, 90)
  const after = await size(notes(page).first())
  expect(after.width).toBeGreaterThan(before.width + 100)
  expect(after.height).toBeGreaterThan(before.height + 70)
  await expect.poll(async () => (await storedSizes(page))[0].width).toBeGreaterThan(300)
  expect((await storedSizes(page))[0].height).toBeGreaterThan(130)

  // One undo step brings back both sizes; redo restores both. (History lives until the page closes.)
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => size(notes(page).first())).toEqual(before)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => size(notes(page).first())).toEqual(after)
  await expect.poll(async () => (await storedSizes(page))[0].width).toBeGreaterThan(300)

  await page.reload()
  await expect.poll(() => size(notes(page).first())).toEqual(after)
})

test('no resize handle while writing; text taller than the chosen height still grows the note', async ({ page }) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(editor(page)).toBeFocused()
  await expect(resizeHandle(page)).toHaveCount(0)
  await page.keyboard.type('Une ligne')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await notes(page).first().click()
  await dragHandle(page, 0, 120) // taller than its one line of text
  const tall = (await size(notes(page).first())).height
  expect(tall).toBeGreaterThan(150)
  // Long text in a narrow note: the note grows past the chosen minimum, nothing is cut.
  await notes(page).first().dblclick()
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(Array.from({ length: 40 }, (_, i) => `ligne${i}`).join(' '))
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await size(notes(page).first())).height).toBeGreaterThan(tall)
})

test('dragging the handle back to the top gives the automatic height again', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 200 })
  await notes(page).first().click()
  const auto = await size(notes(page).first())
  await dragHandle(page, 0, 100)
  await expect.poll(async () => (await storedSizes(page))[0].height).toBeGreaterThan(100)
  await dragHandle(page, 0, -400)
  await expect.poll(async () => (await storedSizes(page))[0].height).toBeUndefined()
  expect((await size(notes(page).first())).height).toBe(auto.height)
})

const storedRows = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ updatedAt: number; height?: number }[]>((resolve) => {
        const req = indexedDB.open('chart')
        req.onsuccess = () => {
          const all = req.result.transaction('notes').objectStore('notes').getAll()
          all.onsuccess = () => resolve(all.result)
        }
      }),
  )
const typeInto = async (page: Page, text: string) => {
  await notes(page).first().dblclick()
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
}

test('dragging the handle up on a note with taller text leaves its measured height right (arrows, +, PDF)', async ({
  page,
}) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 200 })
  await typeInto(page, Array.from({ length: 30 }, (_, i) => `mot${i}`).join(' '))
  await notes(page).first().click()
  const tall = await size(notes(page).first())
  expect(tall.height).toBeGreaterThan(100)
  await dragHandle(page, 0, -50)
  expect((await size(notes(page).first())).height).toBe(tall.height)
  // The bottom + sits below the real bottom edge, not 50px inside the note.
  const box = (await notes(page).first().boundingBox())!
  const plus = (await page.getByRole('button', { name: 'Nouveau post-it en dessous' }).boundingBox())!
  expect(plus.y).toBeGreaterThan(box.y + box.height - 2)
})

test('widening with a slight vertical wobble keeps the automatic height', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 200 })
  await typeInto(page, 'deux lignes de texte ici dans la note')
  await notes(page).first().click()
  await dragHandle(page, 200, 3)
  await expect.poll(async () => (await storedSizes(page))[0].width).toBeGreaterThan(350)
  expect((await storedSizes(page))[0].height).toBeUndefined()
})

test('a click on the handle without moving writes nothing', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 300, y: 200 })
  await notes(page).first().click()
  const before = (await storedRows(page))[0].updatedAt
  await dragHandle(page, 0, 0)
  await page.waitForTimeout(300)
  expect((await storedRows(page))[0].updatedAt).toBe(before)
})

test('with several notes selected there is no resize handle', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 250, y: 200 })
  await createNote(page, { x: 650, y: 200 })
  await notes(page).nth(0).click()
  await expect(resizeHandle(page)).toHaveCount(1)
  // Rubber band over both notes.
  await page.mouse.move(150, 140)
  await page.mouse.down()
  await page.mouse.move(950, 400, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
  await expect(resizeHandle(page)).toHaveCount(0)
})

const duplicateButton = (page: Page) => page.getByRole('button', { name: 'Dupliquer' })

test('⌘D duplicates the selected note: copy is selected, one undo step, redo brings it back', async ({ page }) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type('Insuline')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await byColor(page, 'yellow').click()
  await page.keyboard.press('ControlOrMeta+d')
  await expect(notes(page)).toHaveCount(2)
  await expect(notes(page).filter({ hasText: 'Insuline' })).toHaveCount(2)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  const [a, b] = await Promise.all([notes(page).nth(0).boundingBox(), notes(page).nth(1).boundingBox()])
  expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y)).toBeGreaterThan(20)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(notes(page)).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(notes(page)).toHaveCount(2)
  await expect
    .poll(async () => (await storedNotes(page)).filter((n) => !(n as { deleted?: boolean }).deleted).length)
    .toBe(2)
})

test('the Dupliquer button needs a selection; ⌘D while writing does not duplicate', async ({ page }) => {
  await newBoard(page)
  await expect(duplicateButton(page)).toBeDisabled()
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+d')
  await expect(notes(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await notes(page).first().click()
  await expect(duplicateButton(page)).toBeEnabled()
  await duplicateButton(page).click()
  await expect(notes(page)).toHaveCount(2)
})

test('duplicating two connected notes copies their arrow too', async ({ page }) => {
  await newBoard(page)
  await createNote(page, { x: 250, y: 200 })
  await createNote(page, { x: 650, y: 200 })
  await drawArrow(page, notes(page).nth(0), notes(page).nth(1))
  await page.mouse.move(150, 120)
  await page.mouse.down()
  await page.mouse.move(950, 420, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
  await page.keyboard.press('ControlOrMeta+d')
  await expect(notes(page)).toHaveCount(4)
  await expect(page.locator('.react-flow__edge path.arrow')).toHaveCount(2)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
})

// The clipboard is exercised with synthetic events: no permission prompt, same code path as ⌘C / ⌘V.
const pasteText = (page: Page, text: string) =>
  page.evaluate((t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
const copyEvent = (page: Page) =>
  page.evaluate(() => {
    const data = new DataTransfer()
    const e = new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true })
    document.body.dispatchEvent(e)
    return { text: data.getData('text/plain'), html: data.getData('text/html'), prevented: e.defaultPrevented }
  })

test('copying a selected note puts its whole text on the clipboard', async ({ page }) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type('Insuline')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Hormone hypoglycémiante')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await notes(page).first().click()
  const copied = await copyEvent(page)
  expect(copied).toMatchObject({ text: 'Insuline\nHormone hypoglycémiante', prevented: true })
  expect(copied.html).toContain('Hormone hypoglycémiante')
  // Nothing selected: the event is left alone.
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 450 } })
  expect((await copyEvent(page)).prevented).toBe(false)
})

test('pasting with nothing focused makes a note in the middle of the view, selected, one undo step', async ({
  page,
}) => {
  await newBoard(page)
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 450 } }) // focus on nothing
  await pasteText(page, 'Ferritine basse\nCarence martiale')
  await expect(notes(page)).toHaveCount(1)
  await expect(notes(page).first()).toContainText('Carence martiale')
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  const box = (await notes(page).first().boundingBox())!
  const flow = (await page.locator('.board-flow').boundingBox())!
  expect(Math.abs(box.x + box.width / 2 - (flow.x + flow.width / 2))).toBeLessThan(40)
  expect(Math.abs(box.y + box.height / 2 - (flow.y + flow.height / 2))).toBeLessThan(80)
  // Pasting again does not stack the new note exactly on the first one.
  await pasteText(page, 'Deuxième')
  await expect(notes(page)).toHaveCount(2)
  const [a, b] = await Promise.all([notes(page).nth(0).boundingBox(), notes(page).nth(1).boundingBox()])
  expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y)).toBeGreaterThan(20)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(notes(page)).toHaveCount(1)
})

test('paste while writing in a note, or an empty paste, makes no note', async ({ page }) => {
  await newBoard(page)
  await pasteText(page, '   ')
  await expect(notes(page)).toHaveCount(0)
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(editor(page)).toBeFocused()
  await editor(page).evaluate((el, t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, 'dans la note')
  await page.keyboard.press('Escape')
  await expect(notes(page)).toHaveCount(1)
})
