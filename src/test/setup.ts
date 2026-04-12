jest.mock('../core/db/prisma', () => ({
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
    notification: {
      update: jest.fn(),
    },
  },
}))