import cron from 'node-cron'
import pLimit from 'p-limit'
import { prisma } from '../db/prisma'
import { GitHubClient } from '../../integrations/github/github.client'
import { getState } from '../../helpers/getState'
import { updateLastScannedRepoId } from '../../helpers/updateLastScannedRepoId'
import { parseRateLimit, getSleepMs, sleep } from '../../helpers/rateLimit'

const github = new GitHubClient()

const MAX_BATCH = 50
const CONCURRENCY = 5

export function startScanner() {
  cron.schedule('* * * * *', async () => {
    const state = await getState()

    let batchSize = MAX_BATCH

    const repos = await prisma.repository.findMany({
      where: state.lastRepoId ? { id: { gt: state.lastRepoId } } : {},
      orderBy: { id: 'asc' },
      take: batchSize,
    })

    if (repos.length === 0) {
      await prisma.scannerState.update({
        where: { id: 1 },
        data: { lastRepoId: null },
      })
      return
    }

    const limit = pLimit(CONCURRENCY)

    let globalRemaining: number | null = null
    let globalReset: number | null = null

    await Promise.allSettled(
      repos.map((repo) =>
        limit(async () => {
          try {
            const { tag, headers } =
              await github.getLatestRelease(repo.fullName)

            const { remaining, reset } = parseRateLimit(headers);

            globalRemaining = remaining
            globalReset = reset

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
          } catch (e: any) {
            if (e.status === 403 || e.status === 429) {
              const { reset } = parseRateLimit(e.headers)
              
              if (reset !== null) {
                const sleepMs = getSleepMs(reset)
                console.log(`Github rate limit. Sleep ${sleepMs}ms`)
                await sleep(sleepMs)
              } else {
                await sleep(60_000)
              }
              return
            }

            console.error(`Scanning failed. Repo: ${repo.fullName}`)
            await updateLastScannedRepoId(repo.id)
          }
        })
      )
    )
  })
}