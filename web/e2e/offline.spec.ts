import { test, expect } from './fixtures'

test('app opens and works offline after a first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service worker offline emulation: Chromium only')
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/) // navigation happens after the board is stored
  const boardUrl = page.url()
  await context.setOffline(true)
  await page.goto(boardUrl)
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('Sans titre')).toBeVisible()
})
