// Jest Global Setup
global.testUtils = {
  mockUser: {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
  },
  mockAdmin: {
    id: 'test-admin-id',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
  },
};

// Suppress console logs during tests if needed
if (process.env.CI) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}
