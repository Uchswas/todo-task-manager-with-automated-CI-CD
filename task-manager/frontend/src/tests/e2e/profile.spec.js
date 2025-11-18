const { test, expect } = require('@playwright/test');
const {
  generateTestEmail,
  generateTestUsername,
  registerUser,
  getAuthToken,
  getStoredUser,
  clearAuthState,
  waitForAuthRedirect,
} = require('./fixtures/auth-fixtures');

/**
 * Test Suite: View Profile Information
 *
 * Tests for viewing and displaying profile information
 */
test.describe('View Profile Information', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Create and login a test user
    testUser = {
      name: generateTestUsername('ProfileView'),
      email: generateTestEmail('profileview'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
  });

  test('should display user profile information correctly', async ({ page }) => {
    // Navigate to profile page
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // Verify page title/header - be specific to avoid multiple matches
    await expect(page.locator('h1').filter({ hasText: /profile settings/i })).toBeVisible();

    // Verify user name is displayed in the input field (always visible)
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveValue(testUser.name);

    // Verify user email is displayed in the input field (always visible)
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveValue(testUser.email);

    // Verify user initials are shown in avatar
    const initials = testUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const avatarText = await page.locator('div.rounded-full').filter({ hasText: new RegExp(initials, 'i') }).first();
    await expect(avatarText).toBeVisible();
  });

  test('should display account information section', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // Verify Account Information section exists
    await expect(page.locator('h3').filter({ hasText: /account information/i })).toBeVisible();

    // Verify Account Created date is shown
    await expect(page.locator('dt').filter({ hasText: /account created/i })).toBeVisible();

    // Verify User ID is shown
    await expect(page.locator('dt').filter({ hasText: /user id/i })).toBeVisible();
  });

  test('should display profile fields as disabled by default', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // Verify name field is disabled
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeDisabled();

    // Verify email field is disabled
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeDisabled();

    // Verify Edit Profile button is visible
    await expect(page.locator('button').filter({ hasText: /edit profile/i })).toBeVisible();
  });

  test('should display security and privacy information cards', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // Verify Security card
    await expect(page.locator('h3').filter({ hasText: /security/i })).toBeVisible();

    // Verify Privacy card
    await expect(page.locator('h3').filter({ hasText: /privacy/i })).toBeVisible();
  });
});

/**
 * Test Suite: Edit Profile Functionality
 *
 * Tests for editing profile information
 */
