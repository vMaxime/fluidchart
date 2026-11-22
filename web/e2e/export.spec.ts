import { test, expect, type Locator, type Page } from './fixtures'

const TOKEN = 'e2e-fake-token-0123456789abcdef01234567'

// window.print is replaced by a counter: the test plays the role of the print dialog.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __prints: number }
    w.__prints = 0
    window.print = () => void w.__prints++
  })
})
const prints = (page: Page) => page.evaluate(() => (window as unknown as { __prints: number }).__prints)
/** The @page rule in force (Playwright text matchers skip <style> contents). */
const pageRuleText = (page: Page) => page.locator('style[data-print-page]').evaluate((el) => el.textContent ?? '')
const closeDialog = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
const exportAs = async (page: Page, format: 'Format révision' | 'Format imprimante') => {
  await page.getByRole('button', { name: 'Exporter en PDF' }).click()
  await page.getByRole('menuitem', { name: new RegExp(format) }).click()
}
/** Pages of a Chromium PDF and the size of the first one, in points. */
const pdfPages = (pdf: Buffer) => {
  const text = pdf.toString('latin1')
  const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)!
  return { count: text.match(/\/Type\s*\/Page\b/g)!.length, width: Number(box[1]), height: Number(box[2]) }
}

const notes = (page: Page) => page.getByTestId('note')
const editor = (page: Page) => page.getByRole('textbox', { name: 'Texte du post-it' })
async function newBoard(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await page.getByRole('textbox', { name: 'Nom de la carte' }).fill(name)
  await page.keyboard.press('Enter')
}
async function createNote(page: Page, position: { x: number; y: number }, text: string) {
  await page.locator('.react-flow__pane').dblclick({ position })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
}
const center = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

test('revision export: print is called once with the board on a single board-sized page; afterprint cleans up', async ({
  page,
  browserName,
}) => {
  await newBoard(page, 'Hémato')
  await createNote(page, { x: 250, y: 200 }, 'Anémie')
  await createNote(page, { x: 650, y: 200 }, 'Ferritine')
  await page.keyboard.press('a')
  const [a, b] = [await center(notes(page).nth(0)), await center(notes(page).nth(1))]
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
  const before = await page.title()

  await exportAs(page, 'Format révision')
  await expect.poll(() => prints(page)).toBe(1)
  const root = page.locator('.print-root')
  await expect(root.locator('.print-page')).toHaveCount(1)
  await expect(root.locator('.print-note')).toHaveCount(2)
  await expect(root.locator('path.print-arrow')).toHaveCount(1)
  await expect(page).toHaveTitle('Hémato')
  const adjust = await root
    .locator('.print-note')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return s.getPropertyValue('print-color-adjust') || s.getPropertyValue('-webkit-print-color-adjust')
    })
  expect(adjust).toBe('exact')

  if (browserName === 'chromium') {
    // Hidden on screen: read the page size from its inline style.
    const page1 = await root
      .locator('.print-page')
      .evaluate((el: HTMLElement) => ({ width: parseFloat(el.style.width), height: parseFloat(el.style.height) }))
    const pdf = pdfPages(await page.pdf({ preferCSSPageSize: true }))
    expect(pdf.count).toBe(1)
    expect(pdf.width).toBeCloseTo(Math.ceil(page1.width) * 0.75, 0)
    expect(pdf.height).toBeCloseTo(Math.ceil(page1.height) * 0.75, 0)
  }

  await closeDialog(page)
  await expect(root).toHaveCount(0)
  await expect(page.locator('style[data-print-page]')).toHaveCount(0)
  await expect(page).toHaveTitle(before)
})

test('printer export of a big board: numbered A4 pages, as many PDF pages as tiles', async ({
  page,
  request,
  browserName,
}) => {
  const res = await request.post('/api/v1/boards', {
    headers: { Authorization: `Bearer ${TOKEN}` },
    data: {
      name: 'Large',
      notes: [
        { id: 'a', html: 'Anémie', x: 0, y: 0 },
        { id: 'b', html: 'Carence martiale', x: 1800, y: 0 },
        { id: 'c', html: 'Ferritine basse', x: 3600, y: 1500 },
      ],
      arrows: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c', color: 'red' },
      ],
    },
  })
  expect(res.status()).toBe(201)
  const { id } = (await res.json()) as { id: string }
  await page.goto(`/b/${id}`)
  await expect(notes(page)).toHaveCount(3)

  await exportAs(page, 'Format imprimante')
  await expect.poll(() => prints(page)).toBe(1)
  const pages = page.locator('.print-root .print-page')
  // 3800 × 1564 px at the 8pt scale: 3 columns × 2 rows of landscape A4.
  await expect(pages).toHaveCount(6)
  await expect(page.locator('.print-root .print-footer')).toHaveText([1, 2, 3, 4, 5, 6].map((i) => `Large · ${i} / 6`))
  expect(await pageRuleText(page)).toContain('A4 landscape')

  if (browserName === 'chromium') {
    const pdf = pdfPages(await page.pdf({ preferCSSPageSize: true }))
    // A page Chrome shrinks (content judged too wide) also spills onto an extra blank page.
    expect(pdf.count).toBe(6)
    expect([pdf.width, pdf.height].map(Math.round)).toEqual([842, 595])
  }
})

