/**
 * Mock data factories for integration tests
 * Provides functions to generate realistic test data with sensible defaults
 * and the ability to override specific fields.
 */

let taskIdCounter = 1;
let categoryIdCounter = 1;
let userIdCounter = 1;

/**
 * Creates a mock user object
 * @param {Object} overrides - Fields to override in the mock user
 * @returns {Object} Mock user object
 */
export function createMockUser(overrides = {}) {
  return {
    id: userIdCounter++,
    name: 'Test User',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock task object
 * @param {Object} overrides - Fields to override in the mock task
 * @returns {Object} Mock task object
 */
export function createMockTask(overrides = {}) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000); // +1 day

  return {
    id: taskIdCounter++,
    title: 'Test Task',
    description: 'Test Description',
    due_date: tomorrow.toISOString(),
    priority: 'medium',
    category_id: null,
    is_completed: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock overdue task (due date in the past)
 * @param {Object} overrides - Fields to override
 * @returns {Object} Mock overdue task object
 */
export function createMockOverdueTask(overrides = {}) {
  const yesterday = new Date(Date.now() - 86400000); // -1 day
  return createMockTask({
    due_date: yesterday.toISOString(),
    ...overrides,
  });
}

/**
 * Creates a mock completed task
 * @param {Object} overrides - Fields to override
 * @returns {Object} Mock completed task object
 */
export function createMockCompletedTask(overrides = {}) {
  return createMockTask({
    is_completed: true,
    ...overrides,
  });
}

/**
 * Creates a mock category object
 * @param {Object} overrides - Fields to override in the mock category
 * @returns {Object} Mock category object
 */
export function createMockCategory(overrides = {}) {
  return {
    id: categoryIdCounter++,
    name: 'Test Category',
    color: '#3B82F6',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock statistics object
 * @param {Object} overrides - Fields to override in the mock stats
 * @returns {Object} Mock statistics object
 */
export function createMockSummaryStats(overrides = {}) {
  return {
    total_tasks: 10,
    completed_tasks: 5,
    overdue_tasks: 2,
    due_soon_tasks: 3,
    due_today: 1,
    due_this_week: 4,
    completion_rate: 50.0,
    ...overrides,
  };
}

/**
 * Creates a mock detailed statistics object for the analytics view
 * @param {Object} overrides - Fields to override in the mock stats
 * @returns {Object} Mock statistics object
 */
export function createMockDetailedStats(overrides = {}) {
  const nowIso = new Date().toISOString();

  const defaultStats = {
    overview: {
      total_tasks: 10,
      completed_tasks: 5,
      pending_tasks: 5,
      overdue_tasks: 2,
      due_today: 1,
      due_this_week: 3,
      completion_rate: 50,
      recent_completions: 3,
      last_updated: nowIso,
    },
    priority_breakdown: {
      high: 3,
      medium: 4,
      low: 3,
    },
    category_breakdown: [
      { id: 1, name: 'Work', total_tasks: 4, completed_tasks: 2, pending_tasks: 2, color: '#3B82F6', completion_rate: 50 },
      { id: 2, name: 'Personal', total_tasks: 3, completed_tasks: 1, pending_tasks: 2, color: '#10B981', completion_rate: 33.33 },
      { id: 3, name: 'Shopping', total_tasks: 3, completed_tasks: 2, pending_tasks: 1, color: '#F59E0B', completion_rate: 66.67 },
    ],
    weekly_trend: [
      {
        week_start: nowIso,
        week_end: nowIso,
        completions: 1,
        tasks_created: 2,
        is_current_week: true,
      },
      {
        week_start: new Date(Date.now() - 7 * 86400000).toISOString(),
        week_end: new Date(Date.now() - 1 * 86400000).toISOString(),
        completions: 2,
        tasks_created: 2,
        is_current_week: false,
      },
    ],
    generated_at: nowIso,
  };

  return {
    ...defaultStats,
    ...overrides,
  };
}

/**
 * Creates a mock paginated response structure
 * @param {Array} data - The data array for the response
 * @param {Object} paginationOverrides - Pagination fields to override
 * @returns {Object} Mock paginated response
 */
export function createMockPaginatedResponse(data, paginationOverrides = {}) {
  return {
    data,
    pagination: {
      page: 1,
      per_page: 50,
      total: data.length,
      pages: 1,
      has_next: false,
      has_prev: false,
      ...paginationOverrides,
    },
  };
}

/**
 * Creates multiple mock tasks with different attributes
 * Useful for testing filtering and searching
 * @param {number} count - Number of tasks to create
 * @returns {Array} Array of mock tasks
 */
export function createMockTasks(count = 5) {
  const tasks = [];
  const priorities = ['low', 'medium', 'high'];
  const statuses = [true, false];

  for (let i = 0; i < count; i++) {
    tasks.push(
      createMockTask({
        title: `Test Task ${i + 1}`,
        priority: priorities[i % priorities.length],
        is_completed: statuses[i % statuses.length],
      })
    );
  }

  return tasks;
}

/**
 * Creates multiple mock categories
 * @param {number} count - Number of categories to create
 * @returns {Array} Array of mock categories
 */
export function createMockCategories(count = 3) {
  const categories = [];
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const names = ['Work', 'Personal', 'Shopping', 'Health', 'Finance'];

  for (let i = 0; i < count; i++) {
    categories.push(
      createMockCategory({
        name: names[i % names.length],
        color: colors[i % colors.length],
      })
    );
  }

  return categories;
}

/**
 * Reset all ID counters to their initial values
 * Should be called in beforeEach to ensure test isolation
 */
export function resetMockCounters() {
  taskIdCounter = 1;
  categoryIdCounter = 1;
  userIdCounter = 1;
}

/**
 * Creates a mock auth response (login/register)
 * @param {Object} userOverrides - User fields to override
 * @returns {Object} Mock auth response
 */
export function createMockAuthResponse(userOverrides = {}) {
  return {
    data: {
      user: createMockUser(userOverrides),
      access_token: 'mock-token-' + Math.random().toString(36).substring(7),
    },
  };
}

/**
 * Creates a mock error response
 * @param {string} message - Error message
 * @param {Array} details - Optional error details array
 * @returns {Object} Mock error response
 */
export function createMockErrorResponse(message = 'An error occurred', details = null) {
  return {
    response: {
      data: {
        error: message,
        ...(details && { details }),
      },
    },
  };
}
