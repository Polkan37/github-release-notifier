module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.int\\.spec\\.ts'
  ],

  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
};