import { resolve } from 'node:path'

export type Config = {
  pin: string
  port: number
  dataDir: string
  staticDir: string
  cookieSecure: boolean
  trustProxy: boolean
  e2eReset: boolean
  /** Bearer token of the board API (/api/v1); null = API disabled. */
  apiToken: string | null
}

/** Reads the server environment; throws a readable error instead of starting misconfigured. */
export function readConfig(env: Record<string, string | undefined>): Config {
  const pin = env.APP_PIN ?? ''
  if (!/^\d{4}$/.test(pin)) throw new Error('APP_PIN doit contenir exactement 4 chiffres (variable d’environnement).')
  const e2eReset = env.E2E_RESET === '1'
  if (e2eReset && env.NODE_ENV === 'production') throw new Error('E2E_RESET=1 est interdit en production.')
  const apiToken = env.API_TOKEN || null
  if (apiToken !== null && apiToken.length < 32)
    throw new Error('API_TOKEN doit contenir au moins 32 caractères (ex. : openssl rand -hex 32).')
  return {
    pin,
    port: Number(env.PORT ?? 8787),
    dataDir: resolve(env.DATA_DIR ?? './data'),
    staticDir: resolve(env.STATIC_DIR ?? '../web/dist'),
    cookieSecure: env.COOKIE_SECURE !== '0',
    trustProxy: env.TRUST_PROXY === '1',
    e2eReset,
    apiToken,
  }
}
