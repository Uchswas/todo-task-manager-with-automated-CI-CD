/**
 * API mocking utilities for integration tests
 * Provides centralized mock setup and stateful API behavior simulation
 */

import * as api from '../../../utils/api';
import {
  createMockUser,
  createMockTask,
  createMockCategory,
  createMockSummaryStats,
  createMockDetailedStats,
  createMockErrorResponse,
  createMockPaginatedResponse,
} from './mock-data';

// In-memory stores for stateful mocking
let mockTasks = [];
let mockCategories = [];
let mockUser = null;
let mockToken = 'mock-token-123';

// Aggregate analytics based on the current mock stores so stats endpoints stay consistent.
function computeStatsSnapshot() {
  const now = new Date();
  const total = mockTasks.length;
  const completed = mockTasks.filter(t => t.is_completed).length;
  const overdue = mockTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return !t.is_completed && dueDate < now;
  }).length;
  const dueToday = mockTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    return !t.is_completed && dueDate >= startOfToday && dueDate <= endOfToday;
  }).length;
  const dueSoon = mockTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);
    return !t.is_completed && dueDate > now && dueDate <= threeDaysFromNow;
  }).length;

  const completionRate = total > 0 ? parseFloat(((completed / total) * 100).toFixed(2)) : 0;
  const pending = Math.max(total - completed, 0);

  const priorityBreakdown = mockTasks.reduce((acc, task) => {
    const key = task.priority || 'medium';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });

  // Initialise category summaries that will be populated as tasks are folded in below.
  const categoriesWithCounts = mockCategories.map(category => ({
    id: category.id,
    name: category.name,
    color: category.color,
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
  }));

  const breakdownMap = new Map(categoriesWithCounts.map(c => [c.id, c]));
  const uncategorizedEntry = {
    id: 'uncategorized',
    name: 'Uncategorized',
    color: '#6B7280',
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
  };
  breakdownMap.set('uncategorized', uncategorizedEntry);

  mockTasks.forEach(task => {
    const key = task.category_id || 'uncategorized';
    const entry = breakdownMap.get(key) || breakdownMap.get('uncategorized');

    entry.total_tasks += 1;
    if (task.is_completed) {
      entry.completed_tasks += 1;
    } else {
      entry.pending_tasks += 1;
    }
  });

  const categoryBreakdown = Array.from(breakdownMap.values())
    .filter(entry => entry.total_tasks > 0)
    .map(entry => ({
      ...entry,
      completion_rate: entry.total_tasks > 0
        ? parseFloat(((entry.completed_tasks / entry.total_tasks) * 100).toFixed(2))
        : 0,
    }));

  const sevenDaysAgo = new Date(now.getTime() - 6 * 86400000);
  const recentCompletions = mockTasks.filter(task => {
    if (!task.is_completed) return false;
    const updatedAt = task.updated_at ? new Date(task.updated_at) : new Date(task.created_at);
    return updatedAt >= sevenDaysAgo;
  }).length;

  const dateKey = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  const createdCounts = new Map();
  const completedCounts = new Map();

  mockTasks.forEach(task => {
    const createdKey = dateKey(task.created_at);
    createdCounts.set(createdKey, (createdCounts.get(createdKey) || 0) + 1);
    if (task.is_completed) {
      const completedKey = dateKey(task.updated_at || task.created_at);
      completedCounts.set(completedKey, (completedCounts.get(completedKey) || 0) + 1);
    }
  });

  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const dueThisWeek = mockTasks.filter(task => {
    if (!task.due_date || task.is_completed) return false;
    const dueDate = new Date(task.due_date);
    return dueDate >= startOfWeek && dueDate <= endOfWeek;
  }).length;

  const weeklyTrend = Array.from({ length: 6 }).map((_, index) => {
    const offsetWeeks = 5 - index;
    const weekStart = new Date(startOfWeek);
    weekStart.setDate(weekStart.getDate() - offsetWeeks * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekKeyRange = [];
    const weekStartKey = dateKey(weekStart);
    weekKeyRange.push(weekStartKey);

    const completions = mockTasks.filter(task => {
      if (!task.is_completed) return false;
      const completionDate = task.updated_at ? new Date(task.updated_at) : new Date(task.created_at);
      return completionDate >= weekStart && completionDate <= weekEnd;
    }).length;

    const created = mockTasks.filter(task => {
      const createdAt = new Date(task.created_at);
      return createdAt >= weekStart && createdAt <= weekEnd;
    }).length;

    return {
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      completions,
      tasks_created: created,
      is_current_week: offsetWeeks === 0,
    };
  });

  const summary = createMockSummaryStats({
    total_tasks: total,
    completed_tasks: completed,
    overdue_tasks: overdue,
    due_soon_tasks: dueSoon,
    due_today: dueToday,
    due_this_week: dueThisWeek,
    completion_rate: completionRate,
  });

  const detailed = createMockDetailedStats({
    overview: {
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      overdue_tasks: overdue,
      due_today: dueToday,
      due_this_week: dueThisWeek,
      completion_rate: completionRate,
      recent_completions: recentCompletions,
      last_updated: now.toISOString(),
    },
    priority_breakdown: {
      high: priorityBreakdown.high || 0,
      medium: priorityBreakdown.medium || 0,
      low: priorityBreakdown.low || 0,
    },
    category_breakdown: categoryBreakdown,
    weekly_trend: weeklyTrend,
    generated_at: now.toISOString(),
  });

  return { summary, detailed };
}

