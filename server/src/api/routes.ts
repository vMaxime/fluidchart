import { createHash, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import type { Config } from '../config'
import { listBoards } from './boards'

const digest = (s: string) => createHash('sha256').update(s).digest()

/** Constant-time comparison (hashing first makes the lengths equal). */
function sameToken(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected))
}

/** The origin the client used: behind a trusted proxy, its scheme comes from X-Forwarded-Proto. */
export function publicOrigin(c: Context, config: Config): string {
  const url = new URL(c.req.url)
  const forwarded = config.trustProxy ? c.req.header('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
  const proto = forwarded || url.protocol.replace(/:$/, '')
  return `${proto}://${c.req.header('host') ?? url.host}`
}

/** The board API for an AI or a script, authenticated by API_TOKEN (never by the PIN or the session). */
export function createApiRoutes({ db, config }: { db: DatabaseSync; config: Config }) {
  const api = new Hono()

  const requireToken: MiddlewareHandler = async (c, next) => {
    if (!config.apiToken) return c.json({ error: 'api disabled' }, 503)
    const given = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!given || !sameToken(given, config.apiToken)) return c.json({ error: 'unauthorized' }, 401)
    await next()
  }
  api.use('/boards', requireToken)
  api.use('/boards/*', requireToken)

  api.get('/boards', (c) => c.json(listBoards(db)))

  return api
}
