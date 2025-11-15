/**
 * Task Management Test Fixtures
 *
 * Provides reusable test data and helper functions for task management E2E tests.
 * This includes test task data, helper functions for task operations, and utilities
 * for managing task-related test state.
 */

/**
 * Generate a unique task title for testing
 * @param {string} prefix - Prefix for the task title
 * @returns {string} Unique task title
 */
export function generateTaskTitle(prefix = 'Test Task') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix} ${timestamp}_${random}`;
}

/**
 * Return a YYYY-MM-DD string using local (browser) midnight to stay in sync with the backend.
 * @param {number} offsetDays Number of days from today
 * @returns {string}
 */
export function getLocalDateString(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Sample task data for different test scenarios
 */
export const sampleTasks = {
  minimal: {
    title: generateTaskTitle('Minimal Task'),
  },
  complete: {
    title: generateTaskTitle('Complete Task'),
    description: 'This is a complete task with all fields filled',
    priority: 'high',
    due_date: '2025-12-31',
  },
  highPriority: {
    title: generateTaskTitle('High Priority'),
    description: 'Urgent task that needs immediate attention',
    priority: 'high',
  },
  mediumPriority: {
    title: generateTaskTitle('Medium Priority'),
    description: 'Normal priority task',
    priority: 'medium',
  },
  lowPriority: {
    title: generateTaskTitle('Low Priority'),
    description: 'Low priority task',
    priority: 'low',
  },
  withDueDate: {
    title: generateTaskTitle('Task with Due Date'),
    due_date: '2025-12-31',
  },
  overdue: {
    title: generateTaskTitle('Overdue Task'),
    description: 'This task is past its due date',
    due_date: '2020-01-01',
    priority: 'high',
  },
  dueSoon: {
    title: generateTaskTitle('Due Soon'),
    description: 'Task due in the near future',
    due_date: getLocalDateString(7), // 7 days from now using local date semantics
  },
  longDescription: {
    title: generateTaskTitle('Task with Long Description'),
    description: 'This is a task with a very long description. '.repeat(50),
  },
};

/**
 * Invalid task data for testing validation
 */
export const invalidTasks = {
  emptyTitle: {
    title: '',
    description: 'Task with empty title',
  },
  titleTooLong: {
    title: 'a'.repeat(201),
    description: 'Task with title exceeding 200 characters',
  },
  descriptionTooLong: {
    title: generateTaskTitle('Valid Title'),
    description: 'a'.repeat(5001),
  },
  invalidPriority: {
    title: generateTaskTitle('Invalid Priority'),
    priority: 'invalid',
  },
  invalidDate: {
    title: generateTaskTitle('Invalid Date'),
    due_date: 'not-a-date',
  },
};

/**
 * Expected error messages from the application
 */
export const errorMessages = {
  titleRequired: 'Title is required',
  titleTooLong: 'Title must be less than 200 characters',
  descriptionTooLong: 'Description must be less than 5000 characters',
  invalidPriority: 'Priority must be low, medium, or high',
  invalidDate: 'Invalid due date format',
  taskNotFound: 'Task not found',
  unauthorized: 'Unauthorized',
  serverError: 'Internal server error',
};

/**
 * Helper function to wait for task list to load
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function waitForTasksToLoad(page) {
  await page
    .waitForSelector(
      'input[type="checkbox"], text=/no tasks|create.*first.*task/i',
      { timeout: 10000, state: 'visible' }
    )
    .catch(() => {});
  await page.waitForTimeout(500);
}

/**
 * Helper function to open create task modal
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function openCreateTaskModal(page) {
  const createButton = page.locator(
    'button:has-text("Create Task"), button:has-text("Add Task"), button:has-text("New Task"), button:has-text("Create")'
  ).first();
  await createButton.click();
  await page.waitForSelector('[role="dialog"], .modal', { state: 'visible' });
  await page.waitForTimeout(300);
}

/**
 * Helper function to fill task form fields
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} taskData - Task data to fill
 * @returns {Promise<void>}
 */
export async function fillTaskForm(page, taskData) {
  if (taskData.title !== undefined) {
    const titleInput = page.locator('input[name="title"], input#title');
    await titleInput.clear();
    await titleInput.fill(taskData.title);
  }

  if (taskData.description !== undefined) {
    const descriptionInput = page.locator('textarea[name="description"], textarea#description');
    await descriptionInput.clear();
    await descriptionInput.fill(taskData.description);
  }

  if (taskData.priority !== undefined) {
    const prioritySelect = page.locator('select[name="priority"], select#priority');
    await prioritySelect.selectOption(taskData.priority);
  }

  if (taskData.due_date !== undefined) {
    const dueDateInput = page.locator(
      'input[name="due_date"], input[name="dueDate"], input#due_date, input#dueDate'
    );
    await dueDateInput.clear();
    await dueDateInput.fill(taskData.due_date);
  }

  if (taskData.category_id !== undefined) {
    const categorySelect = page.locator(
      'select[name="category_id"], select[name="categoryId"], select#category_id, select#categoryId'
    );
    await categorySelect.selectOption(taskData.category_id.toString());
  }
}

/**
 * Helper function to submit task form
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function submitTaskForm(page) {
  const submitButton = page.locator(
    'button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save"), button:has-text("Create Task"), button:has-text("Save Task")'
  );
  await submitButton.click();
}

/**
 * Helper function to create a task
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} taskData - Task data
 * @returns {Promise<void>}
 */
export async function createTask(page, taskData) {
  await openCreateTaskModal(page);
  await fillTaskForm(page, taskData);
  await submitTaskForm(page);
  await page.waitForTimeout(1000); // Wait for task creation
}

/**
 * Helper function to open edit task modal
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} taskIndex - Index of task to edit (0-based)
 * @returns {Promise<void>}
 */
export async function openEditTaskModal(page, taskIndex = 0) {
  const editButtons = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]');
  await editButtons.nth(taskIndex).click();
  await page.waitForSelector('[role="dialog"], .modal', { state: 'visible' });
  await page.waitForTimeout(300);
}

/**
 * Helper function to update a task
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} taskIndex - Index of task to update (0-based)
 * @param {Object} taskData - Updated task data
 * @returns {Promise<void>}
 */
export async function updateTask(page, taskIndex, taskData) {
  await openEditTaskModal(page, taskIndex);
  await fillTaskForm(page, taskData);
  await submitTaskForm(page);
  await page.waitForTimeout(1000); // Wait for task update
}

/**
 * Helper function to delete a task
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} taskIndex - Index of task to delete (0-based)
 * @returns {Promise<void>}
 */
export async function deleteTask(page, taskIndex = 0) {
  const deleteButtons = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
  await deleteButtons.nth(taskIndex).click();
  await page.waitForTimeout(500);

  const confirmButton = page.locator(
    'button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
  ).last();
  await confirmButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Helper function to toggle task completion
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} taskIndex - Index of task to toggle (0-based)
 * @returns {Promise<void>}
 */
export async function toggleTaskCompletion(page, taskIndex = 0) {
  const checkboxes = page.locator('input[type="checkbox"]');
  await checkboxes.nth(taskIndex).click();
  await page.waitForTimeout(500);
}

/**
 * Helper function to get task count
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<number>}
 */
export async function getTaskCount(page) {
  await waitForTasksToLoad(page);
  return page.locator('input[type="checkbox"]').count();
}

/**
 * Helper function to verify task exists in list
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} title - Task title to search for
 * @returns {Promise<boolean>}
 */
export async function taskExists(page, title) {
  const task = page.locator(`text="${title}"`);
  return await task.isVisible().catch(() => false);
}

/**
 * Helper function to get task by index
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} index - Task index (0-based)
 * @returns {Promise<Object>} Task element locator
 */
export async function getTaskByIndex(page, index) {
  const tasks = page.locator('div.task-card, div.task-item');
  return tasks.nth(index);
}

/**
 * Helper function to verify task is completed
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} taskIndex - Task index (0-based)
 * @returns {Promise<boolean>}
 */
export async function isTaskCompleted(page, taskIndex) {
  const checkbox = page.locator('input[type="checkbox"]').nth(taskIndex);
  return await checkbox.isChecked();
}

export async function getTaskTitle(page, index) {
  const headings = page.locator('main').locator('h3');
  return headings.nth(index).textContent();
}

export async function hasError(page, errorPattern = /error|required|invalid|validation/i) {
  const inlineError = page.locator('p.error-message').filter({ hasText: errorPattern });
  const errorComponent = page.locator('[data-testid="error-message"]').filter({ hasText: errorPattern });

  const hasInline = await inlineError.isVisible().catch(() => false);
  const hasComponent = await errorComponent.isVisible().catch(() => false);

  return hasInline || hasComponent;
}

/**
 * Helper function to close modal
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function closeModal(page) {
  // Try Escape key first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // If modal still visible, click cancel button
  const modal = page.locator('[role="dialog"], .modal');
  const isVisible = await modal.isVisible().catch(() => false);

  if (isVisible) {
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    const cancelVisible = await cancelButton.isVisible().catch(() => false);

    if (cancelVisible) {
      await cancelButton.click();
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Helper function to verify error message is displayed
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} errorText - Error text to search for (regex pattern)
 * @returns {Promise<boolean>}
 */
export async function hasErrorMessage(page, errorText) {
  const errorElement = page.locator(
    `text=/${errorText}/i, .error-message:has-text("${errorText}"), [role="alert"]:has-text("${errorText}")`
  );
  return await errorElement.first().isVisible({ timeout: 3000 }).catch(() => false);
}

/**
 * Helper function to navigate to tasks page
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function navigateToTasks(page) {
  await page.goto('/tasks');
  await waitForTasksToLoad(page);
}

/**
 * Helper function to create multiple tasks
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<Object>} tasksArray - Array of task data objects
 * @returns {Promise<void>}
 */
export async function createMultipleTasks(page, tasksArray) {
  for (const taskData of tasksArray) {
    await createTask(page, taskData);
    await page.waitForTimeout(300);
  }
}

/**
 * Helper function to delete all tasks
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function deleteAllTasks(page) {
  let taskCount = await getTaskCount(page);

  while (taskCount > 0) {
    await deleteTask(page, 0);
    await page.waitForTimeout(500);
    taskCount = await getTaskCount(page);
  }
}

/**
 * Helper function to verify modal is open
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isModalOpen(page) {
  const modal = page.locator('[role="dialog"], .modal');
  return await modal.isVisible().catch(() => false);
}

/**
 * Helper function to verify modal is closed
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isModalClosed(page) {
  const modal = page.locator('[role="dialog"], .modal');
  const visible = await modal.isVisible().catch(() => false);
  return !visible;
}
