import '@testing-library/jest-dom';

// Mock Firebase
jest.mock('./firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {}
}));

// Mock Firebase functions
global.fetch = jest.fn();

// Mock environment variables
process.env = {
  ...process.env,
  NODE_ENV: 'test'
};

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
