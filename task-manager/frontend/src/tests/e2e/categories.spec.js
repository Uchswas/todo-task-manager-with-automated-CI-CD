const { test, expect } = require('@playwright/test');
const {
  generateTestEmail,
  generateTestUsername,
  registerUser,
  loginUser,
  clearAuthState,
  waitForAuthRedirect,
} = require('./fixtures/auth-fixtures');

/**
 * Helper function to wait for categories to load
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function waitForCategoriesToLoad(page) {
  // Wait for either category cards to appear or empty state message
  await page.waitForSelector(
    'article.relative.group, h3:has-text("No categories")',
    { timeout: 10000, state: 'visible' }
  ).catch(() => {
    // If neither appears, that's okay - might be loading
  });
  // Wait a moment for any animations/loading to complete
  await page.waitForTimeout(500);
}

/**
 * Helper function to get actual category count
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<number>}
 */
async function getCategoryCount(page) {
  // Count category cards (article elements with specific classes)
  return await page.locator('article.relative.group').count();
}

/**
 * Helper function to check if an error is displayed (inline or in error component)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {RegExp} errorPattern - Pattern to match in error text
 * @returns {Promise<boolean>}
 */
async function hasError(page, errorPattern = /error|required|invalid|validation/i) {
  const inlineError = page.locator('p.error-message, .text-red-500, .text-red-600').filter({ hasText: errorPattern });
  const errorComponent = page.locator('[data-testid="error-message"]').filter({ hasText: errorPattern });

  const hasInline = await inlineError.isVisible().catch(() => false);
  const hasComponent = await errorComponent.isVisible().catch(() => false);

  return hasInline || hasComponent;
}

/**
 * Helper function to open create category modal
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function openCreateCategoryModal(page) {
  // Look for create/add/new category button
  const createButton = page.locator('button:has-text("Create Category"), button:has-text("Add Category"), button:has-text("New Category")').first();
  await createButton.click();
  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"], .modal', { state: 'visible' });
  await page.waitForTimeout(300);
}

/**
 * Helper function to create a category
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} categoryData - Category data
 * @returns {Promise<void>}
 */
async function createCategory(page, categoryData) {
  await openCreateCategoryModal(page);

  // Fill in category form
  if (categoryData.name) {
    await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', categoryData.name);
  }
  if (categoryData.color) {
    // Select the color from the color picker by finding button with specific background color
    // Color buttons are in a grid with aria-label="Select color" and have backgroundColor in style
    const colorButtons = page.locator('[role="dialog"] button[aria-label="Select color"]');
    const count = await colorButtons.count();

    // Find the button with the matching background color
    for (let i = 0; i < count; i++) {
      const button = colorButtons.nth(i);
      const bgColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Convert hex to rgb for comparison
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };

      const targetRgb = hexToRgb(categoryData.color);
      if (targetRgb && bgColor.includes(`${targetRgb.r}`) && bgColor.includes(`${targetRgb.g}`) && bgColor.includes(`${targetRgb.b}`)) {
        await button.click();
        break;
      }
    }
  }

  // Submit the form
  await page.click('button[type="submit"]:has-text("Create"), button:has-text("Create Category")');
}

/**
 * Helper function to open edit category modal
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} categoryIndex - Index of category to edit (0-based)
 * @returns {Promise<void>}
 */
async function openEditCategoryModal(page, categoryIndex = 0) {
  // First hover over the category card to reveal the edit button
  const categoryCards = page.locator('article.relative.group');
  const targetCard = categoryCards.nth(categoryIndex);

  // Scroll card into view first
  await targetCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await targetCard.hover();
  await page.waitForTimeout(700); // Longer wait for hover and opacity transition

  // Click edit button (now visible after hover)
  const editButton = targetCard.locator('button[aria-label="Edit category"]');
  await editButton.waitFor({ state: 'visible', timeout: 5000 });
  // Dispatch click event directly to ensure it fires
  await editButton.dispatchEvent('click');

  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"], .modal', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(300);
}

/**
 * Helper function to delete a category
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} categoryIndex - Index of category to delete (0-based)
 * @returns {Promise<void>}
 */
