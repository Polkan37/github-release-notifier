import 'dotenv/config'
import { runMigrations } from './core/db/runMigrations'
import { buildApp } from './app'

async function start() {
  runMigrations()

  const app = await buildApp()

  await app.listen({ port: Number(process.env.PORT) || 3000 })
}

start()