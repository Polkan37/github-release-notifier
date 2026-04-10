import Fastify from 'fastify'
import { subscriptionRoutes } from './modules/subscription/subscription.routes'

export function buildApp() {
  const app = Fastify()

  app.register(subscriptionRoutes);

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}