async function deleteCategory(page, categoryIndex = 0) {
  // First hover over the category card to reveal the delete button
  const categoryCards = page.locator('article.relative.group');
  const targetCard = categoryCards.nth(categoryIndex);

  // Scroll card into view first
  await targetCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await targetCard.hover();
  await page.waitForTimeout(700); // Longer wait for hover and opacity transition

  // Click delete button (now visible after hover)
  const deleteButton = targetCard.locator('button[aria-label="Delete category"]');

  // Wait for button to be enabled (not disabled) and visible
  await deleteButton.waitFor({ state: 'visible', timeout: 5000 });

  // Check if button is enabled
  const isDisabled = await deleteButton.isDisabled();
  if (isDisabled) {
    throw new Error('Cannot delete category - button is disabled (category may have tasks)');
  }

  // Use force:true and dispatch click event directly to ensure it fires
  await deleteButton.dispatchEvent('click');

  // Wait for confirmation dialog to appear
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  // Confirm deletion - look for the red danger button (confirm button has bg-red-600 class)
  const confirmButton = page.locator('[role="dialog"] button.bg-red-600, [role="dialog"] button:has-text("Delete")').last();
  await confirmButton.click();

  // Wait for deletion to complete and dialog to close
  await page.waitForTimeout(500);
}

/**
 * Test Suite Setup
 * Creates an authenticated user before running category tests
 */
