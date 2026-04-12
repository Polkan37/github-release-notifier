import { Prisma, NotificationStatus, SubscriptionStatus } from '@prisma/client'
import { prisma } from '../../core/db/prisma'
import { MailClient } from '../../integrations/mail/mail.client'
import { releaseTemplate } from './templates/release'

const MAX_ATTEMPTS = 3
const INITIAL_BACKOFF_MS = 60 * 60 * 1000 // 1 hour
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000 // 24 hours

type NotificationJob = Prisma.NotificationGetPayload<{
  include: {
    subscription: true
    repository: true
  }
}>

export class RateLimitError extends Error {
  constructor(message = 'Mail provider rate limit reached') {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class NotificationService {
  constructor(private mail = new MailClient()) { }

  private backoffUntil: number | null = null
  private backoffMs = INITIAL_BACKOFF_MS

  shouldSkipRun(now = Date.now()): boolean {
    return this.backoffUntil !== null && now < this.backoffUntil
  }

  getBackoffUntil(): number | null {
    return this.backoffUntil
  }

  resetBackoff(): void {
    this.backoffUntil = null
    this.backoffMs = INITIAL_BACKOFF_MS
  }

  registerRateLimit(now = Date.now()): void {
    this.backoffUntil = now + this.backoffMs
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
  }

  async processNotification(job: NotificationJob): Promise<void> {
    if (job.subscription.status !== SubscriptionStatus.ACTIVE) {
      await this.markFailed(job.id, 'Inactive subscription')
      return
    }

    try {
      const html = releaseTemplate(
        job.repository.fullName,
        job.tag,
        job.subscription.unsubscribeToken
      )

      await this.mail.send({
        to: job.subscription.email,
        subject: `New release: ${job.repository.fullName}`,
        html,
      })

      await prisma.notification.update({
        where: { id: job.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          error: null,
        },
      })
    } catch (error: unknown) {
      if (this.isRateLimitError(error)) {
        await prisma.notification.update({
          where: { id: job.id },
          data: {
            status: NotificationStatus.PENDING,
            error: 'RATE_LIMIT',
          },
        })

        this.registerRateLimit()
        throw new RateLimitError()
      }

      await this.retryOrFail(job, error)
    }
  }

  private async retryOrFail(job: NotificationJob, error: unknown): Promise<void> {
    const attempts = job.attempts + 1
    const message = this.getErrorMessage(error)

    await prisma.notification.update({
      where: { id: job.id },
      data: {
        status:
          attempts >= MAX_ATTEMPTS
            ? NotificationStatus.FAILED
            : NotificationStatus.PENDING,
        attempts,
        error: message,
      },
    })
  }

  private async markFailed(id: number, error: string): Promise<void> {
    await prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        error,
      },
    })
  }

  private isRateLimitError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false

    const err = error as {
      responseCode?: number
      code?: string
      message?: string
      response?: string
    }

    const message = err.message?.toLowerCase?.() || ''
    const response = err.response?.toLowerCase?.() || ''

    return (
      err.responseCode === 454 ||
      err.responseCode === 421 ||
      err.code === 'EENVELOPE' ||
      message.includes('rate limit') ||
      message.includes('too many') ||
      response.includes('limit')
    )
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Unknown error'
  }
}