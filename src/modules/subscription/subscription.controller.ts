import { FastifyReply, FastifyRequest } from 'fastify'
import { SubscriptionService } from './subscription.service'
import { SubscribeBody, TokenParams, SubscriptionsQuery, SubscriptionResponse, ServiceError } from './types'

const service = new SubscriptionService()

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ---- Controller ----
export class SubscriptionController {
  async subscribe(
    request: FastifyRequest<{ Body: SubscribeBody }>,
    reply: FastifyReply
  ) {
    const { email, repo } = request.body

    if (!email || !repo || !isValidEmail(email)) {
      return reply.code(400).send({ message: 'Unexpected error' })
    }

    try {
      await service.createSubscription(email, repo)
      return reply.code(200).send()
    } catch (e: unknown) {
      if (e instanceof Error) {
        const message = e.message as ServiceError

        if (message === 'Invalid repository format') {
          return reply.code(400).send({ message })
        }

        if (message === 'Repository not found') {
          return reply.code(404).send({ message})
        }

        if (message === 'Already subscribed') {
          return reply.code(409).send({ message})
        }
      }

      return reply.code(400).send({ message: 'Unexpected error' })
    }
  }

  async confirm(
    request: FastifyRequest<{ Params: TokenParams }>,
    reply: FastifyReply
  ) {
    const { token } = request.params

    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ message: 'Unexpected error' })
    }

    const found = await service.confirmSubscription(token)

    if (!found) {
      return reply.code(404).send({ message: 'Subscription not found' })
    }

    return reply.code(200).send()
  }

  async unsubscribe(
    request: FastifyRequest<{ Params: TokenParams }>,
    reply: FastifyReply
  ) {
    const { token } = request.params

    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ message: 'Unexpected error' })
    }

    const found = await service.unsubscribe(token)

    if (!found) {
      return reply.code(404).send({ message: 'Subscription not found' })
    }

    return reply.code(200).send()
  }

  async getSubscriptions(
    request: FastifyRequest<{ Querystring: SubscriptionsQuery }>,
    reply: FastifyReply
  ) {
    const email = request.query.email.trim()

    if (!email || !isValidEmail(email)) {
      return reply.code(400).send({ message: 'Invalid email format' })
    }

    const subs = await service.getSubscriptions(email)

    const response: SubscriptionResponse[] = subs.map((s) => ({
      email: s.email,
      repo: s.repo,
      confirmed: s.confirmed,
      last_seen_tag: s.lastSeenTag,
    }))

    return reply.code(200).send(response)
  }
}