/**
 * Sets up all API mocks with default implementations
 * Should be called in beforeEach or test setup
 */
export function setupApiMocks() {
  // =====================
  // Auth API Mocks
  // =====================

  api.authAPI.login = jest.fn().mockImplementation(async (credentials) => {
    // Simulate successful login
    const user = createMockUser({ email: credentials.email });
    mockUser = user;
    return {
      data: {
        user,
        access_token: mockToken,
      },
    };
  });

  api.authAPI.register = jest.fn().mockImplementation(async (userData) => {
    // Simulate successful registration
    const user = createMockUser({
      name: userData.name,
      email: userData.email
    });
    mockUser = user;
    return {
      data: {
        user,
        access_token: mockToken,
      },
    };
  });

  api.authAPI.logout = jest.fn().mockResolvedValue({
    data: { message: 'Logged out successfully' },
  });

  api.authAPI.getProfile = jest.fn().mockImplementation(async () => {
    if (!mockUser) {
      throw createMockErrorResponse('Not authenticated');
    }
    return {
      data: { user: mockUser },
    };
  });

  api.authAPI.updateProfile = jest.fn().mockImplementation(async (userData) => {
    if (!mockUser) {
      throw createMockErrorResponse('Not authenticated');
    }
    mockUser = { ...mockUser, ...userData };
    return {
      data: { user: mockUser },
    };
  });

  // =====================
  // Tasks API Mocks
  // =====================

  api.tasksAPI.getTasks = jest.fn().mockImplementation(async (params = {}) => {
    let filteredTasks = [...mockTasks];

    // Apply status filter
    if (params.status === 'completed') {
      filteredTasks = filteredTasks.filter(t => t.is_completed);
    } else if (params.status === 'incomplete') {
      filteredTasks = filteredTasks.filter(t => !t.is_completed);
    }

    // Apply priority filter
    if (params.priority) {
      filteredTasks = filteredTasks.filter(t => t.priority === params.priority);
    }

    // Apply category filter
    if (params.category_id) {
      filteredTasks = filteredTasks.filter(t => t.category_id === parseInt(params.category_id));
    }

    // Apply search filter
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredTasks = filteredTasks.filter(t =>
        t.title.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower))
      );
    }

    // Sort by created_at (newest first by default)
    filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const paginatedResponse = createMockPaginatedResponse(filteredTasks);
    return {
      data: {
        tasks: paginatedResponse.data,
        pagination: paginatedResponse.pagination
      }
    };
  });

  api.tasksAPI.getTask = jest.fn().mockImplementation(async (id) => {
    const task = mockTasks.find(t => t.id === parseInt(id));
    if (!task) {
      throw createMockErrorResponse('Task not found');
    }
    return { data: { task } };
  });

  api.tasksAPI.createTask = jest.fn().mockImplementation(async (taskData) => {
    const newTask = createMockTask({
      ...taskData,
      id: mockTasks.length + 1,
    });
    mockTasks.push(newTask); // Persist so subsequent queries and stats serializers include the task.
    return {
      data: {
        message: 'Task created successfully',
        task: newTask
      }
    };
  });

  api.tasksAPI.updateTask = jest.fn().mockImplementation(async (id, taskData) => {
    const taskIndex = mockTasks.findIndex(t => t.id === parseInt(id));
    if (taskIndex === -1) {
      throw createMockErrorResponse('Task not found');
    }
    mockTasks[taskIndex] = {
      ...mockTasks[taskIndex],
      ...taskData,
      updated_at: new Date().toISOString(),
    };
    return {
      data: {
        message: 'Task updated successfully',
        task: mockTasks[taskIndex]
      }
    };
  });

  api.tasksAPI.deleteTask = jest.fn().mockImplementation(async (id) => {
    const taskIndex = mockTasks.findIndex(t => t.id === parseInt(id));
    if (taskIndex === -1) {
      throw createMockErrorResponse('Task not found');
    }
    mockTasks.splice(taskIndex, 1); // Remove the task to mirror a successful deletion.
    return { data: { message: 'Task deleted successfully' } };
  });

  api.tasksAPI.toggleComplete = jest.fn().mockImplementation(async (id) => {
    const task = mockTasks.find(t => t.id === parseInt(id));
    if (!task) {
      throw createMockErrorResponse('Task not found');
    }
    task.is_completed = !task.is_completed; // Mirror the server-side toggle behaviour with a timestamp.
    task.updated_at = new Date().toISOString();
    return {
      data: {
        message: `Task marked as ${task.is_completed ? 'completed' : 'incomplete'}`,
        task
      }
    };
  });

  api.tasksAPI.getOverdueTasks = jest.fn().mockImplementation(async () => {
    const now = new Date();
    const overdueTasks = mockTasks.filter(t => {
      const dueDate = new Date(t.due_date);
      return !t.is_completed && dueDate < now;
    });
    const paginatedResponse = createMockPaginatedResponse(overdueTasks);
    return {
      data: {
        overdue_tasks: paginatedResponse.data,
        pagination: paginatedResponse.pagination
      }
    };
  });

  // =====================
  // Categories API Mocks
  // =====================

  api.categoriesAPI.getCategories = jest.fn().mockImplementation(async () => {
    return { data: { categories: mockCategories } };
  });

  api.categoriesAPI.getCategory = jest.fn().mockImplementation(async (id) => {
    const category = mockCategories.find(c => c.id === parseInt(id));
    if (!category) {
      throw createMockErrorResponse('Category not found');
    }
    return { data: { category } };
  });

  api.categoriesAPI.createCategory = jest.fn().mockImplementation(async (categoryData) => {
    const newCategory = createMockCategory({
      ...categoryData,
    });
    mockCategories.push(newCategory); // Track the created category so later calls can retrieve it.
    return {
      data: {
        message: 'Category created successfully',
        category: newCategory
      }
    };
  });

  api.categoriesAPI.updateCategory = jest.fn().mockImplementation(async (id, categoryData) => {
    const categoryIndex = mockCategories.findIndex(c => c.id === parseInt(id));
    if (categoryIndex === -1) {
      throw createMockErrorResponse('Category not found');
    }
    mockCategories[categoryIndex] = {
      ...mockCategories[categoryIndex],
      ...categoryData,
    };
    return {
      data: {
        message: 'Category updated successfully',
        category: mockCategories[categoryIndex]
      }
    };
  });

  api.categoriesAPI.deleteCategory = jest.fn().mockImplementation(async (id) => {
    const categoryIndex = mockCategories.findIndex(c => c.id === parseInt(id));
    if (categoryIndex === -1) {
      throw createMockErrorResponse('Category not found');
    }
    mockCategories.splice(categoryIndex, 1);
    return { data: { message: 'Category deleted successfully' } };
  });

  api.categoriesAPI.getCategoryTasks = jest.fn().mockImplementation(async (id) => {
    const category = mockCategories.find(c => c.id === parseInt(id)) || null;
    const categoryTasks = mockTasks.filter(t => t.category_id === parseInt(id));
    const paginated = createMockPaginatedResponse(categoryTasks);
    return {
      data: {
        category,
        tasks: paginated.data,
        pagination: paginated.pagination
      }
    };
  });

  // =====================
  // Stats API Mocks
  // =====================

  api.statsAPI.getStats = jest.fn().mockImplementation(async () => {
    const { detailed } = computeStatsSnapshot();
    return { data: detailed };
  });

  api.statsAPI.getSummaryStats = jest.fn().mockImplementation(async () => {
    const { summary } = computeStatsSnapshot();
    return { data: summary };
  });

  // =====================
  // Health API Mocks
  // =====================

  api.healthAPI.getHealth = jest.fn().mockResolvedValue({
    data: { status: 'healthy' },
  });

  api.healthAPI.getDetailedHealth = jest.fn().mockResolvedValue({
    data: {
      status: 'healthy',
      database: 'connected',
      uptime: 12345,
    },
  });
}

