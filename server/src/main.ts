import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createAuth } from './auth'
import { readConfig, type Config } from './config'
import { openDb } from './db'

let config: Config
try {
  config = readConfig(process.env)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
mkdirSync(config.dataDir, { recursive: true })
const db = openDb(join(config.dataDir, 'chart.db'))
const app = createApp({ db, auth: createAuth(db, { pin: config.pin }), config })
serve({ fetch: app.fetch, port: config.port }, (info) => console.log(`Chart écoute sur le port ${info.port}`))