test('exporting right after typing includes the last text', async ({ page }) => {
  await newBoard(page, 'Fer')
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type('Ferritine')
  await exportAs(page, 'Format révision')
  await expect(page.locator('.print-root')).toContainText('Ferritine')
})

test('two exports in a row leave one print document', async ({ page }) => {
  await newBoard(page, 'Deux')
  await createNote(page, { x: 300, y: 200 }, 'Une')
  await exportAs(page, 'Format révision')
  await exportAs(page, 'Format imprimante')
  await expect.poll(() => prints(page)).toBe(2)
  await expect(page.locator('.print-root')).toHaveCount(1)
  await expect(page.locator('style[data-print-page]')).toHaveCount(1)
  expect(await pageRuleText(page)).toContain('A4')
})

test('the button is disabled on an empty board', async ({ page }) => {
  await newBoard(page, 'Vide')
  await expect(page.getByRole('button', { name: 'Exporter en PDF' })).toBeDisabled()
})

test('⌘P without an export prints the app as before, not a blank page', async ({ page }) => {
  await newBoard(page, 'Imprimer')
  await createNote(page, { x: 300, y: 200 }, 'Visible')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#root')).not.toHaveCSS('display', 'none')
  await expect(page.getByTestId('note')).toBeVisible()
})

test('an export left without afterprint is cleaned up by the next click; renaming meanwhile does not print again', async ({
  page,
}) => {
  await newBoard(page, 'Sans fin')
  await createNote(page, { x: 300, y: 200 }, 'Une')
  const before = await page.title()
  await exportAs(page, 'Format révision')
  await expect.poll(() => prints(page)).toBe(1)
  await page.getByRole('textbox', { name: 'Nom de la carte' }).fill('Renommée')
  await page.keyboard.press('Enter')
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 400 } })
  await expect(page.locator('.print-root')).toHaveCount(0)
  await expect(page.locator('style[data-print-page]')).toHaveCount(0)
  expect(await prints(page)).toBe(1)
  await expect(page).not.toHaveTitle('Sans fin')
  expect(before).not.toBe('Sans fin')
})

test('a resized note keeps its size in the PDF export', async ({ page }) => {
  await newBoard(page, 'Grande')
  await createNote(page, { x: 300, y: 200 }, 'Large')
  await notes(page).first().click()
  const small = (await notes(page).first().boundingBox())!
  const handle = (await page.locator('.react-flow__resize-control').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + 160, handle.y + 110, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => (await notes(page).first().boundingBox())!.width).toBeGreaterThan(300)

  await exportAs(page, 'Format révision')
  const printed = await page
    .locator('.print-root .print-note')
    .evaluate((el: HTMLElement) => ({ width: parseFloat(el.style.width), height: parseFloat(el.style.height) }))
  const now = (await notes(page).first().boundingBox())!
  expect(Math.abs(printed.width - now.width)).toBeLessThan(2)
  expect(Math.abs(printed.height - now.height)).toBeLessThan(2)
  expect(printed.height).toBeGreaterThan(small.height + 80)
})

test('after dragging the handle up on a tall note, the printed box still holds its text', async ({ page }) => {
  await newBoard(page, 'Haute')
  await createNote(page, { x: 300, y: 200 }, 'x')
  await notes(page).first().dblclick()
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(Array.from({ length: 30 }, (_, i) => `mot${i}`).join(' '))
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await notes(page).first().click()
  const tall = (await notes(page).first().boundingBox())!
  const handle = (await page.locator('.react-flow__resize-control').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 50, { steps: 10 })
  await page.mouse.up()
  await exportAs(page, 'Format révision')
  const printed = await page
    .locator('.print-root .print-note')
    .evaluate((el: HTMLElement) => parseFloat(el.style.height))
  expect(printed).toBeGreaterThanOrEqual(Math.floor(tall.height))
})