test.describe('Edit Profile Functionality', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Create and login a test user
    testUser = {
      name: generateTestUsername('ProfileEdit'),
      email: generateTestEmail('profileedit'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should enable edit mode when clicking Edit Profile button', async ({ page }) => {
    // Click Edit Profile button
    await page.click('button:has-text("Edit Profile")');

    // Wait a moment for state change
    await page.waitForTimeout(500);

    // Verify fields are now enabled
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    await expect(nameInput).toBeEnabled();
    await expect(emailInput).toBeEnabled();

    // Verify Cancel and Save Changes buttons are visible
    await expect(page.locator('button').filter({ hasText: /cancel/i })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /save changes/i })).toBeVisible();

    // Verify Edit Profile button is no longer visible
    await expect(page.locator('button').filter({ hasText: /^edit profile$/i })).not.toBeVisible();
  });

  test('should successfully update profile with valid name', async ({ page }) => {
    // Enter edit mode
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);

    // Update name
    const newName = 'Updated Name';
    await page.fill('input[name="name"]', newName);

    // Submit form
    await page.click('button:has-text("Save Changes")');

    // Wait for success message
    await page.waitForTimeout(2000);

    // Verify success message is displayed
    const successMessage = page.locator('div, p, [role="alert"]').filter({ hasText: /profile updated successfully|success/i });
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 });

    // Verify edit mode is exited
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeDisabled();

    // Verify updated name is displayed in the input field (reliable across all viewports)
    await expect(nameInput).toHaveValue(newName);

    // Verify localStorage is updated
    const storedUser = await getStoredUser(page);
    expect(storedUser.name).toBe(newName);
  });

  test('should successfully update profile with valid email', async ({ page }) => {
    // Enter edit mode
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);

    // Update email
    const newEmail = generateTestEmail('newemail');
    await page.fill('input[name="email"]', newEmail);

    // Submit form
    await page.click('button:has-text("Save Changes")');

    // Wait for success message
    await page.waitForTimeout(2000);

    // Verify success message is displayed
    const successMessage = page.locator('div, p, [role="alert"]').filter({ hasText: /profile updated successfully|success/i });
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 });

    // Verify edit mode is exited
    await expect(page.locator('input[name="email"]')).toBeDisabled();

    // Verify updated email is displayed
    await expect(page.locator(`text=${newEmail}`).first()).toBeVisible();

    // Verify localStorage is updated
    const storedUser = await getStoredUser(page);
    expect(storedUser.email).toBe(newEmail);
  });

  test('should successfully update both name and email', async ({ page }) => {
    // Enter edit mode
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);

    // Update both fields
    const newName = 'Both Fields Updated';
    const newEmail = generateTestEmail('bothfields');
    await page.fill('input[name="name"]', newName);
    await page.fill('input[name="email"]', newEmail);

    // Submit form
    await page.click('button:has-text("Save Changes")');

    // Wait for success message
    await page.waitForTimeout(2000);

    // Verify success message
    const successMessage = page.locator('div, p, [role="alert"]').filter({ hasText: /profile updated successfully|success/i });
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 });

    // Verify both fields are updated in input fields (reliable across all viewports)
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    await expect(nameInput).toHaveValue(newName);
    await expect(emailInput).toHaveValue(newEmail);

    // Verify localStorage is updated
    const storedUser = await getStoredUser(page);
    expect(storedUser.name).toBe(newName);
    expect(storedUser.email).toBe(newEmail);
  });

});

/**
 * Test Suite: Profile Validation
 *
 * Tests for validation rules and error handling
 */
