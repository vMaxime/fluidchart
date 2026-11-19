import { createHash, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import type { Config } from '../config'
import { createBoard, listBoards, readBoard } from './boards'
import { openApiDocument } from './openapi'
import { BoardInputSchema } from './schema'

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

  // Public: the document holds no secret, and it is what one hands to an AI.
  api.get('/openapi.json', (c) => c.json(openApiDocument(publicOrigin(c, config))))

  api.get('/boards', (c) => c.json(listBoards(db)))

  api.post('/boards', async (c) => {
    const invalid = Symbol()
    const body: unknown = await c.req.json().catch(() => invalid)
    if (body === invalid) return c.json({ error: 'invalid json' }, 400)
    const parsed = BoardInputSchema.safeParse(body)
    if (!parsed.success)
      return c.json(
        {
          error: 'invalid board',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400,
      )
    return c.json(createBoard(db, parsed.data, Date.now(), publicOrigin(c, config)), 201)
  })

  api.get('/boards/:id', (c) => {
    const board = readBoard(db, c.req.param('id'), publicOrigin(c, config))
    return board ? c.json(board) : c.json({ error: 'not found' }, 404)
  })

  return api
}