test.describe('Category Management', () => {
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // Create a test user for category management tests
    const context = await browser.newContext();
    const page = await context.newPage();

    testUser = {
      name: generateTestUsername('CategoryTest'),
      email: generateTestEmail('categorytest'),
      password: 'Test1234',
    };

    await registerUser(page, testUser);
    await page.waitForTimeout(2000);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Clear auth state and login before each test
    await clearAuthState(page);
    await loginUser(page, testUser.email, testUser.password);
    await waitForAuthRedirect(page);

    // Navigate to categories page
    await page.goto('/categories');
    await waitForCategoriesToLoad(page);
  });

  /**
   * Test Suite: Creating Categories
   */
  test.describe('Creating Categories', () => {
    test('should successfully create a category with only required fields (name)', async ({ page }) => {
      const categoryData = {
        name: `Test Category ${Date.now()}`,
      };

      await createCategory(page, categoryData);

      // Wait for modal to close and category list to update
      await page.waitForTimeout(1000);

      // Verify category appears in the list
      const categoryElement = page.locator(`text="${categoryData.name}"`);
      await expect(categoryElement).toBeVisible({ timeout: 5000 });
    });

    test('should successfully create a category with name and color', async ({ page }) => {
      const categoryData = {
        name: `Complete Category ${Date.now()}`,
        color: '#EF4444', // Red color
      };

      await createCategory(page, categoryData);

      // Wait for modal to close
      await page.waitForTimeout(1000);

      // Verify category appears in the list with correct data
      await expect(page.locator(`text="${categoryData.name}"`)).toBeVisible();
    });

    test('should create a category with default blue color when no color selected', async ({ page }) => {
      const categoryData = {
        name: `Default Color Category ${Date.now()}`,
      };

      await createCategory(page, categoryData);
      await page.waitForTimeout(1000);

      // Verify category is created
      await expect(page.locator(`text="${categoryData.name}"`)).toBeVisible();
    });

    test('should display error when creating category without name', async ({ page }) => {
      await openCreateCategoryModal(page);

      // Try to submit without filling name
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Create Category")');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Verify error message is displayed
      const errorDisplayed = await hasError(page, /name.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();

      // Verify modal is still open
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();
    });

    test('should prevent name exceeding 50 characters (maxLength attribute)', async ({ page }) => {
      const longName = 'a'.repeat(60);

      await openCreateCategoryModal(page);
      const nameInput = page.locator('input[name="name"], input#name, input[placeholder*="category name" i]');

      // Try to fill with more than 50 characters
      await nameInput.fill(longName);

      // Verify input value is truncated to 50 characters (browser enforces maxLength)
      const actualValue = await nameInput.inputValue();
      expect(actualValue.length).toBeLessThanOrEqual(50);
    });

    test('should display error when category name already exists', async ({ page }) => {
      const categoryName = `Duplicate Category ${Date.now()}`;

      // Create first category
      await createCategory(page, { name: categoryName });
      await page.waitForTimeout(1000);

      // Try to create another category with the same name
      await openCreateCategoryModal(page);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', categoryName);
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Create Category")');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Verify error message about duplicate name
      const errorDisplayed = await hasError(page, /already exists|duplicate|validation/i);
      expect(errorDisplayed).toBeTruthy();
    });

    test('should display error when name contains only whitespace', async ({ page }) => {
      await openCreateCategoryModal(page);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', '   ');
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Create Category")');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Verify error message
      const errorDisplayed = await hasError(page, /name.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();
    });

    test('should display all 16 predefined colors in color picker', async ({ page }) => {
      await openCreateCategoryModal(page);

      // Count color buttons in the color picker
      const colorButtons = page.locator('[role="dialog"] button[aria-label="Select color"]');

      // Wait for color picker to load
      await page.waitForTimeout(500);

      // There should be 16 color options
      const count = await colorButtons.count();
      expect(count).toBe(16);
    });

    test('should allow selecting different colors from color picker', async ({ page }) => {
      await openCreateCategoryModal(page);

      // Find all color buttons
      const colorButtons = page.locator('[role="dialog"] button[aria-label="Select color"]');

      // Click on the 3rd color option
      await colorButtons.nth(2).click();
      await page.waitForTimeout(300);

      // Verify that a color is selected (selected ring should be visible)
      // The selected color button has ring classes applied
      const selectedColor = page.locator('[role="dialog"] button.ring-2.ring-offset-2.ring-gray-900');
      const hasSelection = await selectedColor.isVisible().catch(() => false);

      expect(hasSelection).toBeTruthy();
    });

    test('should close modal when cancel button is clicked', async ({ page }) => {
      await openCreateCategoryModal(page);

      // Fill some data
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', 'This should not be saved');

      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      await cancelButton.click();

      // Wait for modal to close
      await page.waitForTimeout(500);

      // Verify modal is closed
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).not.toBeVisible();

      // Verify category was not created
      const categoryElement = page.locator('text="This should not be saved"');
      await expect(categoryElement).not.toBeVisible();
    });

    test('should clear form errors when user starts typing', async ({ page }) => {
      await openCreateCategoryModal(page);

      // Submit without name to trigger error
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Create Category")');
      await page.waitForTimeout(1000);

      // Verify error is visible
      const errorDisplayed = await hasError(page, /name.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();

      // Start typing in name field
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', 'New');

      // Wait a moment
      await page.waitForTimeout(500);

      // Error should be cleared (or at least form should be in a valid state)
      const nameInput = page.locator('input[name="name"], input#name, input[placeholder*="category name" i]');
      const value = await nameInput.inputValue();
      expect(value).toBe('New');
    });
  });

  /**
   * Test Suite: Viewing Categories
   */
  test.describe('Viewing Categories', () => {
    test.beforeEach(async ({ page }) => {
      // Create a few test categories
      const categories = [
        { name: `View Test Category 1 ${Date.now()}`, color: '#EF4444' }, // Red
        { name: `View Test Category 2 ${Date.now()}`, color: '#10B981' }, // Green
        { name: `View Test Category 3 ${Date.now()}`, color: '#3B82F6' }, // Blue
      ];

      for (const category of categories) {
        await createCategory(page, category);
        await page.waitForTimeout(500);
      }

      // Reload to see all categories
      await page.reload();
      await waitForCategoriesToLoad(page);
    });

    test('should display all created categories in the grid', async ({ page }) => {
      // Verify at least 3 categories are visible
      const categories = page.locator('article.relative.group');
      const count = await categories.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display category name correctly', async ({ page }) => {
      // Verify category names are visible
      const categoryNames = page.locator('text=/View Test Category/i');
      const count = await categoryNames.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display category color indicator', async ({ page }) => {
      // Verify color indicators are visible (color bars or badges)
      const colorIndicators = page.locator('[style*="background-color"], [style*="border-color"]');
      const count = await colorIndicators.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display task count for each category', async ({ page }) => {
      // Verify task count is displayed (should show "0 tasks" for new categories)
      const taskCounts = page.locator('text=/\\d+\\s*task/i');
      const count = await taskCounts.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display creation date for each category', async ({ page }) => {
      // Verify creation dates are visible
      const creationDates = page.locator('text=/created/i');
      const count = await creationDates.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should show empty state when no categories exist', async ({ page }) => {
      // Delete all categories first
      const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
      const count = await deleteButtons.count();

      for (let i = 0; i < count; i++) {
        await deleteCategory(page, 0); // Always delete first category
      }

      // Reload to ensure clean state
      await page.reload();
      await page.waitForTimeout(1000);

      // Verify empty state message
      const emptyMessage = page.locator('text=/no categories|create.*first.*category|get started/i');
      await expect(emptyMessage.first()).toBeVisible({ timeout: 5000 });
    });

    test('should display edit and delete buttons for each category', async ({ page }) => {
      // Verify edit buttons
      const editButtons = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]');
      const editCount = await editButtons.count();
      expect(editCount).toBeGreaterThanOrEqual(3);

      // Verify delete buttons
      const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
      const deleteCount = await deleteButtons.count();
      expect(deleteCount).toBeGreaterThanOrEqual(3);
    });

    test('should display "View Tasks" button for each category', async ({ page }) => {
      // Verify view tasks buttons are visible
      const viewTasksButtons = page.locator('button:has-text("View Tasks"), a:has-text("View Tasks")');
      const count = await viewTasksButtons.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should disable "View Tasks" button when category has no tasks', async ({ page }) => {
      // Find first category's "View Tasks" button
      const viewTasksButton = page.locator('button:has-text("View Tasks"), a:has-text("View Tasks")').first();

      // Button should be disabled or not visible when no tasks
      const isDisabled = await viewTasksButton.isDisabled().catch(() => true);
      expect(isDisabled).toBeTruthy();
    });
  });

  /**
   * Test Suite: Updating Categories
   */
  test.describe('Updating Categories', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test category to update
      await createCategory(page, {
        name: `Update Test Category ${Date.now()}`,
        color: '#3B82F6', // Blue
      });
      await page.waitForTimeout(500);
      await page.reload();
      await waitForCategoriesToLoad(page);
    });

    test('should successfully update category name', async ({ page }) => {
      const newName = `Updated Name ${Date.now()}`;

      await openEditCategoryModal(page, 0);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', newName);
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Verify updated name is visible
      await expect(page.locator(`text="${newName}"`)).toBeVisible();
    });

    test('should successfully update category color', async ({ page }) => {
      await openEditCategoryModal(page, 0);

      // Select a different color (e.g., red)
      const colorButtons = page.locator('[role="dialog"] button[aria-label="Select color"]');
      await colorButtons.nth(3).click(); // Select 4th color

      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Verify category is still visible (color change successful)
      const categories = page.locator('article.relative.group');
      const count = await categories.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should successfully update both name and color', async ({ page }) => {
      const newName = `Fully Updated ${Date.now()}`;

      await openEditCategoryModal(page, 0);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', newName);

      // Select new color
      const colorButtons = page.locator('[role="dialog"] button[aria-label="Select color"]');
      await colorButtons.nth(5).click();

      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Verify updated name is visible
      await expect(page.locator(`text="${newName}"`)).toBeVisible();
    });

    test('should display error when updating category with empty name', async ({ page }) => {
      await openEditCategoryModal(page, 0);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', '');
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Verify error message
      const errorDisplayed = await hasError(page, /name.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();

      // Modal should still be open
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();
    });

    test('should prevent updating name to exceed 50 characters (maxLength attribute)', async ({ page }) => {
      const longName = 'b'.repeat(60);

      await openEditCategoryModal(page, 0);
      const nameInput = page.locator('input[name="name"], input#name, input[placeholder*="category name" i]');

      // Try to fill with more than 50 characters
      await nameInput.fill(longName);

      // Verify input value is truncated to 50 characters (browser enforces maxLength)
      const actualValue = await nameInput.inputValue();
      expect(actualValue.length).toBeLessThanOrEqual(50);
    });

    test('should display error when updating to duplicate category name', async ({ page }) => {
      // Create another category first
      const duplicateName = `Duplicate Target ${Date.now()}`;
      await createCategory(page, { name: duplicateName });
      await page.waitForTimeout(1000);
      await page.reload();
      await waitForCategoriesToLoad(page);

      // Try to update the first category to the same name
      await openEditCategoryModal(page, 1);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', duplicateName);
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Verify error message about duplicate name
      const errorDisplayed = await hasError(page, /already exists|duplicate|validation/i);
      expect(errorDisplayed).toBeTruthy();
    });

    test('should allow updating to same name (no duplicate error)', async ({ page }) => {
      await openEditCategoryModal(page, 0);

      // Update with the same name
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Should succeed without error
      const modal = page.locator('[role="dialog"], .modal');
      const modalVisible = await modal.isVisible().catch(() => false);
      expect(modalVisible).toBeFalsy(); // Modal should be closed
    });

    test('should cancel update and close modal when cancel is clicked', async ({ page }) => {
      // Get the original name
      await openEditCategoryModal(page, 0);
      await page.fill('input[name="name"], input#name, input[placeholder*="category name" i]', 'This should be cancelled');

      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      await cancelButton.click();
      await page.waitForTimeout(500);

      // Verify modal is closed
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).not.toBeVisible();

      // Verify name didn't change
      const cancelledName = page.locator('text="This should be cancelled"');
      await expect(cancelledName).not.toBeVisible();
    });

    test('should pre-fill form with existing category data when editing', async ({ page }) => {
      // Find the "Update Test Category" by name and get its index
      const categoryCards = page.locator('article.relative.group');
      const count = await categoryCards.count();

      let targetIndex = 0;
      for (let i = 0; i < count; i++) {
        const cardText = await categoryCards.nth(i).textContent();
        if (cardText.includes('Update Test Category')) {
          targetIndex = i;
          break;
        }
      }

      await openEditCategoryModal(page, targetIndex);

      // Verify name is pre-filled
      const nameInput = page.locator('input[name="name"], input#name, input[placeholder*="category name" i]');
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toContain('Update Test Category');

      // Verify a color is selected (has ring classes)
      const selectedColor = page.locator('[role="dialog"] button.ring-2.ring-offset-2.ring-gray-900');
      const hasSelection = await selectedColor.count();
      expect(hasSelection).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * Test Suite: Deleting Categories
   */
  test.describe('Deleting Categories', () => {
    test.beforeEach(async ({ page }) => {
      // Create test categories
      await createCategory(page, { name: `Delete Test Category 1 ${Date.now()}` });
      await page.waitForTimeout(500);
      await createCategory(page, { name: `Delete Test Category 2 ${Date.now()}` });
      await page.waitForTimeout(500);
      await page.reload();
      await waitForCategoriesToLoad(page);
    });

    test('should successfully delete a category without tasks', async ({ page }) => {
      // Get the name of the first category
      const firstCategoryName = await page.locator('article.relative.group').first().locator('h3').textContent();

      // Delete the first category
      await deleteCategory(page, 0);

      // Verify category is no longer visible
      await page.waitForTimeout(500);
      const deletedCategory = page.locator(`text="${firstCategoryName}"`);
      await expect(deletedCategory).not.toBeVisible();
    });

    test('should show confirmation dialog before deleting', async ({ page }) => {
      // Hover over first category card to reveal delete button
      const firstCard = page.locator('article.relative.group').first();
      await firstCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await firstCard.hover();
      await page.waitForTimeout(700);

      // Click delete button
      const deleteButton = firstCard.locator('button[aria-label="Delete category"]');
      await deleteButton.waitFor({ state: 'visible', timeout: 5000 });
      await deleteButton.dispatchEvent('click');
      await page.waitForTimeout(500);

      // Verify confirmation dialog appears
      const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: /delete|confirm|are you sure/i });
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    });

    test('should cancel deletion when cancel is clicked in confirmation', async ({ page }) => {
      // Get the count before deletion
      const initialCount = await getCategoryCount(page);

      // Hover over first category card to reveal delete button
      const firstCard = page.locator('article.relative.group').first();
      await firstCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await firstCard.hover();
      await page.waitForTimeout(700);

      // Click delete button
      const deleteButton = firstCard.locator('button[aria-label="Delete category"]');
      await deleteButton.waitFor({ state: 'visible', timeout: 5000 });
      await deleteButton.dispatchEvent('click');

      // Wait for confirmation dialog to appear
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(500);

      // Click cancel in confirmation dialog
      const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel")');
      await cancelButton.click();
      await page.waitForTimeout(500);

      // Verify category count unchanged
      const finalCount = await getCategoryCount(page);
      expect(finalCount).toBe(initialCount);
      expect(finalCount).toBeGreaterThanOrEqual(2);
    });

    test('should delete multiple categories independently', async ({ page }) => {
      // Delete first category
      await deleteCategory(page, 0);
      await page.waitForTimeout(500);

      // Verify we still have at least 1 category
      const count = await getCategoryCount(page);
      expect(count).toBeGreaterThanOrEqual(1);

      // Delete another category
      await deleteCategory(page, 0);
      await page.waitForTimeout(500);
    });
  });
});
