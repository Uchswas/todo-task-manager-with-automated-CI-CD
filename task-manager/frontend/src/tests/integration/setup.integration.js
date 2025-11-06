/**
 * Integration test setup file
 * Runs before each integration test to ensure consistent test environment
 */

import '@testing-library/jest-dom';
import { setupApiMocks, resetApiMocks } from './helpers/api-mocks';
import { resetMockCounters } from './helpers/mock-data';

// Setup API mocks before all integration tests
beforeAll(() => {
  setupApiMocks();
});

// Reset state before each integration test to ensure isolation
beforeEach(() => {
  // Clear all API mocks and reset in-memory stores
  resetApiMocks();

  // Reset mock data ID counters
  resetMockCounters();

  // Clear localStorage to start each test with clean auth state
  localStorage.clear();

  // Re-setup API mocks with fresh state
  setupApiMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.clearAllMocks();
});
