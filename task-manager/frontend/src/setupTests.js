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

// Mock localStorage with persistence across test resets
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
});

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