/**
 * Resets all API mocks to their initial state
 * Clears in-memory stores and mock call history
 * Should be called in beforeEach to ensure test isolation
 */
export function resetApiMocks() {
  mockTasks = [];
  mockCategories = [];
  mockUser = null;
  jest.clearAllMocks();
}

/**
 * Sets the mock tasks in the in-memory store
 * @param {Array} tasks - Array of task objects
 */
export function setMockTasks(tasks) {
  mockTasks = [...tasks];
}

/**
 * Sets the mock categories in the in-memory store
 * @param {Array} categories - Array of category objects
 */
export function setMockCategories(categories) {
  mockCategories = [...categories];
}

/**
 * Sets the mock authenticated user
 * @param {Object} user - User object
 */
export function setMockUser(user) {
  mockUser = user;
}

/**
 * Gets the current mock tasks
 * @returns {Array} Array of task objects
 */
export function getMockTasks() {
  return [...mockTasks];
}

/**
 * Gets the current mock categories
 * @returns {Array} Array of category objects
 */
export function getMockCategories() {
  return [...mockCategories];
}

/**
 * Gets the current mock user
 * @returns {Object} User object
 */
export function getMockUser() {
  return mockUser;
}

/**
 * Configures login mock to fail with specific error
 * @param {string} errorMessage - Error message to return
 */
export function mockLoginFailure(errorMessage = 'Invalid credentials') {
  api.authAPI.login = jest.fn().mockRejectedValue(
    createMockErrorResponse(errorMessage)
  );
}

/**
 * Configures register mock to fail with validation errors
 * @param {string} errorMessage - Main error message
 * @param {Array} details - Array of validation error details
 */
export function mockRegisterFailure(errorMessage = 'Validation failed', details = []) {
  api.authAPI.register = jest.fn().mockRejectedValue(
    createMockErrorResponse(errorMessage, details)
  );
}

/**
 * Configures task creation to fail
 * @param {string} errorMessage - Error message to return
 */
export function mockCreateTaskFailure(errorMessage = 'Failed to create task') {
  api.tasksAPI.createTask = jest.fn().mockRejectedValue(
    createMockErrorResponse(errorMessage)
  );
}
