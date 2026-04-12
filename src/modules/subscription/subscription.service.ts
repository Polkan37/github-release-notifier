import { prisma } from '../../core/db/prisma'
import { GitHubClient } from '../../integrations/github/github.client'
import { MailClient } from '../../integrations/mail/mail.client'
import crypto from 'crypto'
import { confirmEmailTemplate } from '../notification/templates/confirm'
import { SubscriptionDTO } from './types'

export class SubscriptionService {
    constructor(
        private githubClient = new GitHubClient(),
        private mail = new MailClient()
    ) { }


    //create subscription
    async createSubscription(email: string, repo: string): Promise<void> {
        // 1. repo validation
        if (!/^[^/]+\/[^/]+$/.test(repo)) {
            throw new Error('Invalid repository format')
        }

        // 2. Check repo with GitHub
        const exists = await this.githubClient.repoExists(repo)
        if (!exists) {
            throw new Error('Repository not found')
        }

        // 3. Find or create repo in db
        let repository = await prisma.repository.findUnique({
            where: { fullName: repo },
        })

        if (!repository) {
            const latestTag = (await this.githubClient.getLatestRelease(repo)).tag;

            repository = await prisma.repository.create({
                data: {
                    fullName: repo,
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
                return
            }
            if (existing.status === 'UNSUBSCRIBED') {
                await prisma.subscription.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        confirmToken: crypto.randomUUID(),
                        unsubscribedAt: null,
                    },
                })
                return
            }
        }

        // 5. Token generation
        const confirmToken = crypto.randomUUID();
        const unsubscribeToken = crypto.randomUUID();

        // 6. Create subscription
        await prisma.subscription.create({
            data: {
                email,
                repositoryId: repository.id,
                confirmToken,
                unsubscribeToken,
            },
        })

        // 7. Send email with confirmToken
        try {
            await this.mail.send({
                to: email,
                subject: `Confirm subscription to ${repository.fullName}`,
                html: confirmEmailTemplate(confirmToken),
            })
        } catch (err: any) {
            console.warn('Failed to send confirmation email:', err?.message || err)
        }

        return
    }

    // confirm subscription
    async confirmSubscription(token: string) {
        const subscription = await prisma.subscription.findUnique({
            where: { confirmToken: token },
        })

        if (!subscription) {
            return false
        }

        if (subscription.status === 'ACTIVE') {
            return true
        }

        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'ACTIVE',
                confirmedAt: new Date(),
            },
        })

        return true
    }

    // unsubscribe
    async unsubscribe(token: string) {
        const subscription = await prisma.subscription.findUnique({
            where: { unsubscribeToken: token },
        })

        if (!subscription) {
            return false
        }

        if (subscription.status === 'UNSUBSCRIBED') {
            return true
        }

        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'UNSUBSCRIBED',
                unsubscribedAt: new Date(),
            },
        })

        return true
    }

    // get subscriptions by email
    async getSubscriptions(email: string): Promise<SubscriptionDTO[]> {
        const subs = await prisma.subscription.findMany({
            where: {
                email,
                status: 'ACTIVE',
            },
            include: {
                repository: true,
            },
        })

        return subs.map((s) => ({
            email: s.email,
            repo: s.repository.fullName,
            confirmed: s.status === 'ACTIVE',
            lastSeenTag: s.repository.lastSeenTag,
        }))
    }
}