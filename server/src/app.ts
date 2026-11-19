import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { getCookie, setCookie } from 'hono/cookie'
import { getConnInfo } from '@hono/node-server/conninfo'
import { serveStatic } from '@hono/node-server/serve-static'
import { isEntityChange, type SyncRequest } from '@chart/shared'
import type { createAuth } from './auth'
import type { Config } from './config'
import { resetServerId } from './db'
import { applyChanges, changesSince, serverId } from './store'
import { createApiRoutes } from './api/routes'

const COOKIE = 'chart_session'
const YEAR_S = 365 * 24 * 3600

export function createApp({
  db,
  auth,
  config,
}: {
  db: DatabaseSync
  auth: ReturnType<typeof createAuth>
  config: Config
}) {
  const app = new Hono()

  /** The client IP: the socket, or the proxy's X-Forwarded-For only when the proxy is trusted. */
  const ipOf = (c: Context) => {
    if (config.trustProxy) {
      const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      if (forwarded) return forwarded
    }
    try {
      return getConnInfo(c).remote.address ?? 'unknown'
    } catch {
      return 'unknown' // no socket (in-process requests in tests)
    }
  }
  const signedIn = (c: Context) => auth.checkSession(getCookie(c, COOKIE))

  app.use('/api/*', bodyLimit({ maxSize: 5 * 1024 * 1024, onError: (c) => c.json({ error: 'too large' }, 413) }))
  // JSON-only POSTs: with SameSite=Lax cookies this shuts out cross-site form posts.
  app.use('/api/*', async (c, next) => {
    if (c.req.method === 'POST' && !c.req.header('content-type')?.startsWith('application/json'))
      return c.json({ error: 'json only' }, 415)
    await next()
  })

  app.post('/api/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { pin?: unknown } | null
    if (typeof body?.pin !== 'string') return c.json({ error: 'pin required' }, 400)
    const { result, token } = auth.attempt(ipOf(c), body.pin)
    if (token)
      setCookie(c, COOKIE, token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: YEAR_S,
        secure: config.cookieSecure,
      })
    return c.json(result)
  })

  app.get('/api/session', (c) => c.body(null, signedIn(c) ? 204 : 401))

  app.post('/api/sync', async (c) => {
    if (!signedIn(c)) return c.body(null, 401)
    const body = (await c.req.json().catch(() => null)) as Partial<SyncRequest> | null
    if (typeof body?.cursor !== 'number' || !Array.isArray(body.changes) || !body.changes.every(isEntityChange))
      return c.json({ error: 'invalid sync request' }, 400)
    const rejected = applyChanges(db, body.changes)
    const since = changesSince(db, body.cursor)
    const seen = new Set(since.changes.map((ch) => `${ch.kind}:${ch.row.id}`))
    const winners = rejected.filter((ch) => !seen.has(`${ch.kind}:${ch.row.id}`))
    return c.json({ cursor: since.cursor, changes: [...since.changes, ...winners], serverId: serverId(db) })
  })

  if (config.e2eReset)
    app.post('/api/test/reset', (c) => {
      db.exec("DELETE FROM entities; DELETE FROM login_failures; UPDATE meta SET value = 0 WHERE key = 'seq';")
      resetServerId(db)
      return c.body(null, 204)
    })

  app.route('/api/v1', createApiRoutes({ db, config }))

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

  // The web app: static files, then index.html for client-side routes (/b/:id …).
  app.use('/*', serveStatic({ root: config.staticDir }))
  app.get('*', async (c) => {
    const html = await readFile(join(config.staticDir, 'index.html'), 'utf8').catch(() => null)
    return html ? c.html(html) : c.notFound()
  })

  return app
}
