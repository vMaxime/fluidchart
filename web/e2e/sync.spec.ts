import { test, expect } from './fixtures'

test('a board and a note made in one browser show up in another, and the badge settles', async ({ page, browser }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.getByRole('textbox', { name: 'Nom de la carte' })).toBeFocused()
  await page.keyboard.type('Partagée')
  await page.keyboard.press('Enter')
  await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 250 } })
  await expect(page.getByRole('textbox', { name: 'Texte du post-it' })).toBeFocused()
  await page.keyboard.type('Insuline')
  await page.keyboard.press('Escape')
  await expect(page.getByText('Synchronisé')).toBeVisible({ timeout: 10_000 })

  const other = await browser.newContext({ storageState: 'e2e/.auth/state.json' })
  const second = await other.newPage()
  await second.goto('/')
  const row = second.getByTestId('board').filter({ hasText: 'Partagée' })
  await expect(row).toBeVisible()
  await row.click()
  await expect(second.getByTestId('note')).toContainText('Insuline')
  await other.close()
})
