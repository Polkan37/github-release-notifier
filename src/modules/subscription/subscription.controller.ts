import { SubscriptionService } from './subscription.service'

const service = new SubscriptionService()

export class SubscriptionController {
  async subscribe(request: any, reply: any) {
    const { email, repository } = request.body

    try {
      const result = await service.createSubscription(email, repository)

      return reply.code(201).send({
        message: 'Subscription created. Please confirm your email.',
        data: result,
      })
    } catch (e: any) {
      if (e.message === 'Invalid repository format') {
        return reply.code(400).send({ error: e.message })
      }

      if (e.message === 'Repository not found') {
        return reply.code(404).send({ error: e.message })
      }

      if (e.message === 'Already subscribed') {
        return reply.code(409).send({ error: e.message })
      }

      return reply.code(500).send({ error: 'Internal error' })
    }
  }

  async confirm(request: any, reply: any) {
    const { token } = request.params

    try {
      await service.confirmSubscription(token)

      return reply.send({ message: 'Subscription confirmed' })
    } catch {
      return reply.code(400).send({ error: 'Invalid token' })
    }
  }

  async unsubscribe(request: any, reply: any) {
    const { token } = request.params

    try {
      await service.unsubscribe(token)

      return reply.send({ message: 'Unsubscribed successfully' })
    } catch {
      return reply.code(400).send({ error: 'Invalid token' })
    }
  }

  async getSubscriptions(request: any, reply: any) {
    const { email } = request.query

    if (!email) {
      return reply.code(400).send({ error: 'Email is required' })
    }

    const subs = await service.getSubscriptions(email)

    return reply.send({ data: subs })
  }
}