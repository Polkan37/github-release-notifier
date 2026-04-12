import { SubscriptionService } from '../../modules/subscription/subscription.service'
import { GitHubClient } from '../../integrations/github/github.client'
import { MailClient } from '../../integrations/mail/mail.client'
import { prisma } from '../../core/db/prisma'
import crypto from 'crypto'

jest.mock('../../core/db/prisma', () => ({
  prisma: {
    repository: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.spyOn(crypto, 'randomUUID').mockReturnValue(
  '00000000-0000-0000-0000-000000000000'
)

describe('SubscriptionService', () => {
  let githubMock: GitHubClient
  let mailMock: MailClient
  let service: SubscriptionService

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { })
    jest.spyOn(console, 'warn').mockImplementation(() => { })

    githubMock = new GitHubClient()
    mailMock = new MailClient()

    service = new SubscriptionService(githubMock, mailMock)
    jest.clearAllMocks()
  })

  // ---------------- CREATE ----------------

  it('invalid repo format', async () => {
    await expect(
      service.createSubscription('aaaa@mail.com', 'invalid')
    ).rejects.toThrow()
  })

  it('repo not found', async () => {
    jest.spyOn(githubMock, 'repoExists').mockResolvedValue(false)

    await expect(
      service.createSubscription('aaaa@mail.com', 'golang/go')
    ).rejects.toThrow('Repository not found')
  })

  it('create new repo + subscription', async () => {
    jest.spyOn(githubMock, 'repoExists').mockResolvedValue(true)
    jest.spyOn(githubMock, 'getLatestRelease').mockResolvedValue({
      tag: 'v1',
      headers: {} as Headers,
    })

    const sendSpy = jest.spyOn(mailMock, 'send').mockResolvedValue(undefined)

      ; (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null)
      ; (prisma.repository.create as jest.Mock).mockResolvedValue({
        id: 1,
        fullName: 'golang/go',
        lastSeenTag: 'v1',
      })

      ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
      ; (prisma.subscription.create as jest.Mock).mockResolvedValue({ id: 1 })

    await service.createSubscription('aaaa@mail.com', 'golang/go')

    expect(prisma.repository.create).toHaveBeenCalled()
    expect(prisma.subscription.create).toHaveBeenCalled()
    expect(sendSpy).toHaveBeenCalled()
  })

  it('already ACTIVE', async () => {
    jest.spyOn(githubMock, 'repoExists').mockResolvedValue(true)

      ; (prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
      ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        status: 'ACTIVE',
      })

    await expect(
      service.createSubscription('aaaa@mail.com', 'golang/go')
    ).rejects.toThrow('Already subscribed')
  })

  it('PENDING does nothing', async () => {
    jest.spyOn(githubMock, 'repoExists').mockResolvedValue(true)

      ; (prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
      ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'PENDING',
      })

    await service.createSubscription('aaaa@mail.com', 'golang/go')

    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })

  it('UNSUBSCRIBED reactivates', async () => {
    jest.spyOn(githubMock, 'repoExists').mockResolvedValue(true)

      ; (prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
      ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'UNSUBSCRIBED',
      })

      ; (prisma.subscription.update as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      })

    await service.createSubscription('aaaa@mail.com', 'golang/go')

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'ACTIVE',
      }),
    })
  })

  it('email failure should not break flow', async () => {
    jest.spyOn(githubMock, 'repoExists').mockResolvedValue(true)
    jest.spyOn(githubMock, 'getLatestRelease').mockResolvedValue({
      tag: 'v1',
      headers: {} as Headers,
    })

    jest.spyOn(mailMock, 'send').mockRejectedValue(new Error('fail'))

      ; (prisma.repository.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        fullName: 'golang/go',
        lastSeenTag: 'v1',
      })

      ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
      ; (prisma.subscription.create as jest.Mock).mockResolvedValue({ id: 1 })

    await service.createSubscription('aaaa@mail.com', 'golang/go')

    expect(prisma.subscription.create).toHaveBeenCalled()
  })

  // ---------------- CONFIRM ----------------

  it('confirm success', async () => {
    ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'PENDING',
    })

      ; (prisma.subscription.update as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      })

    const res = await service.confirmSubscription('token')

    expect(res).toBe(true)

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'ACTIVE',
      }),
    })
  })

  it('confirm invalid token', async () => {
    ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await service.confirmSubscription('bad')

    expect(res).toBe(false)
  })

  // ---------------- UNSUB ----------------

  it('unsubscribe success', async () => {
    ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'ACTIVE',
    })

      ; (prisma.subscription.update as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'UNSUBSCRIBED',
      })

    const res = await service.unsubscribe('token')

    expect(res).toBe(true)

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'UNSUBSCRIBED',
      }),
    })
  })

  it('unsubscribe not found', async () => {
    ; (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await service.unsubscribe('bad')

    expect(res).toBe(false)
  })

  // ---------------- GET ----------------

  it('get subscriptions', async () => {
    ; (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      {
        email: 'aaaa@mail.com',
        status: 'ACTIVE',
        repository: {
          fullName: 'golang/go',
          lastSeenTag: 'v1',
        },
      },
    ])

    const res = await service.getSubscriptions('aaaa@mail.com')

    expect(res).toEqual([
      {
        email: 'aaaa@mail.com',
        repo: 'golang/go',
        confirmed: true,
        lastSeenTag: 'v1',
      },
    ])
  })
})