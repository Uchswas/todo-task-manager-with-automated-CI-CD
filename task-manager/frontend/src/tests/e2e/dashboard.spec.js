const { test, expect } = require('@playwright/test');
const {
  generateTestEmail,
  generateTestUsername,
  registerUser,
  clearAuthState,
  waitForAuthRedirect,
} = require('./fixtures/auth-fixtures');

/**
 * Helper function to wait for dashboard to load
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function waitForDashboardToLoad(page) {
  // Wait for welcome message to appear
  await page.waitForSelector('text=/Welcome back/i', {
    timeout: 10000,
    state: 'visible',
  });
  // Wait a moment for any animations/loading to complete
  await page.waitForTimeout(500);
}

function getLocalDateString(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Helper function to create a test task via UI
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} taskData - Task data
 * @returns {Promise<void>}
 */
async function createTestTask(page, taskData) {
  await page.goto('/tasks');
  await page.waitForTimeout(500);

  // Click Add Task button (look for Create Task, Add Task, or New Task)
  const createButton = page.locator('button:has-text("Create Task"), button:has-text("Add Task"), button:has-text("New Task")').first();
  await createButton.click();

  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"], .modal', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);

  // Fill in task form
  await page.fill('input[name="title"], input#title', taskData.title);

  if (taskData.description) {
    await page.fill('textarea[name="description"], textarea#description', taskData.description);
  }

  if (taskData.priority) {
    await page.selectOption('select[name="priority"], select#priority', taskData.priority);
  }

  if (taskData.dueDate) {
    await page.fill('input[name="due_date"], input[name="dueDate"], input#due_date, input#dueDate', taskData.dueDate);
  }

  // Submit form
  await page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save"), button:has-text("Create Task")');

  // Wait for success and modal to close
  await page.waitForTimeout(1500);
}

// Setup: Register and login a fresh user before each test
test.beforeEach(async ({ page }) => {
  await clearAuthState(page);

  const testEmail = generateTestEmail();
  const testUsername = generateTestUsername();
  const password = 'Test123!@#';

  // Register user (this automatically logs them in and redirects to dashboard)
  await registerUser(page, {
    name: testUsername,
    email: testEmail,
    password: password,
  });

  // Wait for auth redirect after registration (registration auto-logs in the user)
  await waitForAuthRedirect(page, 10000);
});

// Cleanup: Clear auth state after each test
test.afterEach(async ({ page }) => {
  await clearAuthState(page);
});

test.describe('Dashboard Page - Initial Load', () => {
  test('should display welcome header with user name', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Check for welcome message
    const welcomeHeader = page.locator('h1:has-text("Welcome back")');
    await expect(welcomeHeader).toBeVisible();

    // Verify subtitle is present
    const subtitle = page.locator('text=/what.*s happening with your tasks/i');
    await expect(subtitle).toBeVisible();
  });

  test('should display all four statistics cards', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Check for all statistics cards
    await expect(page.locator('text="Total Tasks"')).toBeVisible();
    await expect(page.locator('text="Completed"')).toBeVisible();
    await expect(page.locator('text="Due Today"')).toBeVisible();
    await expect(page.locator('text="Overdue"')).toBeVisible();
  });

  test('should display zero statistics for new user', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // All stats should be zero for new user
    const statCards = page.locator('.bg-white.overflow-hidden.shadow.rounded-lg');

    // Get all text content and verify zeros appear
    const statsText = await statCards.allTextContents();
    const combinedText = statsText.join(' ');

    // Should have multiple zeros in the stats
    expect(combinedText).toContain('0');
  });

  test('should display Recent Tasks section', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    await expect(page.locator('h3:has-text("Recent Tasks")')).toBeVisible();
    await expect(page.locator('text="View all"').first()).toBeVisible();
  });

  test('should display Overdue Tasks section', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    await expect(page.locator('h3:has-text("Overdue Tasks")')).toBeVisible();
  });

  test('should display Quick Actions section', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    await expect(page.locator('h3:has-text("Quick Actions")')).toBeVisible();

    // Check for all quick action buttons
    await expect(page.locator('text="Add Task"').last()).toBeVisible();
    await expect(page.locator('text="Manage Categories"')).toBeVisible();
    await expect(page.locator('text="View Statistics"')).toBeVisible();
    await expect(page.locator('text="Profile Settings"')).toBeVisible();
  });

  test('should show empty state for recent tasks when no tasks exist', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Should show empty state message
    const emptyMessage = page.locator('text=/No tasks yet|Create your first task/i');
    await expect(emptyMessage).toBeVisible();
  });

  test('should show success message for overdue tasks when none exist', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Should show "Great job!" message
    await expect(page.locator('text="Great job!"')).toBeVisible();
    await expect(page.locator('text="No overdue tasks"')).toBeVisible();
  });

  test('should handle loading state', async ({ page }) => {
    await page.goto('/');

    // Check if loading spinner appears (might be very brief)
    const loadingSpinner = page.locator('.animate-spin, [role="status"]');
    const spinnerCount = await loadingSpinner.count();

    if (spinnerCount > 0) {
      await loadingSpinner.first().waitFor({ state: 'hidden', timeout: 10000 });
    }

    // Dashboard content should be visible
    await waitForDashboardToLoad(page);
    await expect(page.locator('text=/Welcome back/i')).toBeVisible();
  });
});

