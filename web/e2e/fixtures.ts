import { test as base } from '@playwright/test'

/** Every test starts from an empty server database. */
export const test = base.extend<{ resetServer: void }>({
  resetServer: [
    async ({ request }, use) => {
      const res = await request.post('/api/test/reset', { data: {} })
      if (res.status() !== 204) throw new Error(`reset failed: ${res.status()}`)
      await use()
    },
    { auto: true },
  ],
})
export { expect } from '@playwright/test'
export type { Locator, Page } from '@playwright/test'
