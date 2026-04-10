import { FastifyInstance } from 'fastify'
import { SubscriptionController } from './subscription.controller'

const controller = new SubscriptionController()

export async function subscriptionRoutes(app: FastifyInstance) {
  // POST /api/subscribe
  app.post('/api/subscribe', controller.subscribe.bind(controller))

  // GET /api/confirm/{token}
  app.get('/api/confirm/:token', controller.confirm.bind(controller))

  // GET /api/unsubscribe/{token}
  app.get('/api/unsubscribe/:token', controller.unsubscribe.bind(controller))

  // GET /api/subscriptions?email=
  app.get('/api/subscriptions', controller.getSubscriptions.bind(controller))
}