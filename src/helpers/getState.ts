import { prisma } from '../core/db/prisma'

export async function getState() {
  let state = await prisma.scannerState.findUnique({ where: { id: 1 } })

  if (!state) {
    state = await prisma.scannerState.create({
      data: { id: 1 },
    })
  }

  return state
}