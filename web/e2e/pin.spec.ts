import { test, expect } from './fixtures'

test.use({ storageState: { cookies: [], origins: [] } }) // a brand-new device

test('a new device sees the keypad; a wrong code shows the cooldown; the right code opens the list', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Entrez votre code' })).toBeVisible()
  await expect(page.getByLabel("Code d'accès")).toBeFocused()
  await page.keyboard.type('1111')
  await expect(page.getByRole('alert')).toContainText('Code incorrect. Nouvel essai dans')
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeEnabled({ timeout: 6000 })
  await page.keyboard.type('2468')
  await expect(page.getByRole('heading', { name: 'Cartes' })).toBeVisible()
})
