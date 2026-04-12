import 'dotenv/config'
import { runMigrations } from './core/db/runMigrations'
import { buildApp } from './app'

async function start() {
  runMigrations()

  const app = await buildApp()

  const PORT = Number(process.env.PORT) || 3000

  await app.listen({
    port: PORT,
    host: '0.0.0.0',
  })
}

start()