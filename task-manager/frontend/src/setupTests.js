import '@testing-library/jest-dom';

// Suppress expected console errors and warnings in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Suppress specific expected errors that are part of test scenarios
    const errorString = args[0]?.toString() || '';

    // Suppress expected test errors
    if (
      errorString.includes('Error parsing user data:') ||
      errorString.includes('Logout API call failed:') ||
      errorString.includes('Failed to refresh profile:') ||
      errorString.includes('ReactDOMTestUtils.act') ||
      errorString.includes('was not wrapped in act')
    ) {
      return;
    }

    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    const warnString = args[0]?.toString() || '';

    // Suppress React Router deprecation warnings
    if (
      warnString.includes('React Router Future Flag Warning') ||
      warnString.includes('v7_startTransition') ||
      warnString.includes('v7_relativeSplatPath')
    ) {
      return;
    }

    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock localStorage with actual storage functionality
const localStorageStore = new Map();

const mockedLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const applyLocalStorageMockImplementations = () => {
  mockedLocalStorage.getItem.mockImplementation((key) => {
    const stringKey = String(key);
    return localStorageStore.has(stringKey) ? localStorageStore.get(stringKey) : null;
  });

  mockedLocalStorage.setItem.mockImplementation((key, value) => {
    localStorageStore.set(String(key), value?.toString());
  });

  mockedLocalStorage.removeItem.mockImplementation((key) => {
    localStorageStore.delete(String(key));
  });

  mockedLocalStorage.clear.mockImplementation(() => {
    localStorageStore.clear();
  });
};

applyLocalStorageMockImplementations();

beforeEach(() => {
  applyLocalStorageMockImplementations();
});

Object.defineProperty(window, 'localStorage', {
  value: mockedLocalStorage,
  writable: true
});

// Ensure global.localStorage references window.localStorage for convenience
if (typeof global !== 'undefined') {
  global.localStorage = mockedLocalStorage;
}

// Mock axios
jest.mock('axios', () => ({
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() }
      }
    })),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    }
  },
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    }
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn()
}));

// Load integration test setup
// This will be loaded for all tests, but only executes logic for integration tests
require('./tests/integration/setup.integration.js');
