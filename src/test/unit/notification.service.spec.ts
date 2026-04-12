import { NotificationService, RateLimitError } from '../../modules/notification/notification.service'
import { prisma } from '../../core/db/prisma'
import { MailClient } from '../../integrations/mail/mail.client'
import { NotificationStatus, SubscriptionStatus } from '@prisma/client'

// ---------------- MOCKS ----------------

jest.mock('../../core/db/prisma', () => ({
  prisma: {
    notification: {
      update: jest.fn(),
    },
  },
}))

let sendMock!: jest.Mock

jest.mock('../../integrations/mail/mail.client', () => {
  return {
    MailClient: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
  }
})

// ---------------- HELPERS ----------------

type Job = {
  id: number
  tag: string
  attempts: number
  subscription: {
    email: string
    status: SubscriptionStatus
    unsubscribeToken: string
  }
  repository: {
    fullName: string
  }
}

const createJob = (overrides: Partial<Job> = {}): Job => ({
  id: 1,
  tag: 'v1.0.0',
  attempts: 0,
  subscription: {
    email: 'test@mail.com',
    status: SubscriptionStatus.ACTIVE,
    unsubscribeToken: 'token',
  },
  repository: {
    fullName: 'facebook/react',
  },
  ...overrides,
})

// ---------------- TESTS ----------------

describe('NotificationService', () => {
  let service: NotificationService

    beforeEach(() => {
    sendMock = jest.fn()
    jest.clearAllMocks()
    service = new NotificationService()
    })

  it('should mark failed if subscription inactive', async () => {
    const job = createJob({
      subscription: {
        email: 'test@mail.com',
        status: SubscriptionStatus.UNSUBSCRIBED,
        unsubscribeToken: 'token',
      },
    })

    await service.processNotification(
      job as Parameters<NotificationService['processNotification']>[0]
    )

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: NotificationStatus.FAILED,
        error: 'Inactive subscription',
      },
    })
  })

  it('should send email and mark SENT', async () => {
    sendMock.mockResolvedValue(undefined)

    const job = createJob()

    await service.processNotification(
      job as Parameters<NotificationService['processNotification']>[0]
    )

    expect(sendMock).toHaveBeenCalled()

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        error: null,
      },
    })
  })

  it('should handle rate limit and set backoff', async () => {
    sendMock.mockRejectedValue({
      responseCode: 454,
    })

    const job = createJob()

    await expect(
      service.processNotification(
        job as Parameters<NotificationService['processNotification']>[0]
      )
    ).rejects.toThrow(RateLimitError)

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: NotificationStatus.PENDING,
        error: 'RATE_LIMIT',
      },
    })

    expect(service.getBackoffUntil()).not.toBeNull()
  })

  it('should retry if attempts < MAX_ATTEMPTS', async () => {
    sendMock.mockRejectedValue(new Error('fail'))

    const job = createJob({ attempts: 1 })

    await service.processNotification(
      job as Parameters<NotificationService['processNotification']>[0]
    )

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: NotificationStatus.PENDING,
        attempts: 2,
        error: 'fail',
      },
    })
  })

  it('should fail if attempts >= MAX_ATTEMPTS', async () => {
    sendMock.mockRejectedValue(new Error('fail'))

    const job = createJob({ attempts: 2 })

    await service.processNotification(
      job as Parameters<NotificationService['processNotification']>[0]
    )

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: NotificationStatus.FAILED,
        attempts: 3,
        error: 'fail',
      },
    })
  })

  it('should skip run during backoff', () => {
    service.registerRateLimit(1000)

    expect(service.shouldSkipRun(1001)).toBe(true)
    expect(service.shouldSkipRun(999999999)).toBe(false)
  })

  it('should reset backoff', () => {
    service.registerRateLimit()
    service.resetBackoff()

    expect(service.getBackoffUntil()).toBeNull()
  })

  it('should detect rate limit by message', async () => {
    sendMock.mockRejectedValue(new Error('Too many requests'))

    const job = createJob()

    await expect(
      service.processNotification(
        job as Parameters<NotificationService['processNotification']>[0]
      )
    ).rejects.toThrow(RateLimitError)
  })

  it('should fallback to unknown error message', async () => {
    sendMock.mockRejectedValue({})

    const job = createJob()

    await service.processNotification(
      job as Parameters<NotificationService['processNotification']>[0]
    )

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        error: 'Unknown error',
      }),
    })
  })
})