test.describe('Dashboard Page - Statistics Display', () => {
  test('should update Total Tasks count when task is created', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Create a task
    await createTestTask(page, {
      title: 'Test Task for Stats',
      priority: 'medium',
    });

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Total Tasks should now be 1
    const totalTasksCard = page.locator('text="Total Tasks"').locator('..').locator('..');
    await expect(totalTasksCard).toContainText('1');
  });

  test('should update Completed count when task is marked complete', async ({ page }) => {
    await page.goto('/');

    // Create a task
    await createTestTask(page, {
      title: 'Task to Complete',
      priority: 'low',
    });

    // Mark it as complete on tasks page
    await page.goto('/tasks');
    await page.waitForTimeout(500);

    // Click the first checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.click();
    await page.waitForTimeout(1000);

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Completed should be 1
    const completedCard = page.locator('text="Completed"').locator('..').locator('..');
    await expect(completedCard).toContainText('1');
  });

  test('should show task as due today when due date is today', async ({ page }) => {
    // Get today's date in YYYY-MM-DD format
    const today = getLocalDateString();

    await page.goto('/');

    // Create a task due today
    await createTestTask(page, {
      title: 'Task Due Today',
      priority: 'high',
      dueDate: today,
    });

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Due Today should be 1
    const dueTodayCard = page.locator('text="Due Today"').locator('..').locator('..');
    await expect(dueTodayCard).toContainText('1');
  });

  test('should show task as overdue when due date is in the past', async ({ page }) => {
    // Get yesterday's date
    const yesterdayStr = getLocalDateString(-1);

    await page.goto('/');

    // Create an overdue task
    await createTestTask(page, {
      title: 'Overdue Task',
      priority: 'high',
      dueDate: yesterdayStr,
    });

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Overdue should be 1
    const overdueCard = page.locator('text="Overdue"').locator('..').locator('..');
    await expect(overdueCard).toContainText('1');
  });

  test('should display correct statistics with multiple tasks', async ({ page }) => {
    const today = getLocalDateString();
    const yesterdayStr = getLocalDateString(-1);

    // Create multiple tasks
    await createTestTask(page, { title: 'Task 1', priority: 'low' });
    await createTestTask(page, { title: 'Task 2 Due Today', priority: 'medium', dueDate: today });
    await createTestTask(page, { title: 'Task 3 Overdue', priority: 'high', dueDate: yesterdayStr });

    // Mark first task as complete
    await page.goto('/tasks');
    await page.waitForTimeout(500);
    const firstCheckbox = page.locator('input[type="checkbox"]').last();
    await firstCheckbox.click();
    await page.waitForTimeout(1000);

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Wait a bit for dashboard statistics to update
    await page.waitForTimeout(1000);

    // Verify statistics
    const totalTasksCard = page.locator('text="Total Tasks"').locator('..').locator('..');
    await expect(totalTasksCard).toContainText('3');

    const completedCard = page.locator('text="Completed"').locator('..').locator('..');
    await expect(completedCard).toContainText('1');

    const dueTodayCard = page.locator('text="Due Today"').locator('..').locator('..');
    await expect(dueTodayCard).toContainText('1');

    const overdueCard = page.locator('text="Overdue"').locator('..').locator('..');
    await expect(overdueCard).toContainText('1');
  });
});

