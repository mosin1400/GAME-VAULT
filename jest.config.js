module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/src/**/*.js',
    'packages/**/src/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  moduleNameMapper: {
    '^@game-vault/shared$': '<rootDir>/packages/shared/src/index.js',
    '^@game-vault/auth$': '<rootDir>/services/auth/src/index.js',
    '^@game-vault/api$': '<rootDir>/services/api/src/index.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