test.describe('Profile Validation', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Create and login a test user
    testUser = {
      name: generateTestUsername('ProfileValidation'),
      email: generateTestEmail('profilevalidation'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // Enter edit mode
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);
  });

  test('should display error for empty name field', async ({ page }) => {
    // Clear name field
    await page.fill('input[name="name"]', '');

    // Try to submit
    await page.click('button:has-text("Save Changes")');

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify error message is displayed
    const errorMessage = page.locator('p.error-message, .error-message, [role="alert"]').filter({ hasText: /name.*required/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });

    // Verify still in edit mode
    await expect(page.locator('input[name="name"]')).toBeEnabled();
  });

  test('should display error for name that is too short', async ({ page }) => {
    // Enter single character name
    await page.fill('input[name="name"]', 'A');

    // Try to submit
    await page.click('button:has-text("Save Changes")');

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify error message
    const errorMessage = page.locator('p.error-message, .error-message, [role="alert"]').filter({ hasText: /name.*2.*character/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });

    // Verify still in edit mode
    await expect(page.locator('input[name="name"]')).toBeEnabled();
  });

  test('should display error for name that is too long', async ({ page }) => {
    // Enter name longer than 100 characters
    const longName = 'A'.repeat(101);
    await page.fill('input[name="name"]', longName);

    // Try to submit
    await page.click('button:has-text("Save Changes")');

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify error message
    const errorMessage = page.locator('p.error-message, .error-message, [role="alert"]').filter({ hasText: /name.*100.*character|name.*less than/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });

    // Verify still in edit mode
    await expect(page.locator('input[name="name"]')).toBeEnabled();
  });

  test('should display error for empty email field', async ({ page }) => {
    // Clear email field
    await page.fill('input[name="email"]', '');

    // Try to submit
    await page.click('button:has-text("Save Changes")');

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify error message is displayed
    const errorMessage = page.locator('p.error-message, .error-message, [role="alert"]').filter({ hasText: /email.*required/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });

    // Verify still in edit mode
    await expect(page.locator('input[name="email"]')).toBeEnabled();
  });

  test('should display error when email already exists', async ({ page, browser }) => {
    // Create another user with a different email
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await clearAuthState(page2);

    const anotherUser = {
      name: generateTestUsername('AnotherUser'),
      email: generateTestEmail('another'),
      password: 'Test1234',
    };

    await registerUser(page2, anotherUser);
    await waitForAuthRedirect(page2);
    await clearAuthState(page2);
    await context2.close();

    // Try to update current user's email to the existing email
    await page.fill('input[name="email"]', anotherUser.email);

    // Try to submit
    await page.click('button:has-text("Save Changes")');

    // Wait for server response
    await page.waitForTimeout(2000);

    // Verify error message
    const errorMessage = page.locator('p, div, [role="alert"]').filter({ hasText: /email.*already.*registered|email.*exists/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

    // Verify still in edit mode
    await expect(page.locator('input[name="email"]')).toBeEnabled();
  });

  test('should validate name with exactly 2 characters as valid', async ({ page }) => {
    // Enter name with exactly 2 characters (minimum valid)
    await page.fill('input[name="name"]', 'AB');

    // Submit form
    await page.click('button:has-text("Save Changes")');

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should succeed - verify success message or exit from edit mode
    const isDisabled = await page.locator('input[name="name"]').isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('should validate name with exactly 100 characters as valid', async ({ page }) => {
    // Enter name with exactly 100 characters (maximum valid)
    const maxName = 'A'.repeat(100);
    await page.fill('input[name="name"]', maxName);

    // Submit form
    await page.click('button:has-text("Save Changes")');

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should succeed
    const isDisabled = await page.locator('input[name="name"]').isDisabled();
    expect(isDisabled).toBeTruthy();
  });
});

/**
 * Test Suite: Cancel Edit Functionality
 *
 * Tests for canceling profile edits
 */
test.describe('Cancel Edit Functionality', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Create and login a test user
    testUser = {
      name: generateTestUsername('CancelEdit'),
      email: generateTestEmail('canceledit'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // Enter edit mode for all tests in this suite
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);
  });

  test('should revert changes when clicking Cancel button', async ({ page }) => {
    // Note: We're already in edit mode from beforeEach
    // Store original values
    const originalName = testUser.name;
    const originalEmail = testUser.email;

    // Modify fields
    await page.fill('input[name="name"]', 'Changed Name');
    await page.fill('input[name="email"]', 'changed@example.com');

    // Click Cancel button - use more specific selector
    const cancelButton = page.locator('button[type="button"]').filter({ hasText: 'Cancel' });
    await cancelButton.click();

    // Wait for state change and React re-render
    await page.waitForTimeout(1000);

    // Verify fields are disabled (exit edit mode) - this is more reliable
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    await expect(nameInput).toBeDisabled();
    await expect(emailInput).toBeDisabled();

    // Verify fields are reverted to original values
    // Note: Due to React state updates, we need to wait for re-render
    const nameValue = await nameInput.inputValue();
    const emailValue = await emailInput.inputValue();

    expect(nameValue).toBe(originalName);
    expect(emailValue).toBe(originalEmail);
  });

  test('should clear error messages when clicking Cancel', async ({ page }) => {
    // Note: We're already in edit mode from beforeEach
    // Enter invalid data
    await page.fill('input[name="name"]', 'A');

    // Try to submit to trigger error
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1000);

    // Verify error is shown
    const errorMessage = page.locator('p.error-message').filter({ hasText: /name/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });

    // Click Cancel button - use more specific selector
    const cancelButton = page.locator('button[type="button"]').filter({ hasText: 'Cancel' });
    await cancelButton.click();

    // Wait for React state update
    await page.waitForTimeout(1000);

    // Verify error is cleared - handleCancel calls setErrors({})
    await expect(errorMessage.first()).not.toBeVisible();

    // Verify we've exited edit mode
    await expect(page.locator('input[name="name"]')).toBeDisabled();
  });

  test('should exit edit mode when clicking Cancel', async ({ page }) => {
    // Note: We're already in edit mode from beforeEach
    // Click Cancel button - use more specific selector
    const cancelButton = page.locator('button[type="button"]').filter({ hasText: 'Cancel' });
    await cancelButton.click();

    // Wait for React state update (isEditing becomes false)
    await page.waitForTimeout(1000);

    // Verify Edit Profile button is visible again (primary check)
    await expect(page.locator('button:has-text("Edit Profile")')).toBeVisible();

    // Verify Cancel and Save buttons are hidden
    // The buttons are conditionally rendered based on isEditing state
    const saveButton = page.locator('button:has-text("Save Changes")');

    await expect(cancelButton).not.toBeVisible();
    await expect(saveButton).not.toBeVisible();
  });

  test('should clear success message when clicking Cancel after successful edit', async ({ page }) => {
    // Note: We're already in edit mode from beforeEach
    // Make a successful edit first
    await page.fill('input[name="name"]', 'Success Test');
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(2000);

    // Verify success message appears
    const successMessage = page.locator('div, p').filter({ hasText: /profile updated successfully/i });
    await expect(successMessage.first()).toBeVisible({ timeout: 3000 });

    // Enter edit mode again
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);

    // Make a change
    await page.fill('input[name="name"]', 'Another Change');

    // Click Cancel button - use more specific selector
    const cancelButton = page.locator('button[type="button"]').filter({ hasText: 'Cancel' });
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Verify success message is cleared (handleCancel calls setSuccess(''))
    await expect(successMessage.first()).not.toBeVisible();
  });
});

