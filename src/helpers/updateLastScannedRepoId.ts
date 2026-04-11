import { prisma } from '../core/db/prisma'

export async function updateLastScannedRepoId(repoId: number) {
  await prisma.scannerState.update({
    where: { id: 1 },
    data: { lastRepoId: repoId },
  })
}