test.describe('Dashboard Page - Recent Tasks Widget', () => {
  test('should display recent tasks with correct information', async ({ page }) => {
    // Create a task
    await createTestTask(page, {
      title: 'Recent Task Example',
      description: 'This is a test task',
      priority: 'high',
    });

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Check task appears in recent tasks - use the parent container with class bg-white shadow rounded-lg
    const recentTasksSection = page.locator('h3:has-text("Recent Tasks")').locator('../..');
    await expect(recentTasksSection).toContainText('Recent Task Example');
    await expect(recentTasksSection).toContainText('high');
  });

  test('should show priority badge for each task', async ({ page }) => {
    await createTestTask(page, {
      title: 'High Priority Task',
      priority: 'high',
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const recentTasksSection = page.locator('h3:has-text("Recent Tasks")').locator('../..');
    const priorityBadge = recentTasksSection.locator('text="high"');
    await expect(priorityBadge).toBeVisible();
  });

  test('should show due date for tasks with due date', async ({ page }) => {
    const today = getLocalDateString();

    await createTestTask(page, {
      title: 'Task with Due Date',
      priority: 'medium',
      dueDate: today,
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const recentTasksSection = page.locator('h3:has-text("Recent Tasks")').locator('../..');
    await expect(recentTasksSection).toContainText(/Due:/i);
  });
});

test.describe('Dashboard Page - Overdue Tasks Widget', () => {
  test('should display overdue tasks with warning styling', async ({ page }) => {
    const yesterdayStr = getLocalDateString(-1);

    await createTestTask(page, {
      title: 'Overdue Task Example',
      priority: 'high',
      dueDate: yesterdayStr,
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const overdueSection = page.locator('h3:has-text("Overdue Tasks")').locator('../..');
    await expect(overdueSection).toContainText('Overdue Task Example');

    // Check for red styling indicators
    const redIndicator = overdueSection.locator('.bg-red-500, .border-red-200, .bg-red-50');
    await expect(redIndicator.first()).toBeVisible();
  });

  test('should not display completed tasks as overdue', async ({ page }) => {
    const yesterdayStr = getLocalDateString(-1);

    await createTestTask(page, {
      title: 'Completed Overdue Task',
      priority: 'high',
      dueDate: yesterdayStr,
    });

    // Mark it as complete
    await page.goto('/tasks');
    await page.waitForTimeout(500);
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.click();
    await page.waitForTimeout(1000);

    // Return to dashboard
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Overdue section should show empty state
    await expect(page.locator('text="Great job!"')).toBeVisible();
    await expect(page.locator('text="No overdue tasks"')).toBeVisible();
  });

  test('should show priority badge for overdue tasks', async ({ page }) => {
    const yesterdayStr = getLocalDateString(-1);

    await createTestTask(page, {
      title: 'High Priority Overdue',
      priority: 'high',
      dueDate: yesterdayStr,
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const overdueSection = page.locator('h3:has-text("Overdue Tasks")').locator('../..');
    const priorityBadge = overdueSection.locator('text="high"');
    await expect(priorityBadge).toBeVisible();
  });

  test('should show due date for overdue tasks', async ({ page }) => {
    const yesterdayStr = getLocalDateString(-1);

    await createTestTask(page, {
      title: 'Task with Due Date',
      priority: 'medium',
      dueDate: yesterdayStr,
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const overdueSection = page.locator('h3:has-text("Overdue Tasks")').locator('../..');
    await expect(overdueSection).toContainText(/Due:/i);
  });

  test('should show "View all" link when overdue tasks exist', async ({ page }) => {
    const yesterdayStr = getLocalDateString(-1);

    await createTestTask(page, {
      title: 'Overdue Task',
      priority: 'high',
      dueDate: yesterdayStr,
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const overdueSection = page.locator('h3:has-text("Overdue Tasks")').locator('../..');
    const viewAllLink = overdueSection.locator('text="View all"');
    await expect(viewAllLink).toBeVisible();
  });

  test('should not show "View all" link when no overdue tasks', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    const overdueSection = page.locator('h3:has-text("Overdue Tasks")').locator('../..');
    const viewAllLink = overdueSection.locator('text="View all"');
    await expect(viewAllLink).not.toBeVisible();
  });

  test('should navigate to filtered tasks page when "View all" is clicked', async ({ page }) => {
    const yesterdayStr = getLocalDateString(-1);

    await createTestTask(page, {
      title: 'Overdue Task',
      priority: 'high',
      dueDate: yesterdayStr,
    });

    await page.goto('/');
    await waitForDashboardToLoad(page);

    const overdueSection = page.locator('h3:has-text("Overdue Tasks")').locator('../..');
    const viewAllLink = overdueSection.locator('text="View all"');
    await viewAllLink.click();

    // Should navigate to tasks page with overdue filter
    await expect(page).toHaveURL(/\/tasks\?.*overdue=true/);
  });
});

test.describe('Dashboard Page - Quick Actions', () => {
  test('should navigate to tasks page with create action when "Add Task" is clicked', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Click "Add Task" quick action
    const addTaskButton = page.locator('text="Add Task"').last();
    await addTaskButton.click();

    // Should navigate to tasks page (with optional action=create parameter)
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/tasks/);
  });

  test('should navigate to categories page when "Manage Categories" is clicked', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    const manageCategoriesButton = page.locator('text="Manage Categories"');
    await manageCategoriesButton.click();

    await expect(page).toHaveURL(/\/categories/);
  });

  test('should navigate to statistics page when "View Statistics" is clicked', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    const viewStatisticsButton = page.locator('text="View Statistics"');
    await viewStatisticsButton.click();

    await expect(page).toHaveURL(/\/statistics/);
  });

  test('should navigate to profile page when "Profile Settings" is clicked', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    const profileSettingsButton = page.locator('text="Profile Settings"');
    await profileSettingsButton.click();

    await expect(page).toHaveURL(/\/profile/);
  });

  test('should display all quick action icons', async ({ page }) => {
    await page.goto('/');
    await waitForDashboardToLoad(page);

    // Each quick action should have an icon (SVG)
    const quickActionsSection = page.locator('h3:has-text("Quick Actions")').locator('..');
    const icons = quickActionsSection.locator('svg');
    const iconCount = await icons.count();

    // Should have 4 icons (one for each quick action)
    expect(iconCount).toBeGreaterThanOrEqual(4);
  });
});
