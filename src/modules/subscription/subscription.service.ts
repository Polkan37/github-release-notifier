import { prisma } from '../../core/db/prisma'
import { GitHubClient } from '../../integrations/github/github.client'
import { MailClient } from '../../integrations/mail/mail.client'
import crypto from 'crypto'
import { confirmEmailTemplate } from '../notification/templates/confirm'

const githubClient = new GitHubClient()
const mail = new MailClient()

export class SubscriptionService {
    //create subscription
    async createSubscription(email: string, fullName: string) {
        // 1. repo validation
        if (!/^[^/]+\/[^/]+$/.test(fullName)) {
            throw new Error('Invalid repository format')
        }

        // 2. Check repo with GitHub
        const exists = await githubClient.repoExists(fullName)
        if (!exists) {
            throw new Error('Repository not found')
        }

        // 3. Find or create repo in db
        let repository = await prisma.repository.findUnique({
            where: { fullName },
        })

        if (!repository) {
            const latestTag = (await githubClient.getLatestRelease(fullName)).tag;

            repository = await prisma.repository.create({
                data: {
                    fullName,
                    lastSeenTag: latestTag,
                },
            })
        }

        // 4. Check for subscription duplicates
        const existing = await prisma.subscription.findUnique({
            where: {
                email_repositoryId: {
                    email,
                    repositoryId: repository.id,
                },
            },
        })

        if (existing) {
            if (existing.status === 'ACTIVE') {
                throw new Error('Already subscribed')
            }

            if (existing.status === 'PENDING') {
                return existing
            }
            if (existing.status === 'UNSUBSCRIBED') {
                return prisma.subscription.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        confirmToken: crypto.randomUUID(),
                        unsubscribedAt: null,
                    },
                })
            }
        }

        // 5. Token generation
        const confirmToken = crypto.randomUUID();
        const unsubscribeToken = crypto.randomUUID();

        // 6. Create subscription
        const subscription = await prisma.subscription.create({
            data: {
                email,
                repositoryId: repository.id,
                confirmToken,
                unsubscribeToken,
            },
        })

        // 7. Send email with confirmToken
        try {
            const html = confirmEmailTemplate(confirmToken)
            await mail.send({
                to: email,
                subject: `Confirm subscription to ${repository.fullName}`,
                html,
            })
        } catch (err: any) {
            console.error('Failed to send confirmation email:', err?.message || err)
        }

        return subscription
    }

    // confirm subscription
    async confirmSubscription(token: string) {
        const subscription = await prisma.subscription.findUnique({
            where: { confirmToken: token },
        })

        if (!subscription) {
            throw new Error('Invalid token')
        }

        if (subscription.status === 'ACTIVE') {
            return subscription
        }

        return prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'ACTIVE',
                confirmedAt: new Date(),
            },
        })
    }

    // unsubscribe
    async unsubscribe(token: string) {
        const subscription = await prisma.subscription.findUnique({
            where: { unsubscribeToken: token },
        })

        if (!subscription) {
            throw new Error('Invalid token')
        }

        if (subscription.status === 'UNSUBSCRIBED') {
            return subscription
        }

        return prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'UNSUBSCRIBED',
                unsubscribedAt: new Date(),
            },
        })
    }

    // get subscriptions by email
    async getSubscriptions(email: string) {
        return prisma.subscription.findMany({
            where: {
                email,
                status: 'ACTIVE',
            },
            include: {
                repository: true,
            },
        })
    }
}