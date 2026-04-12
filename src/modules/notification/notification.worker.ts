import cron from 'node-cron'
import { Prisma, NotificationStatus } from '@prisma/client'
import { prisma } from '../../core/db/prisma'
import { NotificationService, RateLimitError } from './notification.service'

const pLimit = require('p-limit').default;

const BATCH_SIZE = 50
const CONCURRENCY = 3

type NotificationJob = Prisma.NotificationGetPayload<{
  include: {
    subscription: true
    repository: true
  }
}>

const notificationService = new NotificationService()

export function startNotifier(): void {
  cron.schedule('* * * * *', async () => {
    if (notificationService.shouldSkipRun()) {
      return
    }

    try {
      const jobs = await prisma.notification.findMany({
        where: {
          status: NotificationStatus.PENDING,
        },
        take: BATCH_SIZE,
        orderBy: {
          createdAt: 'asc',
        },
        include: {
          subscription: true,
          repository: true,
        },
      })

      if (jobs.length === 0) {
        return
      }

      const limit = pLimit(CONCURRENCY)

      for (const job of jobs) {
        try {
          await limit(() => notificationService.processNotification(job as NotificationJob))
        } catch (error) {
          if (error instanceof RateLimitError) {
            console.warn(
              `Mail rate limit hit. Backoff until: ${new Date(
                notificationService.getBackoffUntil() ?? Date.now()
              ).toISOString()}`
            )
            return
          }

          console.warn(`Failed to process notification ${job.id}`, error)
        }
      }
    } catch (error) {
      console.warn('Notifier worker failed', error)
    }
  })
}