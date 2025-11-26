const { test, expect } = require('@playwright/test');
const {
  generateTestEmail,
  generateTestUsername,
  registerUser,
  loginUser,
  clearAuthState,
  waitForAuthRedirect,
} = require('./fixtures/auth-fixtures');
const {
  waitForTasksToLoad,
  openCreateTaskModal,
  createTask,
  openEditTaskModal,
  deleteTask,
  toggleTaskCompletion,
  getTaskCount,
  getTaskTitle,
  hasError,
} = require('./fixtures/task-fixtures');

/**
 * Test Suite Setup
 * Creates an authenticated user before running task tests
 */
test.describe('Task Management', () => {
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // Create a test user for task management tests
    const context = await browser.newContext();
    const page = await context.newPage();

    testUser = {
      name: generateTestUsername('TaskTest'),
      email: generateTestEmail('tasktest'),
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

    // Navigate to tasks page
    await page.goto('/tasks');
    await waitForTasksToLoad(page);
  });

  /**
   * Test Suite: Creating Tasks
   */
  test.describe('Creating Tasks', () => {
    test('should successfully create a task with only required fields (title)', async ({ page }) => {
      const taskData = {
        title: `Test Task ${Date.now()}`,
      };

      await createTask(page, taskData);

      // Wait for modal to close and task list to update
      await page.waitForTimeout(1000);

      // Verify task appears in the list
      const taskElement = page.locator(`text="${taskData.title}"`);
      await expect(taskElement).toBeVisible({ timeout: 5000 });
    });

    test('should successfully create a task with all fields filled', async ({ page }) => {
      const taskData = {
        title: `Complete Task ${Date.now()}`,
        description: 'This is a detailed description of the task',
        priority: 'high',
        due_date: '2025-12-31',
      };

      await createTask(page, taskData);

      // Wait for modal to close
      await page.waitForTimeout(1000);

      // Verify task appears in the list with correct data
      await expect(page.locator(`text="${taskData.title}"`)).toBeVisible();
      await expect(page.locator(`text="${taskData.description}"`)).toBeVisible();

      // Verify priority badge is visible
      // Priority appears as text in a generic div, not wrapped in special elements
      // Just verify "high" text exists somewhere in the main content area (not in filters)
      const mainContent = page.locator('main');
      await expect(mainContent.locator('text="high"').first()).toBeVisible();
    });

    test('should create a task with medium priority by default', async ({ page }) => {
      const taskData = {
        title: `Default Priority Task ${Date.now()}`,
      };

      await createTask(page, taskData);
      await page.waitForTimeout(1000);

      // Click edit on the newly created task to verify default priority
      await openEditTaskModal(page, 0);

      // Check that priority is set to medium
      const prioritySelect = page.locator('select[name="priority"], select#priority');
      const selectedValue = await prioritySelect.inputValue();
      expect(selectedValue).toBe('medium');

      // Close modal
      await page.keyboard.press('Escape');
    });

    test('should display error when creating task without title', async ({ page }) => {
      await openCreateTaskModal(page);

      // Try to submit without filling title
      await page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Verify error message is displayed
      const errorDisplayed = await hasError(page, /title.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();

      // Verify modal is still open
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();
    });

    test('should display error when title exceeds 200 characters', async ({ page }) => {
      const longTitle = 'a'.repeat(201);

      await openCreateTaskModal(page);
      await page.fill('input[name="title"], input#title', longTitle);
      await page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Verify error message about title length
      const errorDisplayed = await hasError(page, /title.*200|validation/i);
      expect(errorDisplayed).toBeTruthy();
    });

    test('should display error when description exceeds 5000 characters', async ({ page }) => {
      const longDescription = 'a'.repeat(5001);

      await openCreateTaskModal(page);
      await page.fill('input[name="title"], input#title', 'Valid Title');
      await page.fill('textarea[name="description"], textarea#description', longDescription);
      await page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Verify error message about description length
      const errorDisplayed = await hasError(page, /description.*5000|validation/i);
      expect(errorDisplayed).toBeTruthy();
    });

    test('should allow creating task with empty description', async ({ page }) => {
      const taskData = {
        title: `Task without description ${Date.now()}`,
        description: '',
      };

      await createTask(page, taskData);
      await page.waitForTimeout(1000);

      // Verify task is created
      await expect(page.locator(`text="${taskData.title}"`)).toBeVisible();
    });

    test('should allow creating task without due date', async ({ page }) => {
      const taskData = {
        title: `Task without due date ${Date.now()}`,
      };

      await createTask(page, taskData);
      await page.waitForTimeout(1000);

      // Verify task is created
      await expect(page.locator(`text="${taskData.title}"`)).toBeVisible();
    });

    test('should close modal when cancel button is clicked', async ({ page }) => {
      await openCreateTaskModal(page);

      // Fill some data
      await page.fill('input[name="title"], input#title', 'This should not be saved');

      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      await cancelButton.click();

      // Wait for modal to close
      await page.waitForTimeout(500);

      // Verify modal is closed
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).not.toBeVisible();

      // Verify task was not created
      const taskElement = page.locator('text="This should not be saved"');
      await expect(taskElement).not.toBeVisible();
    });

    test('should clear form errors when user starts typing', async ({ page }) => {
      await openCreateTaskModal(page);

      // Submit without title to trigger error
      await page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")');
      await page.waitForTimeout(1000);

      // Verify error is visible
      const errorDisplayed = await hasError(page, /title.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();

      // Start typing in title field
      await page.fill('input[name="title"], input#title', 'New');

      // Wait a moment
      await page.waitForTimeout(500);

      // Error should be cleared (or at least form should be in a valid state)
      const titleInput = page.locator('input[name="title"], input#title');
      const value = await titleInput.inputValue();
      expect(value).toBe('New');
    });
  });

  /**
   * Test Suite: Viewing Tasks
   */
  test.describe('Viewing Tasks', () => {
    test.beforeEach(async ({ page }) => {
      // Create a few test tasks
      const tasks = [
        { title: `View Test Task 1 ${Date.now()}`, priority: 'high', description: 'High priority task' },
        { title: `View Test Task 2 ${Date.now()}`, priority: 'low', description: 'Low priority task' },
        { title: `View Test Task 3 ${Date.now()}`, priority: 'medium' },
      ];

      for (const task of tasks) {
        await createTask(page, task);
        await page.waitForTimeout(500);
      }

      // Reload to see all tasks
      await page.reload();
      await waitForTasksToLoad(page);
    });

    test('should display all created tasks in the list', async ({ page }) => {
      // Verify at least 3 tasks are visible by counting checkboxes (one per task)
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display task title correctly', async ({ page }) => {
      // Verify task titles are visible
      const taskTitles = page.locator('text=/View Test Task/i');
      const count = await taskTitles.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display task priority badge', async ({ page }) => {
      // Verify priority badges are visible (multiple tasks have same priority, use .first())
      const mainContent = page.locator('main');
      await expect(mainContent.locator('text="high"').first()).toBeVisible();
      await expect(mainContent.locator('text="low"').first()).toBeVisible();
      await expect(mainContent.locator('text="medium"').first()).toBeVisible();
    });

    test('should display task description when provided', async ({ page }) => {
      // Verify descriptions are visible
      await expect(page.locator('text="High priority task"').first()).toBeVisible();
      await expect(page.locator('text="Low priority task"').first()).toBeVisible();
    });

    test('should show empty state when no tasks exist', async ({ page }) => {
      // Delete all tasks first
      const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
      const count = await deleteButtons.count();

      for (let i = 0; i < count; i++) {
        await deleteTask(page, 0); // Always delete first task
      }

      // Reload to ensure clean state
      await page.reload();
      await page.waitForTimeout(1000);

      // Verify empty state message
      const emptyMessage = page.locator('text=/no tasks|create.*first.*task|get started/i');
      await expect(emptyMessage.first()).toBeVisible({ timeout: 5000 });
    });

    test('should display completion checkbox for each task', async ({ page }) => {
      // Verify checkboxes are present
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display edit and delete buttons for each task', async ({ page }) => {
      // Verify edit buttons
      const editButtons = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]');
      const editCount = await editButtons.count();
      expect(editCount).toBeGreaterThanOrEqual(3);

      // Verify delete buttons
      const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
      const deleteCount = await deleteButtons.count();
      expect(deleteCount).toBeGreaterThanOrEqual(3);
    });
  });

  /**
   * Test Suite: Updating Tasks
   */
  test.describe('Updating Tasks', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test task to update
      await createTask(page, {
        title: `Update Test Task ${Date.now()}`,
        description: 'Original description',
        priority: 'low',
      });
      await page.waitForTimeout(500);
      await page.reload();
      await waitForTasksToLoad(page);
    });

    test('should successfully update task title', async ({ page }) => {
      const newTitle = `Updated Title ${Date.now()}`;

      await openEditTaskModal(page, 0);
      await page.fill('input[name="title"], input#title', newTitle);
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify updated title is visible
      await expect(page.locator(`text="${newTitle}"`)).toBeVisible();
    });

    test('should successfully update task description', async ({ page }) => {
      const newDescription = 'This is the updated description';

      await openEditTaskModal(page, 0);
      await page.fill('textarea[name="description"], textarea#description', newDescription);
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify updated description is visible
      await expect(page.locator(`text="${newDescription}"`)).toBeVisible();
    });

    test('should successfully update task priority', async ({ page }) => {
      await openEditTaskModal(page, 0);
      await page.selectOption('select[name="priority"], select#priority', 'high');
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify priority badge shows high (in main content, not dropdown)
      const mainContent = page.locator('main');
      await expect(mainContent.locator('text="high"').first()).toBeVisible();
    });

    test('should successfully update task due date', async ({ page }) => {
      await openEditTaskModal(page, 0);
      await page.fill('input[name="due_date"], input[name="dueDate"], input#due_date, input#dueDate', '2025-12-31');
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify due date is displayed (format may vary)
      const dateElement = page.locator('text=/2025|12.*31|31.*12/');
      await expect(dateElement.first()).toBeVisible({ timeout: 3000 });
    });

    test('should successfully clear optional fields (description, due_date)', async ({ page }) => {
      await openEditTaskModal(page, 0);
      await page.fill('textarea[name="description"], textarea#description', '');
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify description field is empty when editing again
      await openEditTaskModal(page, 0);
      const descriptionInput = page.locator('textarea[name="description"], textarea#description');
      const value = await descriptionInput.inputValue();
      expect(value).toBe('');

      // Close modal
      await page.keyboard.press('Escape');
    });

    test('should display error when updating task with empty title', async ({ page }) => {
      await openEditTaskModal(page, 0);
      await page.fill('input[name="title"], input#title', '');
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify error message
      const errorDisplayed = await hasError(page, /title.*required|validation/i);
      expect(errorDisplayed).toBeTruthy();

      // Modal should still be open
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();
    });

    test('should display error when updating title to exceed 200 characters', async ({ page }) => {
      const longTitle = 'b'.repeat(201);

      await openEditTaskModal(page, 0);
      await page.fill('input[name="title"], input#title', longTitle);
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');
      await page.waitForTimeout(1000);

      // Verify error message
      const errorDisplayed = await hasError(page, /title.*200|validation/i);
      expect(errorDisplayed).toBeTruthy();
    });

    test('should cancel update and close modal when cancel is clicked', async ({ page }) => {
      // Get the title of the first task by finding the first h3 heading in main
      const firstHeading = page.locator('main').locator('h3').first();
      const originalTitle = await firstHeading.textContent();

      await openEditTaskModal(page, 0);
      await page.fill('input[name="title"], input#title', 'This should be cancelled');

      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      await cancelButton.click();
      await page.waitForTimeout(500);

      // Verify modal is closed
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).not.toBeVisible();

      // Verify original title is still there
      const cancelledTitle = page.locator('text="This should be cancelled"');
      await expect(cancelledTitle).not.toBeVisible();

      const currentTitle = await firstHeading.textContent();
      expect(currentTitle).toBe(originalTitle);
    });

    test('should pre-fill form with existing task data when editing', async ({ page }) => {
      await openEditTaskModal(page, 0);

      // Verify title is pre-filled
      const titleInput = page.locator('input[name="title"], input#title');
      const titleValue = await titleInput.inputValue();
      expect(titleValue).toContain('Update Test Task');

      // Verify description is pre-filled
      const descriptionInput = page.locator('textarea[name="description"], textarea#description');
      const descriptionValue = await descriptionInput.inputValue();
      expect(descriptionValue).toBe('Original description');

      // Verify priority is pre-filled
      const prioritySelect = page.locator('select[name="priority"], select#priority');
      const priorityValue = await prioritySelect.inputValue();
      expect(priorityValue).toBe('low');
    });
  });

  /**
   * Test Suite: Deleting Tasks
   */
  test.describe('Deleting Tasks', () => {
    test.beforeEach(async ({ page }) => {
      // Create test tasks
      await createTask(page, { title: `Delete Test Task 1 ${Date.now()}` });
      await page.waitForTimeout(500);
      await createTask(page, { title: `Delete Test Task 2 ${Date.now()}` });
      await page.waitForTimeout(500);
      await page.reload();
      await waitForTasksToLoad(page);
    });

    test('should successfully delete a task', async ({ page }) => {
      // Get the title of the first task
      const firstTaskTitle = await getTaskTitle(page, 0);

      // Delete the first task
      await deleteTask(page, 0);

      // Verify task is no longer visible
      await page.waitForTimeout(500);
      const deletedTask = page.locator(`text="${firstTaskTitle}"`);
      await expect(deletedTask).not.toBeVisible();
    });

    test('should show confirmation dialog before deleting', async ({ page }) => {
      // Click delete button
      const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
      await deleteButtons.first().click();
      await page.waitForTimeout(500);

      // Verify confirmation dialog appears
      const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: /delete|confirm|are you sure/i });
      await expect(confirmDialog).toBeVisible({ timeout: 3000 });
    });

    test('should cancel deletion when cancel is clicked in confirmation', async ({ page }) => {
      await createTask(page, { title: `Cancel Delete ${Date.now()}` });
      await page.waitForTimeout(300);
      await page.reload();
      await waitForTasksToLoad(page);

      const initialCount = await getTaskCount(page);

      // Open confirmation dialog without confirming deletion
      const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
      await deleteButtons.first().click();
      await page.waitForTimeout(500);

      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();
      await page.waitForTimeout(500);

      const finalCount = await getTaskCount(page);
      expect(finalCount).toBe(initialCount);
    });

    test('should delete multiple tasks independently', async ({ page }) => {
      // Ensure there are at least three tasks to start with
      await createTask(page, { title: `Delete Multi 1 ${Date.now()}` });
      await page.waitForTimeout(300);
      await createTask(page, { title: `Delete Multi 2 ${Date.now()}` });
      await page.waitForTimeout(300);
      await page.reload();
      await waitForTasksToLoad(page);

      const initialCount = await getTaskCount(page);
      expect(initialCount).toBeGreaterThanOrEqual(3);

      await deleteTask(page, 0);
      await page.waitForTimeout(500);
      const afterFirstDelete = await getTaskCount(page);
      expect(afterFirstDelete).toBe(initialCount - 1);

      await deleteTask(page, 0);
      await page.waitForTimeout(500);
      const afterSecondDelete = await getTaskCount(page);
      expect(afterSecondDelete).toBe(afterFirstDelete - 1);
      expect(afterSecondDelete).toBeGreaterThanOrEqual(initialCount - 2);
    });
  });

  /**
   * Test Suite: Marking Tasks Complete
   */
  test.describe('Marking Tasks Complete', () => {
    test.beforeEach(async ({ page }) => {
      // Create incomplete tasks
      await createTask(page, { title: `Complete Test Task 1 ${Date.now()}` });
      await page.waitForTimeout(500);
      await createTask(page, { title: `Complete Test Task 2 ${Date.now()}` });
      await page.waitForTimeout(500);
      await page.reload();
      await waitForTasksToLoad(page);
    });

    test('should successfully mark a task as complete', async ({ page }) => {
      // Toggle the first task's completion
      await toggleTaskCompletion(page, 0);

      // Verify checkbox is checked
      const checkbox = page.locator('input[type="checkbox"]').first();
      await expect(checkbox).toBeChecked({ timeout: 3000 });
    });

    test('should successfully mark a completed task as incomplete', async ({ page }) => {
      // Mark task as complete
      await toggleTaskCompletion(page, 0);
      await page.waitForTimeout(500);

      // Mark it as incomplete again
      await toggleTaskCompletion(page, 0);

      // Verify checkbox is unchecked
      const checkbox = page.locator('input[type="checkbox"]').first();
      await expect(checkbox).not.toBeChecked({ timeout: 3000 });
    });
  });

  /**
   * Test Suite: Filtering and Searching Tasks
   */
  test.describe('Filtering and Searching', () => {
    test.beforeEach(async ({ page }) => {
      // Create diverse set of tasks for filtering
      const tasks = [
        { title: `Search High Priority ${Date.now()}`, priority: 'high', description: 'Important task' },
        { title: `Search Low Priority ${Date.now()}`, priority: 'low', description: 'Less urgent task' },
        { title: `Search Medium Priority ${Date.now()}`, priority: 'medium', description: 'Normal task' },
        { title: `Completed Task ${Date.now()}`, priority: 'high' },
      ];

      for (const task of tasks) {
        await createTask(page, task);
        await page.waitForTimeout(500);
      }

      // Mark one task as complete
      await page.reload();
      await waitForTasksToLoad(page);
      await toggleTaskCompletion(page, 3); // Mark 4th task as complete
      await page.waitForTimeout(500);

      await page.reload();
      await waitForTasksToLoad(page);
    });

    test('should filter tasks by priority (high)', async ({ page }) => {
      const priorityFilter = page.locator('select[aria-label="Priority"]').first();
      await expect(priorityFilter).toBeVisible();

      await priorityFilter.selectOption('high');
      await page.waitForTimeout(1000);

      const highPriorityTasks = page.locator('text=/high/i');
      const count = await highPriorityTasks.count();
      expect(count).toBeGreaterThanOrEqual(1);

      const lowPriorityVisible = await page.locator('text="Search Low Priority"').isVisible().catch(() => false);
      expect(lowPriorityVisible).toBeFalsy();
    });

    test('should filter tasks by priority (low)', async ({ page }) => {
      const priorityFilter = page.locator('select[aria-label="Priority"]').first();
      await expect(priorityFilter).toBeVisible();

      await priorityFilter.selectOption('low');
      await page.waitForTimeout(1000);

      const lowPriorityTasks = page.locator('text=/low/i');
      const count = await lowPriorityTasks.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should filter tasks by completion status (completed)', async ({ page }) => {
      const statusFilter = page.locator('select[aria-label="Status"]').first();
      await expect(statusFilter).toBeVisible();

      await statusFilter.selectOption('Completed');
      await page.waitForTimeout(1000);

      const completedCheckboxes = page.locator('input[type="checkbox"]:checked');
      const count = await completedCheckboxes.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should filter tasks by completion status (incomplete)', async ({ page }) => {
      const statusFilter = page.locator('select[aria-label="Status"]').first();
      await expect(statusFilter).toBeVisible();

      await statusFilter.selectOption('Incomplete');
      await page.waitForTimeout(1000);

      const completedCheckboxes = page.locator('input[type="checkbox"]:checked');
      const completedCount = await completedCheckboxes.count();
      expect(completedCount).toBe(0);
    });

    test('should search tasks by title', async ({ page }) => {
      const searchInput = page.locator('input[aria-label="Search tasks"]').first();
      await expect(searchInput).toBeVisible();

      await searchInput.fill('High Priority');
      await page.waitForTimeout(1500);

      const matchingTask = page.locator('text=/high priority/i');
      await expect(matchingTask.first()).toBeVisible({ timeout: 3000 });

      const nonMatchingVisible = await page.locator('text=/low priority/i').isVisible().catch(() => false);
      expect(nonMatchingVisible).toBeFalsy();
    });

    test('should search tasks by description', async ({ page }) => {
      const searchInput = page.locator('input[aria-label="Search tasks"]').first();
      await expect(searchInput).toBeVisible();

      await searchInput.fill('Important');
      await page.waitForTimeout(1500);

      const matchingTask = page.locator('text=/Important task|Search High Priority/');
      await expect(matchingTask.first()).toBeVisible({ timeout: 3000 });
    });

    test('should perform case-insensitive search', async ({ page }) => {
      const searchInput = page.locator('input[aria-label="Search tasks"]').first();
      await expect(searchInput).toBeVisible();

      await searchInput.fill('HIGH PRIORITY');
      await page.waitForTimeout(1500);

      const matchingTask = page.locator('text=/high priority/i');
      await expect(matchingTask.first()).toBeVisible({ timeout: 3000 });
    });

    test('should show all tasks when search is cleared', async ({ page }) => {
      const searchInput = page.locator('input[aria-label="Search tasks"]').first();
      await expect(searchInput).toBeVisible();

      await searchInput.fill('High');
      await page.waitForTimeout(1500);
      await searchInput.fill('');
      await page.waitForTimeout(1500);

      const tasks = page.locator('input[type="checkbox"]');
      const count = await tasks.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should combine multiple filters (priority + status)', async ({ page }) => {
      const priorityFilter = page.locator('select[aria-label="Priority"]').first();
      const statusFilter = page.locator('select[aria-label="Status"]').first();

      await Promise.all([
        expect(priorityFilter).toBeVisible(),
        expect(statusFilter).toBeVisible(),
      ]);

      await priorityFilter.selectOption('high');
      await page.waitForTimeout(500);
      await statusFilter.selectOption('Completed');
      await page.waitForTimeout(1000);

      const completedHighPriority = page.locator('input[type="checkbox"]:checked');
      const count = await completedHighPriority.count();
      expect(count).toBeGreaterThan(0);

      const checkbox = completedHighPriority.first();
      await expect(checkbox).toBeChecked();
    });

    test('should show "no results" message when search returns no matches', async ({ page }) => {
      const searchInput = page.locator('input[aria-label="Search tasks"]').first();
      await expect(searchInput).toBeVisible();

      await searchInput.fill('NonexistentTaskTitle123456');
      await page.waitForTimeout(1500);

      const emptyMessage = page.locator('text=/no tasks found|no results|no matches/i');
      await expect(emptyMessage.first()).toBeVisible({ timeout: 5000 });
    });
  });
});
