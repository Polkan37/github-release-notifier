import { SubscriptionService } from '../../modules/subscription/subscription.service'
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
  let githubMock: any
  let mailMock: any
  let service: SubscriptionService

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})

    githubMock = {
      repoExists: jest.fn(),
      getLatestRelease: jest.fn(),
    }

    mailMock = {
      send: jest.fn(),
    }

    service = new SubscriptionService(githubMock, mailMock)
    jest.clearAllMocks()
  })

  // ---------------- CREATE ----------------

  it('invalid repo format', async () => {
    await expect(
      service.createSubscription('a@mail.com', 'invalid')
    ).rejects.toThrow()
  })

  it('repo not found', async () => {
    githubMock.repoExists.mockResolvedValue(false)

    await expect(
      service.createSubscription('a@mail.com', 'a/b')
    ).rejects.toThrow('Repository not found')
  })

  it('create new repo + subscription', async () => {
    githubMock.repoExists.mockResolvedValue(true)
    githubMock.getLatestRelease.mockResolvedValue({
      tag: 'v1',
      headers: {} as Headers,
    })

    ;(prisma.repository.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.repository.create as jest.Mock).mockResolvedValue({ id: 1, fullName: 'a/b' })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.subscription.create as jest.Mock).mockResolvedValue({ id: 1 })

    const result = await service.createSubscription('a@mail.com', 'a/b')

    expect(prisma.repository.create).toHaveBeenCalled()
    expect(prisma.subscription.create).toHaveBeenCalled()
    expect(mailMock.send).toHaveBeenCalled()
    expect(result).toEqual({ id: 1 })
  })

  it('already ACTIVE', async () => {
    githubMock.repoExists.mockResolvedValue(true)

    ;(prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ status: 'ACTIVE' })

    await expect(
      service.createSubscription('a@mail.com', 'a/b')
    ).rejects.toThrow('Already subscribed')
  })

  it('PENDING returns existing', async () => {
    githubMock.repoExists.mockResolvedValue(true)

    const existing = { id: 1, status: 'PENDING' }

    ;(prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(existing)

    const result = await service.createSubscription('a@mail.com', 'a/b')

    expect(result).toEqual(existing)
  })

  it('UNSUBSCRIBED reactivates', async () => {
    githubMock.repoExists.mockResolvedValue(true)

    ;(prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'UNSUBSCRIBED',
    })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'ACTIVE',
    })

    const result = await service.createSubscription('a@mail.com', 'a/b')

    expect(prisma.subscription.update).toHaveBeenCalled()
    expect(result.status).toBe('ACTIVE')
  })

  it('email failure should not break flow', async () => {
    githubMock.repoExists.mockResolvedValue(true)
    githubMock.getLatestRelease.mockResolvedValue({
      tag: 'v1',
      headers: {} as Headers,
    })

    mailMock.send.mockRejectedValue(new Error('fail'))

    ;(prisma.repository.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.subscription.create as jest.Mock).mockResolvedValue({ id: 1 })

    const result = await service.createSubscription('a@mail.com', 'a/b')

    expect(result).toEqual({ id: 1 })
  })

  // ---------------- CONFIRM ----------------

  it('confirm success', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'PENDING',
    })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'ACTIVE',
    })

    const res = await service.confirmSubscription('token')
    expect(res.status).toBe('ACTIVE')
  })

  it('confirm invalid token', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.confirmSubscription('bad')).rejects.toThrow()
  })

  // ---------------- UNSUB ----------------

  it('unsubscribe success', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'ACTIVE',
    })
    ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'UNSUBSCRIBED',
    })

    const res = await service.unsubscribe('token')
    expect(res.status).toBe('UNSUBSCRIBED')
  })

  // ---------------- GET ----------------

  it('get subscriptions', async () => {
    ;(prisma.subscription.findMany as jest.Mock).mockResolvedValue([{ id: 1 }])

    const res = await service.getSubscriptions('aaaa@mail.com')

    expect(res).toEqual([{ id: 1 }])
  })
})