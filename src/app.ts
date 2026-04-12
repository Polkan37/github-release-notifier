import Fastify from 'fastify'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import { subscriptionRoutes } from './modules/subscription/subscription.routes'
import { startScanner } from './core/scheduler/scanner'
import { startNotifier } from './modules/notification/notification.worker'

export function buildApp() {
  const app = Fastify()

  app.register(subscriptionRoutes);

  startScanner()
  startNotifier()

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  })

  return app
}