import { execSync } from 'child_process'

export function runMigrations() {
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  } catch (e) {
    console.error('Migration failed', e)
    process.exit(1)
  }
}