/**
 * Test Suite: Logout from Profile Page
 *
 * Tests for logout functionality from profile page
 */
test.describe('Logout from Profile Page', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    // Create and login a test user
    testUser = {
      name: generateTestUsername('ProfileLogout'),
      email: generateTestEmail('profilelogout'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await waitForAuthRedirect(page);
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display logout button on profile page', async ({ page }) => {
    // Verify Log Out button is visible
    await expect(page.locator('button').filter({ hasText: /log out|sign out/i })).toBeVisible();
  });

  test('should show confirmation dialog when clicking logout', async ({ page }) => {
    // Set up dialog handler
    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toMatch(/are you sure.*log out/i);
      await dialog.dismiss();
    });

    // Click logout button
    await page.click('button:has-text("Log Out")');

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify dialog was shown
    expect(dialogShown).toBeTruthy();
  });

  test('should successfully logout when confirming dialog', async ({ page }) => {
    // Set up dialog handler to accept
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Verify user is logged in
    const tokenBefore = await getAuthToken(page);
    expect(tokenBefore).not.toBeNull();

    // Click logout button
    await page.click('button:has-text("Log Out")');

    // Wait for redirect to login page
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Verify redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Verify token is removed
    const tokenAfter = await getAuthToken(page);
    expect(tokenAfter).toBeNull();

    // Verify user data is removed
    const storedUser = await getStoredUser(page);
    expect(storedUser).toBeNull();
  });

  test('should not logout when dismissing confirmation dialog', async ({ page }) => {
    // Set up dialog handler to dismiss
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });

    // Verify user is logged in
    const tokenBefore = await getAuthToken(page);
    expect(tokenBefore).not.toBeNull();

    // Click logout button
    await page.click('button:has-text("Log Out")');

    // Wait a moment
    await page.waitForTimeout(1000);

    // Verify still on profile page
    await expect(page).toHaveURL(/\/profile/);

    // Verify token is still present
    const tokenAfter = await getAuthToken(page);
    expect(tokenAfter).toBe(tokenBefore);
  });

  test('should be able to logout from profile page while in edit mode', async ({ page }) => {
    // Enter edit mode
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);

    // Make some changes
    await page.fill('input[name="name"]', 'Unsaved Changes');

    // Set up dialog handler for logout confirmation
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Click logout button
    await page.click('button:has-text("Log Out")');

    // Wait for redirect
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Verify successful logout
    await expect(page).toHaveURL(/\/login/);
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });
});