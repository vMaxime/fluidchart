import { request, type FullConfig } from '@playwright/test'

/** Signs in once (test PIN) and saves the session cookie for every test. */
export default async function globalSetup(config: FullConfig) {
  const ctx = await request.newContext({ baseURL: config.projects[0].use.baseURL })
  const res = await ctx.post('/api/login', { data: { pin: '2468' } })
  const body = await res.json()
  if (!body.ok) throw new Error(`E2E login failed: ${JSON.stringify(body)}`)
  await ctx.storageState({ path: 'e2e/.auth/state.json' })
  await ctx.dispose()
}
