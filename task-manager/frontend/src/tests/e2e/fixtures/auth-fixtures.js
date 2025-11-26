/**
 * Authentication Test Fixtures
 *
 * Provides reusable test data and helper functions for authentication E2E tests.
 * This includes test users, helper functions for authentication flows, and utilities
 * for managing test state.
 */

/**
 * Generate a unique email address for testing
 * @param {string} prefix - Prefix for the email address
 * @returns {string} Unique email address
 */
export function generateTestEmail(prefix = 'test') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${timestamp}_${random}@example.com`;
}

/**
 * Generate a random username
 * @param {string} prefix - Prefix for the username
 * @returns {string} Random username
 */
export function generateTestUsername(prefix = 'TestUser') {
  const timestamp = Date.now();
  return `${prefix}_${timestamp}`;
}

/**
 * Test user credentials for registration
 */
export const testUsers = {
  valid: {
    name: 'John Doe',
    email: generateTestEmail('valid'),
    password: 'Test1234',
    confirmPassword: 'Test1234',
  },
  validAlternate: {
    name: 'Jane Smith',
    email: generateTestEmail('jane'),
    password: 'Pass5678',
    confirmPassword: 'Pass5678',
  },
  weakPassword: {
    name: 'Weak Password',
    email: generateTestEmail('weak'),
    password: 'weak',
    confirmPassword: 'weak',
  },
  shortPassword: {
    name: 'Short Pass',
    email: generateTestEmail('short'),
    password: 'abc',
    confirmPassword: 'abc',
  },
  noNumber: {
    name: 'No Number',
    email: generateTestEmail('nonumber'),
    password: 'Password',
    confirmPassword: 'Password',
  },
  noLetter: {
    name: 'No Letter',
    email: generateTestEmail('noletter'),
    password: '12345678',
    confirmPassword: '12345678',
  },
  invalidEmail: {
    name: 'Invalid Email',
    email: 'notanemail',
    password: 'Test1234',
    confirmPassword: 'Test1234',
  },
  emptyName: {
    name: '',
    email: generateTestEmail('emptyname'),
    password: 'Test1234',
    confirmPassword: 'Test1234',
  },
  shortName: {
    name: 'A',
    email: generateTestEmail('shortname'),
    password: 'Test1234',
    confirmPassword: 'Test1234',
  },
};

/**
 * Helper function to perform user registration
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} userData - User data for registration
 * @returns {Promise<void>}
 */
export async function registerUser(page, userData) {
  await page.goto('/register');
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.confirmPassword || userData.password);
  await page.click('button[type="submit"]');
}

/**
 * Helper function to perform user login
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<void>}
 */
export async function loginUser(page, email, password) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

/**
 * Helper function to perform user logout
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function logoutUser(page) {
  // Click on the user profile button to open dropdown
  await page.click('button:has(div.rounded-full.bg-blue-600)');

  // Wait for dropdown to appear
  await page.waitForSelector('button:has-text("Sign out")', { state: 'visible' });

  // Click the Sign out button
  await page.click('button:has-text("Sign out")');
}

/**
 * Helper function to check if user is logged in
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isUserLoggedIn(page) {
  try {
    // Check if we're on a protected route and not redirected to login
    const currentUrl = page.url();
    return !currentUrl.includes('/login') && !currentUrl.includes('/register');
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to get localStorage token
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string|null>}
 */
export async function getAuthToken(page) {
  try {
    // Ensure we're on a valid page with localStorage access
    const url = page.url();
    if (!url || url === 'about:blank' || url.startsWith('data:')) {
      return null;
    }
    return await page.evaluate(() => localStorage.getItem('token'));
  } catch (error) {
    // If localStorage is not accessible, return null
    return null;
  }
}

/**
 * Helper function to get localStorage user data
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object|null>}
 */
export async function getStoredUser(page) {
  try {
    // Ensure we're on a valid page with localStorage access
    const url = page.url();
    if (!url || url === 'about:blank' || url.startsWith('data:')) {
      return null;
    }
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    // If localStorage is not accessible, return null
    return null;
  }
}

/**
 * Helper function to clear authentication state
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function clearAuthState(page) {
  try {
    // Navigate to the app first to ensure localStorage is accessible
    const currentUrl = page.url();
    if (!currentUrl || currentUrl === 'about:blank' || currentUrl.startsWith('data:')) {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    }

    // Clear localStorage
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.clear();
    });
  } catch (error) {
    // If we can't clear localStorage, navigate to ensure clean state
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.evaluate(() => {
        localStorage.clear();
      });
    } catch (e) {
      // Ignore if still fails
    }
  }
}

/**
 * Helper function to wait for navigation after authentication action
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function waitForAuthRedirect(page, timeout = 5000) {
  await page.waitForURL(url => !url.pathname.includes('/login') && !url.pathname.includes('/register'), {
    timeout,
  });
}

/**
 * Error messages expected from the application
 */
export const errorMessages = {
  invalidCredentials: 'Invalid email or password',
  emailRequired: 'Email is required',
  passwordRequired: 'Password is required',
  nameRequired: 'Name is required',
  emailInvalid: 'Invalid email format',
  passwordTooShort: 'Password must be at least 8 characters',
  passwordRequirements: 'Password must contain at least one number and one letter',
  nameTooShort: 'Name must be between 2 and 100 characters',
  emailExists: 'Email already exists',
  confirmPasswordRequired: 'Please confirm your password',
  passwordsDoNotMatch: 'Passwords do not match',
};
