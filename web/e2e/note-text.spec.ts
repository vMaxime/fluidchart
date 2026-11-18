import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 200 } })
  // The editor mounts once the new note is stored: wait for focus before typing.
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
})

test('typed text survives a reload without leaving the note', async ({ page }) => {
  await page.keyboard.type('Insuline')
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByTestId('note')).toContainText('Insuline')
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
