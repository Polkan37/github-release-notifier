import cron from 'node-cron'
import { prisma } from '../db/prisma'
import { GitHubClient } from '../../integrations/github/github.client'
import { getState } from '../../helpers/getState'
import { updateLastScannedRepoId } from '../../helpers/updateLastScannedRepoId'
import { parseRateLimit, getSleepMs, sleep } from '../../helpers/rateLimit'

const pLimit = require('p-limit').default;

const github = new GitHubClient()

const MAX_BATCH = 50
const CONCURRENCY = 5

export function startScanner() {
  cron.schedule('* * * * *', async () => {
    const state = await getState()

    const repos = await prisma.repository.findMany({
      where: state.lastRepoId ? { id: { gt: state.lastRepoId } } : {},
      orderBy: { id: 'asc' },
      take: MAX_BATCH,
    })

    if (repos.length === 0) {
      await prisma.scannerState.update({
        where: { id: 1 },
        data: { lastRepoId: null },
      })
      return
    }

    const limit = pLimit(CONCURRENCY)

    await Promise.allSettled(
      repos.map((repo) =>
        limit(async () => {
          try {
            const { tag } =
              await github.getLatestRelease(repo.fullName)

            if (tag === repo.lastSeenTag) {
              await updateLastScannedRepoId(repo.id)
              return
            }
            if (tag) {
              const subs = await prisma.subscription.findMany({
                where: {
                  repositoryId: repo.id,
                  status: 'ACTIVE',
                },
                select: { id: true },
              })

              if (subs.length > 0) {
                await prisma.notification.createMany({
                  data: subs.map((s) => ({
                    subscriptionId: s.id,
                    repositoryId: repo.id,
                    tag,
                  })),
                  skipDuplicates: true,
                })
              }
            }

            await prisma.repository.update({
              where: { id: repo.id },
              data: { lastSeenTag: tag },
            })

            await updateLastScannedRepoId(repo.id)
          } catch (e) {
            const err = e as { status: number; headers: Headers }
            if (err.status === 403 || err.status === 429) {
              const { reset } = parseRateLimit(err.headers)

              if (reset !== null) {
                const sleepMs = getSleepMs(reset)
                console.log(`Github rate limit. Sleep ${sleepMs}ms`)
                await sleep(sleepMs)
              } else {
                await sleep(60_000)
              }
              return
            }

            console.warn(`Scanning failed. Repo: ${repo.fullName}`)
            await updateLastScannedRepoId(repo.id)
          }
        })
      )
    )
  })
}