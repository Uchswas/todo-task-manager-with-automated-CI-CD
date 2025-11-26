/**
 * Integration test setup file
 * Runs before each integration test to ensure consistent test environment
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { setupApiMocks, resetApiMocks } from './helpers/api-mocks';
import { resetMockCounters } from './helpers/mock-data';

// Increase default timeout for integration tests to accommodate slower CI VMs
jest.setTimeout(60000);

// Increase default async wait timeout for findBy*/waitFor across all integration tests
configure({ asyncUtilTimeout: 60000 });

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
