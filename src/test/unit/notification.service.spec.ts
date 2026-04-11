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

jest.mock('../../integrations/mail/mail.client', () => {
    return {
        MailClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(),
        })),
    }
})

// ---------------- HELPERS ----------------

const createJob = (overrides: any = {}) => ({
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
    let mailMock: jest.Mocked<MailClient>

    beforeEach(() => {
        service = new NotificationService()

        mailMock = (MailClient as jest.Mock).mock.results[0].value

        jest.clearAllMocks()
    })

    // -------- inactive subscription --------

    it('should mark failed if subscription inactive', async () => {
        const job = createJob({
            subscription: { status: SubscriptionStatus.UNSUBSCRIBED },
        })

        await service.processNotification(job as any)

        expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                status: NotificationStatus.FAILED,
                error: 'Inactive subscription',
            },
        })
    })

    // -------- success --------

    it('should send email and mark SENT', async () => {
        mailMock.send.mockResolvedValue(undefined)

        const job = createJob()

        await service.processNotification(job as any)

        expect(mailMock.send).toHaveBeenCalled()

        expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                status: NotificationStatus.SENT,
                sentAt: expect.any(Date),
                error: null,
            },
        })
    })

    // -------- rate limit --------

    it('should handle rate limit and set backoff', async () => {
        mailMock.send.mockRejectedValue({
            responseCode: 454,
        })

        const job = createJob()

        await expect(service.processNotification(job as any))
            .rejects.toThrow(RateLimitError)

        expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                status: NotificationStatus.PENDING,
                error: 'RATE_LIMIT',
            },
        })

        expect(service.getBackoffUntil()).not.toBeNull()
    })

    // -------- retry logic --------

    it('should retry if attempts < MAX_ATTEMPTS', async () => {
        mailMock.send.mockRejectedValue(new Error('fail'))

        const job = createJob({ attempts: 1 })

        await service.processNotification(job as any)

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
        mailMock.send.mockRejectedValue(new Error('fail'))

        const job = createJob({ attempts: 2 })

        await service.processNotification(job as any)

        expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                status: NotificationStatus.FAILED,
                attempts: 3,
                error: 'fail',
            },
        })
    })

    // -------- backoff logic --------

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

    // -------- error parsing --------

    it('should detect rate limit by message', async () => {
        mailMock.send.mockRejectedValue(new Error('Too many requests'))

        const job = createJob()

        await expect(service.processNotification(job as any))
            .rejects.toThrow(RateLimitError)
    })

    it('should fallback to unknown error message', async () => {
        mailMock.send.mockRejectedValue({})

        const job = createJob()

        await service.processNotification(job as any)

        expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: expect.objectContaining({
                error: 'Unknown error',
            }),
        })
    })
})