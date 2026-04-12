module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  testMatch: ['<rootDir>/src/**/*.spec.ts'],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
};