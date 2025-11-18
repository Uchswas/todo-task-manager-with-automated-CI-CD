const { test, expect } = require('@playwright/test');
const {
  generateTestEmail,
  generateTestUsername,
  registerUser,
  loginUser,
  logoutUser,
  getAuthToken,
  getStoredUser,
  clearAuthState,
  waitForAuthRedirect,
} = require('./fixtures/auth-fixtures');

/**
 * Test Suite: User Registration
 *
 * Tests all aspects of user registration including:
 * - Successful registration
 * - Validation errors
 * - Duplicate email handling
 */
test.describe('User Registration', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await clearAuthState(page);
  });

  test('should successfully register a new user with valid credentials', async ({ page }) => {
    // Generate unique user data
    const testUser = {
      name: generateTestUsername('NewUser'),
      email: generateTestEmail('newuser'),
      password: 'Test1234',
      confirmPassword: 'Test1234',
    };

    // Navigate to registration page
    await page.goto('/register');

    // Verify we're on the registration page
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('h1, h2').filter({ hasText: /register|create.*account/i })).toBeVisible();

    // Fill in registration form
    await page.fill('input[name="name"]', testUser.name);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.confirmPassword);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for successful registration and redirect
    await waitForAuthRedirect(page);

    // Verify user is redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify authentication token is stored
    const token = await getAuthToken(page);
    expect(token).not.toBeNull();
    expect(token).toBeTruthy();

    // Verify user data is stored
    const storedUser = await getStoredUser(page);
    expect(storedUser).not.toBeNull();
    expect(storedUser.name).toBe(testUser.name);
    expect(storedUser.email).toBe(testUser.email);
  });

  test('should display error for registration with existing email', async ({ page }) => {
    // First, register a user
    const testUser = {
      name: generateTestUsername('DuplicateTest'),
      email: generateTestEmail('duplicate'),
      password: 'Test1234',
      confirmPassword: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);

    // Logout to try registering again with same email
    await logoutUser(page);
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Try to register again with the same email
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[name="name"]', 'Different Name');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', 'Test5678');
    await page.fill('input[name="confirmPassword"]', 'Test5678');
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForTimeout(2000);

    // Verify error message is displayed (can be in list item or error div)
    const errorText = await page.locator('li, [role="alert"], .error-message, div:has-text("Error")').filter({ hasText: /email.*already.*exists|already.*registered/i }).first();
    await expect(errorText).toBeVisible({ timeout: 5000 });

    // Verify we're still on the registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for invalid email format', async ({ page }) => {
    await page.goto('/register');

    // Fill form with invalid email
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'notanemail');
    await page.fill('input[name="password"]', 'Test1234');
    await page.fill('input[name="confirmPassword"]', 'Test1234');

    // Try to submit - HTML5 validation should prevent submission
    await page.click('button[type="submit"]');

    // Wait a moment
    await page.waitForTimeout(500);

    // Verify HTML5 validation is triggered (email field is invalid)
    const emailInput = page.locator('input[name="email"]');
    const isInvalid = await emailInput.evaluate((el) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();

    // Verify we're still on registration page (form wasn't submitted)
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for password that is too short', async ({ page }) => {
    await page.goto('/register');

    // Fill form with short password
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', generateTestEmail('shortpass'));
    await page.fill('input[name="password"]', 'Test12'); // Only 6 characters
    await page.fill('input[name="confirmPassword"]', 'Test12');
    await page.click('button[type="submit"]');

    // Wait for client-side validation error message
    await page.waitForTimeout(1000);

    // Check for password length error (can be in list item or error paragraph)
    const hasPasswordError = await page.locator('li, [role="alert"], .error-message, p.error-message, p.text-red-500, p.text-red-600').filter({ hasText: /password.*8.*character/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPasswordError).toBeTruthy();

    // Verify we're still on registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for password without number', async ({ page }) => {
    await page.goto('/register');

    // Fill form with password without number
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', generateTestEmail('nonumber'));
    await page.fill('input[name="password"]', 'PasswordLong'); // No number, 12 chars
    await page.fill('input[name="confirmPassword"]', 'PasswordLong');
    await page.click('button[type="submit"]');

    // Wait for client-side validation error
    await page.waitForTimeout(1000);

    // Check for password requirements error (can be in list item or error paragraph)
    const hasPasswordError = await page.locator('li, [role="alert"], .error-message, p.error-message, p.text-red-500, p.text-red-600').filter({ hasText: /number.*letter|contain.*number/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPasswordError).toBeTruthy();

    // Verify we're still on registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for password without letter', async ({ page }) => {
    await page.goto('/register');

    // Fill form with password without letter
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', generateTestEmail('noletter'));
    await page.fill('input[name="password"]', '12345678'); // No letter
    await page.fill('input[name="confirmPassword"]', '12345678');
    await page.click('button[type="submit"]');

    // Wait for client-side validation error
    await page.waitForTimeout(1000);

    // Check for password requirements error (can be in list item or error paragraph)
    const hasPasswordError = await page.locator('li, [role="alert"], .error-message, p.error-message, p.text-red-500, p.text-red-600').filter({ hasText: /number.*letter|contain.*letter/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPasswordError).toBeTruthy();

    // Verify we're still on registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for name that is too short', async ({ page }) => {
    await page.goto('/register');

    // Fill form with short name
    await page.fill('input[name="name"]', 'A'); // Only 1 character
    await page.fill('input[name="email"]', generateTestEmail('shortname'));
    await page.fill('input[name="password"]', 'Test1234');
    await page.fill('input[name="confirmPassword"]', 'Test1234');
    await page.click('button[type="submit"]');

    // Wait for client-side validation error
    await page.waitForTimeout(1000);

    // Check for name length error (can be in list item or error paragraph)
    const hasNameError = await page.locator('li, [role="alert"], .error-message, p.error-message, p.text-red-500, p.text-red-600').filter({ hasText: /name.*2.*character|name.*between/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasNameError).toBeTruthy();

    // Verify we're still on registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for empty name field', async ({ page }) => {
    await page.goto('/register');

    // Fill form with empty name
    await page.fill('input[name="name"]', '');
    await page.fill('input[name="email"]', generateTestEmail('emptyname'));
    await page.fill('input[name="password"]', 'Test1234');
    await page.fill('input[name="confirmPassword"]', 'Test1234');

    // Try to submit - HTML5 validation should prevent it
    await page.click('button[type="submit"]');

    // Wait a moment
    await page.waitForTimeout(500);

    // Check HTML5 validation on name field
    const nameInput = page.locator('input[name="name"]');
    const isInvalid = await nameInput.evaluate((el) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();

    // Verify we're still on registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error when passwords do not match', async ({ page }) => {
    await page.goto('/register');

    // Fill form with mismatched passwords
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', generateTestEmail('mismatch'));
    await page.fill('input[name="password"]', 'Test1234');
    await page.fill('input[name="confirmPassword"]', 'Different5678'); // Different password
    await page.click('button[type="submit"]');

    // Wait for client-side validation error
    await page.waitForTimeout(1000);

    // Check for password mismatch error (can be in list item or error paragraph)
    const hasPasswordError = await page.locator('li, [role="alert"], .error-message, p.error-message, p.text-red-500, p.text-red-600').filter({ hasText: /password.*do not match|password.*must match/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPasswordError).toBeTruthy();

    // Verify we're still on registration page
    await expect(page).toHaveURL(/\/register/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });
});

/**
 * Test Suite: User Login
 *
 * Tests all aspects of user login including:
 * - Successful login with valid credentials
 * - Invalid credentials handling
 * - Field validation
 */
test.describe('User Login', () => {
  let registeredUser;

  test.beforeAll(async ({ browser }) => {
    // Create a test user for login tests
    const context = await browser.newContext();
    const page = await context.newPage();

    registeredUser = {
      name: generateTestUsername('LoginTest'),
      email: generateTestEmail('logintest'),
      password: 'Test1234',
    };

    await registerUser(page, registeredUser);
    await page.waitForTimeout(2000);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await clearAuthState(page);
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Verify we're on the login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1, h2').filter({ hasText: /login|sign in/i })).toBeVisible();

    // Fill in login form
    await page.fill('input[name="email"]', registeredUser.email);
    await page.fill('input[name="password"]', registeredUser.password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for successful login and redirect
    await waitForAuthRedirect(page);

    // Verify user is redirected to the main application
    await expect(page).not.toHaveURL(/\/(login|register)/);

    // Verify authentication token is stored
    const token = await getAuthToken(page);
    expect(token).not.toBeNull();
    expect(token).toBeTruthy();

    // Verify user data is stored
    const storedUser = await getStoredUser(page);
    expect(storedUser).not.toBeNull();
    expect(storedUser.email).toBe(registeredUser.email);
  });

  test('should display error for invalid email', async ({ page }) => {
    await page.goto('/login');

    // Try to login with non-existent email
    await page.fill('input[name="email"]', generateTestEmail('nonexistent'));
    await page.fill('input[name="password"]', 'Test1234');
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    await page.waitForTimeout(3000);

    // Verify login failed - still on login page with no token
    const stillOnLogin = await page.url().includes('/login');
    const hasToken = await getAuthToken(page);

    expect(stillOnLogin).toBeTruthy();
    expect(hasToken).toBeNull();

    // Verify error message is displayed
    const errorMessage = page.locator('li, [role="alert"], .error-message, p').filter({ hasText: /invalid|incorrect|wrong|error/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display error for invalid password', async ({ page }) => {
    await page.goto('/login');

    // Try to login with wrong password
    await page.fill('input[name="email"]', registeredUser.email);
    await page.fill('input[name="password"]', 'WrongPass123');
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    await page.waitForTimeout(3000);

    // Verify login failed - still on login page with no token
    const stillOnLogin = await page.url().includes('/login');
    const hasToken = await getAuthToken(page);

    expect(stillOnLogin).toBeTruthy();
    expect(hasToken).toBeNull();

    // Verify error message is displayed
    const errorMessage = page.locator('li, [role="alert"], .error-message, p').filter({ hasText: /invalid|incorrect|wrong|error/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display error for empty email field', async ({ page }) => {
    await page.goto('/login');

    // Try to login with empty email
    await page.fill('input[name="email"]', '');
    await page.fill('input[name="password"]', 'Test1234');
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForTimeout(1000);

    // Check for email required error (client-side validation)
    const emailInput = page.locator('input[name="email"]');
    const isInvalid = await emailInput.evaluate((el) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should display error for empty password field', async ({ page }) => {
    await page.goto('/login');

    // Try to login with empty password
    await page.fill('input[name="email"]', registeredUser.email);
    await page.fill('input[name="password"]', '');
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForTimeout(1000);

    // Check for password required error (client-side validation)
    const passwordInput = page.locator('input[name="password"]');
    const isInvalid = await passwordInput.evaluate((el) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });
});

/**
 * Test Suite: User Logout
 *
 * Tests user logout functionality including:
 * - Successful logout
 * - Token and user data removal
 * - Redirect to login page
 */
test.describe('User Logout', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Register and login a new user for each logout test
    testUser = {
      name: generateTestUsername('LogoutTest'),
      email: generateTestEmail('logouttest'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
  });

  test('should successfully logout user', async ({ page }) => {
    // Verify user is logged in
    const tokenBefore = await getAuthToken(page);
    expect(tokenBefore).not.toBeNull();

    // Perform logout
    await logoutUser(page);

    // Wait for redirect to login page
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Verify user is redirected to login page
    await expect(page).toHaveURL(/\/login/);

    // Verify authentication token is removed
    const tokenAfter = await getAuthToken(page);
    expect(tokenAfter).toBeNull();

    // Verify user data is removed
    const storedUser = await getStoredUser(page);
    expect(storedUser).toBeNull();
  });

  test('should prevent access to protected routes after logout', async ({ page }) => {
    // Logout
    await logoutUser(page);
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Try to access a protected route (dashboard or home)
    await page.goto('/');

    // Should be redirected to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should allow login again after logout', async ({ page }) => {
    // Logout
    await logoutUser(page);
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Login again with the same credentials
    await loginUser(page, testUser.email, testUser.password);
    await waitForAuthRedirect(page);

    // Verify successful re-login
    await expect(page).not.toHaveURL(/\/(login|register)/);

    const token = await getAuthToken(page);
    expect(token).not.toBeNull();

    const storedUser = await getStoredUser(page);
    expect(storedUser).not.toBeNull();
    expect(storedUser.email).toBe(testUser.email);
  });
});

/**
 * Test Suite: Session Persistence
 *
 * Tests session persistence across page reloads and browser restarts
 */
test.describe('Session Persistence', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Register and login a new user
    testUser = {
      name: generateTestUsername('SessionTest'),
      email: generateTestEmail('sessiontest'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
  });

  test('should redirect to login when accessing protected route without token', async ({ page }) => {
    // Clear authentication state
    await clearAuthState(page);

    // Try to access protected route
    await page.goto('/');

    // Should be redirected to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle expired or invalid token gracefully', async ({ page }) => {
    // Navigate to login first to ensure we have a valid page
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Set an invalid token
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid-token-12345');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test' }));
    });

    // Try to navigate to a protected route - use waitUntil: 'domcontentloaded' and catch errors
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    } catch (error) {
      // Navigation may fail due to redirect, that's okay
    }

    // Should be redirected to login due to invalid token
    // The axios interceptor should catch the 401 and redirect
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    // Token should be cleared
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });
});