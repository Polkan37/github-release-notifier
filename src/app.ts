import Fastify from 'fastify'
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

  return app
}