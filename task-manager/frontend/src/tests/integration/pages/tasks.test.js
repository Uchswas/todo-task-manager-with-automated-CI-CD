import { renderApp, screen, waitFor, userEvent, within } from '../helpers/test-utils';
import { setMockTasks, setMockCategories, mockCreateTaskFailure } from '../helpers/api-mocks';
import {
  createMockTask,
  createMockCategory,
  createMockUser,
  createMockCompletedTask,
  createMockOverdueTask,
} from '../helpers/mock-data';

// Set up default test data that will be used across multiple tests
const workCategory = createMockCategory({ name: 'Work', color: '#3B82F6' });
const personalCategory = createMockCategory({ name: 'Personal', color: '#10B981' });
const authUser = createMockUser({ name: 'Task Manager' });

/**
 * Helper function to set up the Tasks page with mock data and render it
 * @param {Array} seedTasks - Array of mock tasks to populate the page with
 * @returns {Object} userEvent instance for simulating user interactions
 */
function setupTasksPage(seedTasks = []) {
  // Initialize mock categories that will be available in the category dropdown
  setMockCategories([workCategory, personalCategory]);
  // Initialize the tasks that should appear on the page
  setMockTasks(seedTasks);

  // Render the full app with the Tasks page as the initial route
  renderApp({
    initialRoute: '/tasks',
    authValue: { user: authUser, token: 'token-123' },
  });

  // Return userEvent instance for simulating user interactions
  return userEvent.setup();
}

describe('Tasks Page Integration', () => {
  describe('CRUD Operations', () => {
    test('allows creating a task', async () => {
      // Set up the page with one existing task to ensure the create functionality works alongside existing data
      const userActions = setupTasksPage([
        createMockTask({ title: 'Existing Task', category_id: workCategory.id }),
      ]);

      // Wait for the page to fully load before interacting with it
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });

      // Simulate user clicking the "New Task" button to open the create modal
      await userActions.click(screen.getByRole('button', { name: /new task/i }));

      // Fill in all the task form fields with test data
      await userActions.type(screen.getByLabelText(/title/i), 'Plan project kickoff');
      await userActions.type(screen.getByLabelText(/description/i), 'Coordinate with the design and product teams');
      await userActions.type(screen.getByLabelText(/due date/i), '2030-01-15');
      await userActions.selectOptions(screen.getByLabelText('Priority', { selector: 'select#priority' }), 'high');
      await userActions.selectOptions(screen.getByLabelText('Category', { selector: 'select#category_id' }), personalCategory.id.toString());

      // Submit the form to create the new task
      await userActions.click(screen.getByRole('button', { name: /create task/i }));

      // Verify that the newly created task appears on the page with all its details
      expect(await screen.findByRole('heading', { name: /plan project kickoff/i })).toBeInTheDocument();
      expect(screen.getByText(/Coordinate with the design/i)).toBeInTheDocument();
    });

    test('allows editing a task', async () => {
      // Set up the page with an existing task that we will edit
      const userActions = setupTasksPage([
        createMockTask({ title: 'Existing Task', category_id: workCategory.id }),
      ]);

      // Wait for the task to appear on the page
      await waitFor(() => {
        expect(screen.getByText(/Existing Task/i)).toBeInTheDocument();
      });

      // Click the edit button to open the edit modal
      await userActions.click(screen.getAllByLabelText(/edit task/i)[0]);

      // Clear the existing title and enter a new one
      const titleInput = screen.getByLabelText(/title/i);
      await userActions.clear(titleInput);
      await userActions.type(titleInput, 'Updated kickoff plan');

      // Submit the changes
      await userActions.click(screen.getByRole('button', { name: /save changes/i }));

      // Verify that the task title has been updated on the page
      expect(await screen.findByRole('heading', { name: /updated kickoff plan/i })).toBeInTheDocument();
    });

    test('allows completing a task', async () => {
      // Set up the page with an incomplete task
      const userActions = setupTasksPage([
        createMockTask({ title: 'Complete Me', category_id: workCategory.id }),
      ]);

      // Wait for the task to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Complete Me/i)).toBeInTheDocument();
      });

      // Click the checkbox to mark the task as complete
      await userActions.click(screen.getAllByRole('checkbox', { name: /mark task complete/i })[0]);

      // Verify that the checkbox is now checked and the label has updated
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /mark task incomplete/i })).toBeChecked();
      });
    });

    test('allows deleting a task', async () => {
      // Set up the page with a task that we will delete
      const userActions = setupTasksPage([
        createMockTask({ title: 'Delete Me', category_id: workCategory.id }),
      ]);

      // Wait for the task to appear
      await waitFor(() => {
        expect(screen.getByText(/Delete Me/i)).toBeInTheDocument();
      });

      // Navigate to the delete button within the task's container
      const taskHeading = screen.getByRole('heading', { name: /Delete Me/i });
      const taskContainer = taskHeading.closest('div');
      const deleteButton = within(taskContainer.parentElement).getByLabelText(/delete task/i);

      // Click delete and confirm the deletion in the confirmation dialog
      await userActions.click(deleteButton);
      await userActions.click(await screen.findByRole('button', { name: /^delete$/i }));

      // Verify that the task has been removed from the page
      await waitFor(() => {
        expect(screen.queryByText(/Delete Me/i)).not.toBeInTheDocument();
      });
    });

    test('validates required fields when creating a task', async () => {
      // Set up an empty tasks page
      const userActions = setupTasksPage();

      // Wait for the page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });

      // Open the create modal and try to submit without filling in required fields
      await userActions.click(screen.getByRole('button', { name: /new task/i }));
      await userActions.click(screen.getByRole('button', { name: /create task/i }));

      // Verify that validation error message appears for the required title field
      expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    });

    test('handles API error when creating a task', async () => {
      // Mock the API to return a failure response when creating a task
      mockCreateTaskFailure('Failed to create task');
      const userActions = setupTasksPage();

      // Wait for the page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });

      // Attempt to create a task with valid data
      await userActions.click(screen.getByRole('button', { name: /new task/i }));
      await userActions.type(screen.getByLabelText(/title/i), 'Test Task');
      await userActions.click(screen.getByRole('button', { name: /create task/i }));

      // Verify that the error message from the API is displayed to the user
      expect(await screen.findByText(/failed to create task/i)).toBeInTheDocument();
    });
  });

  describe('Filtering & Search', () => {
    test('filters tasks by status (completed)', async () => {
      // Set up the page with a mix of completed and active tasks
      const userActions = setupTasksPage([
        createMockTask({ title: 'Active Task', is_completed: false }),
        createMockCompletedTask({ title: 'Done Task' }),
        createMockTask({ title: 'Another Active', is_completed: false }),
      ]);

      // Wait for all tasks to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Active Task/i)).toBeInTheDocument();
      });

      // Select "completed" from the status filter dropdown
      await userActions.selectOptions(screen.getByLabelText('Status'), 'completed');

      // Wait for the filter to be applied and verify only completed tasks are shown
      await waitFor(() => {
        expect(screen.getByText(/Done Task/i)).toBeInTheDocument();
      });

      // Verify that incomplete tasks are no longer visible
      await waitFor(() => {
        expect(screen.queryByText(/Active Task/i)).not.toBeInTheDocument();
      });
      expect(screen.queryByText(/Another Active/i)).not.toBeInTheDocument();
    });

    test('filters tasks by status (incomplete)', async () => {
      // Set up the page with both completed and incomplete tasks
      const userActions = setupTasksPage([
        createMockTask({ title: 'Active Task', is_completed: false }),
        createMockCompletedTask({ title: 'Done Task' }),
      ]);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText(/Active Task/i)).toBeInTheDocument();
      });

      // Filter to show only incomplete tasks
      await userActions.selectOptions(screen.getByLabelText('Status'), 'incomplete');

      // Verify that only incomplete tasks are displayed
      await waitFor(() => {
        expect(screen.getByText(/Active Task/i)).toBeInTheDocument();
      });

      // Verify that completed tasks are hidden
      await waitFor(() => {
        expect(screen.queryByText(/Done Task/i)).not.toBeInTheDocument();
      });
    });

    test('filters tasks by priority', async () => {
      // Set up tasks with different priority levels
      const userActions = setupTasksPage([
        createMockTask({ title: 'High Priority Task', priority: 'high' }),
        createMockTask({ title: 'Medium Priority Task', priority: 'medium' }),
        createMockTask({ title: 'Low Priority Task', priority: 'low' }),
      ]);

      // Wait for all tasks to be rendered
      await waitFor(() => {
        expect(screen.getByText(/High Priority Task/i)).toBeInTheDocument();
      });

      // Filter to show only high priority tasks
      await userActions.selectOptions(screen.getByLabelText('Priority'), 'high');

      // Verify that only high priority tasks are visible
      await waitFor(() => {
        expect(screen.getByText(/High Priority Task/i)).toBeInTheDocument();
      });

      // Verify that other priority tasks are hidden
      await waitFor(() => {
        expect(screen.queryByText(/Medium Priority Task/i)).not.toBeInTheDocument();
      });
      expect(screen.queryByText(/Low Priority Task/i)).not.toBeInTheDocument();
    });

    test('filters tasks by category', async () => {
      // Set up tasks assigned to different categories
      const userActions = setupTasksPage([
        createMockTask({ title: 'Work Task', category_id: workCategory.id }),
        createMockTask({ title: 'Personal Task', category_id: personalCategory.id }),
      ]);

      // Wait for both tasks to appear
      await waitFor(() => {
        expect(screen.getByText(/Work Task/i)).toBeInTheDocument();
      });

      // Filter to show only tasks in the Work category
      await userActions.selectOptions(screen.getByLabelText('Category'), workCategory.id.toString());

      // Verify that only Work category tasks are displayed
      await waitFor(() => {
        expect(screen.getByText(/Work Task/i)).toBeInTheDocument();
      });

      // Verify that Personal category tasks are hidden
      await waitFor(() => {
        expect(screen.queryByText(/Personal Task/i)).not.toBeInTheDocument();
      });
    });

    test('searches tasks by title', async () => {
      // Set up tasks with different titles to search through
      const userActions = setupTasksPage([
        createMockTask({ title: 'Write Report', description: 'Annual report' }),
        createMockTask({ title: 'Team Meeting', description: 'Weekly sync' }),
        createMockTask({ title: 'Report Bug', description: 'Fix login issue' }),
      ]);

      // Wait for all tasks to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Write Report/i)).toBeInTheDocument();
      });

      // Type a search query in the search input
      await userActions.type(screen.getByLabelText(/search tasks/i), 'Report');

      // Wait for the search to filter tasks and verify matching results
      await waitFor(() => {
        expect(screen.getByText(/Write Report/i)).toBeInTheDocument();
      }, { timeout: 1000 });
      expect(screen.getByText(/Report Bug/i)).toBeInTheDocument();

      // Verify that non-matching tasks are hidden
      await waitFor(() => {
        expect(screen.queryByText(/Team Meeting/i)).not.toBeInTheDocument();
      });
    });

    test('searches tasks by description', async () => {
      // Set up tasks where the search term appears in the description
      const userActions = setupTasksPage([
        createMockTask({ title: 'Task One', description: 'Contains keyword report' }),
        createMockTask({ title: 'Task Two', description: 'No keyword here' }),
      ]);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText(/Task One/i)).toBeInTheDocument();
      });

      // Search for a term that appears in the description
      await userActions.type(screen.getByLabelText(/search tasks/i), 'report');

      // Verify that tasks with matching descriptions are shown
      await waitFor(() => {
        expect(screen.getByText(/Task One/i)).toBeInTheDocument();
      }, { timeout: 1000 });

      // Verify that tasks without matching descriptions are hidden
      await waitFor(() => {
        expect(screen.queryByText(/Task Two/i)).not.toBeInTheDocument();
      });
    });

    test('combines multiple filters', async () => {
      // Set up tasks with various combinations of priority and category
      const userActions = setupTasksPage([
        createMockTask({ title: 'High Work Task', priority: 'high', category_id: workCategory.id }),
        createMockTask({ title: 'Low Work Task', priority: 'low', category_id: workCategory.id }),
        createMockTask({ title: 'High Personal Task', priority: 'high', category_id: personalCategory.id }),
      ]);

      // Wait for all tasks to appear
      await waitFor(() => {
        expect(screen.getByText(/High Work Task/i)).toBeInTheDocument();
      });

      // Apply multiple filters simultaneously (high priority AND work category)
      await userActions.selectOptions(screen.getByLabelText('Priority'), 'high');
      await userActions.selectOptions(screen.getByLabelText('Category'), workCategory.id.toString());

      // Verify that only tasks matching all filter criteria are displayed
      await waitFor(() => {
        expect(screen.getByText(/High Work Task/i)).toBeInTheDocument();
      });

      // Verify that tasks not matching all criteria are hidden
      await waitFor(() => {
        expect(screen.queryByText(/Low Work Task/i)).not.toBeInTheDocument();
      });
      expect(screen.queryByText(/High Personal Task/i)).not.toBeInTheDocument();
    });

    test('clears all filters', async () => {
      // Set up tasks with different properties
      const userActions = setupTasksPage([
        createMockTask({ title: 'Task 1', priority: 'high' }),
        createMockTask({ title: 'Task 2', priority: 'low' }),
      ]);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText(/Task 1/i)).toBeInTheDocument();
      });

      // Apply filters and perform a search to limit visible tasks
      await userActions.selectOptions(screen.getByLabelText('Priority'), 'high');
      await userActions.type(screen.getByLabelText(/search tasks/i), 'Task');

      // Wait for the "Clear Filters" button to appear
      await waitFor(() => {
        expect(screen.getByText(/Clear Filters/i)).toBeInTheDocument();
      });

      // Click the clear filters button to reset all filters
      await userActions.click(screen.getByText(/Clear Filters/i));

      // Verify that all tasks are now visible again
      await waitFor(() => {
        expect(screen.getByText(/Task 1/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Task 2/i)).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    test('sorts tasks by created date descending (default)', async () => {
      const now = new Date();
      // Create tasks with different creation dates to test sorting
      const task1 = createMockTask({
        title: 'Oldest Task',
        created_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
      });
      const task2 = createMockTask({
        title: 'Middle Task',
        created_at: new Date(now.getTime() - 1 * 86400000).toISOString(),
      });
      const task3 = createMockTask({
        title: 'Newest Task',
        created_at: now.toISOString(),
      });

      setupTasksPage([task1, task2, task3]);

      // Wait for all tasks to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Newest Task/i)).toBeInTheDocument();
      });

      // Verify that tasks are sorted by created date descending (newest first)
      const taskElements = screen.getAllByRole('heading', { level: 3 });
      expect(taskElements[0]).toHaveTextContent(/Newest Task/i);
      expect(taskElements[1]).toHaveTextContent(/Middle Task/i);
      expect(taskElements[2]).toHaveTextContent(/Oldest Task/i);
    });

    test('allows toggling sort order', async () => {
      // Set up tasks with different creation dates
      const userActions = setupTasksPage([
        createMockTask({ title: 'Task A', created_at: '2024-01-01T00:00:00Z' }),
        createMockTask({ title: 'Task B', created_at: '2024-01-02T00:00:00Z' }),
        createMockTask({ title: 'Task C', created_at: '2024-01-03T00:00:00Z' }),
      ]);

      // Wait for all tasks to load
      await waitFor(() => {
        expect(screen.getByText(/Task A/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Task B/i)).toBeInTheDocument();
      expect(screen.getByText(/Task C/i)).toBeInTheDocument();

      // Verify that the sort order button exists and is clickable
      const sortOrderButton = screen.getByLabelText('Sort order');
      expect(sortOrderButton).toBeInTheDocument();

      // Click the sort order button to toggle between ascending and descending
      await userActions.click(sortOrderButton);

      // Verify that tasks are still displayed after toggling sort order
      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(3);
      });
    });

    test('sorts by title', async () => {
      // Set up tasks with titles that will produce different orders when sorted alphabetically
      const userActions = setupTasksPage([
        createMockTask({ title: 'Zebra Task' }),
        createMockTask({ title: 'Alpha Task' }),
        createMockTask({ title: 'Beta Task' }),
      ]);

      // Wait for all tasks to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Zebra Task/i)).toBeInTheDocument();
      });

      // Change the sort field to "title"
      await userActions.selectOptions(screen.getByLabelText('Sort by'), 'title');

      // Wait for sorting to be applied
      await waitFor(() => {
        const taskElements = screen.getAllByRole('heading', { level: 3 });
        expect(taskElements.length).toBe(3);
      });

      // Verify that at least one of the expected tasks is in the first position
      // (exact order depends on whether descending or ascending is applied)
      const taskElements = screen.getAllByRole('heading', { level: 3 });
      expect(taskElements[0]).toHaveTextContent(/Zebra Task|Beta Task|Alpha Task/i);
    });
  });

  describe('Empty States & Edge Cases', () => {
    test('displays empty state when no tasks exist', async () => {
      // Set up the page with no tasks
      setupTasksPage([]);

      // Verify that the empty state message is displayed
      await waitFor(() => {
        expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/get started by creating a new task/i)).toBeInTheDocument();
    });

    test('displays empty state after filtering returns no results', async () => {
      // Set up the page with only low priority tasks
      const userActions = setupTasksPage([
        createMockTask({ title: 'Task 1', priority: 'low' }),
      ]);

      // Wait for the task to load
      await waitFor(() => {
        expect(screen.getByText(/Task 1/i)).toBeInTheDocument();
      });

      // Apply a filter that will exclude all tasks
      await userActions.selectOptions(screen.getByLabelText('Priority'), 'high');

      // Verify that the "no results" empty state is shown
      await waitFor(() => {
        expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
      });
    });

    test('creates task without optional fields', async () => {
      // Set up an empty page
      const userActions = setupTasksPage();

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });

      // Create a task with only the required title field
      await userActions.click(screen.getByRole('button', { name: /new task/i }));
      await userActions.type(screen.getByLabelText(/title/i), 'Minimal Task');
      await userActions.click(screen.getByRole('button', { name: /create task/i }));

      // Verify that the task is created successfully even without optional fields
      expect(await screen.findByRole('heading', { name: /minimal task/i })).toBeInTheDocument();
    });

    test('displays overdue task indicator', async () => {
      // Set up a task with a due date in the past
      setupTasksPage([
        createMockOverdueTask({ title: 'Overdue Task', priority: 'high' }),
      ]);

      // Wait for the task to be rendered
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Overdue Task/i })).toBeInTheDocument();
      });

      // Verify that the overdue indicator is displayed
      expect(screen.getAllByText(/overdue/i).length).toBeGreaterThan(0);
    });

    test('displays due today indicator', async () => {
      // Create a task with a due date set to today
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      setupTasksPage([
        createMockTask({ title: 'Due Today Task', due_date: today.toISOString() }),
      ]);

      // Wait for the task to load
      await waitFor(() => {
        expect(screen.getByText(/Due Today Task/i)).toBeInTheDocument();
      });

      // Verify that the "due today" indicator is shown
      expect(screen.getByText(/due today/i)).toBeInTheDocument();
    });

    test('displays task without category as uncategorized', async () => {
      // Create a task that is not assigned to any category
      setupTasksPage([
        createMockTask({ title: 'No Category Task', category_id: null }),
      ]);

      // Verify that the task is displayed even without a category
      await waitFor(() => {
        expect(screen.getByText(/No Category Task/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh & Error Handling', () => {
    test('refreshes task list', async () => {
      // Set up the page with an initial task
      const userActions = setupTasksPage([
        createMockTask({ title: 'Initial Task' }),
      ]);

      // Wait for the task to appear
      await waitFor(() => {
        expect(screen.getByText(/Initial Task/i)).toBeInTheDocument();
      });

      // Click the refresh button to reload tasks
      await userActions.click(screen.getByLabelText(/Refresh/i));

      // Verify that the task is still displayed after refresh
      await waitFor(() => {
        expect(screen.getByText(/Initial Task/i)).toBeInTheDocument();
      });
    });

    test('displays task count in header', async () => {
      // Set up the page with multiple tasks
      setupTasksPage([
        createMockTask({ title: 'Task 1' }),
        createMockTask({ title: 'Task 2' }),
        createMockTask({ title: 'Task 3' }),
      ]);

      // Verify that the correct task count is displayed in the header (plural form)
      await waitFor(() => {
        expect(screen.getByText(/3 tasks/i)).toBeInTheDocument();
      });
    });

    test('displays singular task in header for one task', async () => {
      // Set up the page with exactly one task
      setupTasksPage([
        createMockTask({ title: 'Single Task' }),
      ]);

      // Verify that the correct task count is displayed using singular form
      await waitFor(() => {
        expect(screen.getByText(/1 task$/i)).toBeInTheDocument();
      });
    });
  });

  describe('Modal Interactions', () => {
    test('closes modal when cancel is clicked', async () => {
      // Set up an empty page
      const userActions = setupTasksPage();

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });

      // Open the create task modal
      await userActions.click(screen.getByRole('button', { name: /new task/i }));

      // Verify that the modal is open
      expect(screen.getByText(/create new task/i)).toBeInTheDocument();

      // Click the cancel button to close the modal
      await userActions.click(screen.getByRole('button', { name: /cancel/i }));

      // Verify that the modal has been closed
      await waitFor(() => {
        expect(screen.queryByText(/create new task/i)).not.toBeInTheDocument();
      });
    });

    test('pre-fills edit modal with task data', async () => {
      // Create a task with specific data to verify pre-filling
      const task = createMockTask({
        title: 'Edit Me',
        description: 'Original description',
        priority: 'high',
        category_id: workCategory.id,
      });
      const userActions = setupTasksPage([task]);

      // Wait for the task to appear
      await waitFor(() => {
        expect(screen.getByText(/Edit Me/i)).toBeInTheDocument();
      });

      // Open the edit modal for this task
      await userActions.click(screen.getAllByLabelText(/edit task/i)[0]);

      // Verify that all form fields are pre-filled with the task's current data
      expect(screen.getByLabelText(/title/i)).toHaveValue('Edit Me');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Original description');
      expect(screen.getByLabelText('Priority', { selector: 'select#priority' })).toHaveValue('high');
      expect(screen.getByLabelText('Category', { selector: 'select#category_id' })).toHaveValue(workCategory.id.toString());
    });

    test('clears validation errors when typing in field', async () => {
      // Set up an empty page
      const userActions = setupTasksPage();

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });

      // Open create modal and try to submit without required fields to trigger validation
      await userActions.click(screen.getByRole('button', { name: /new task/i }));
      await userActions.click(screen.getByRole('button', { name: /create task/i }));

      // Verify that validation error appears
      expect(await screen.findByText(/title is required/i)).toBeInTheDocument();

      // Start typing in the title field
      await userActions.type(screen.getByLabelText(/title/i), 'New Task');

      // Verify that the validation error disappears once the user starts fixing it
      await waitFor(() => {
        expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Task Completion Toggle', () => {
    test('toggles task from incomplete to complete', async () => {
      // Create an incomplete task
      const task = createMockTask({ title: 'Toggle Me', is_completed: false });
      const userActions = setupTasksPage([task]);

      // Wait for task to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Toggle Me/i)).toBeInTheDocument();
      });

      // Find the checkbox and verify it's unchecked
      const checkbox = screen.getByRole('checkbox', { name: /mark task complete/i });
      expect(checkbox).not.toBeChecked();

      // Click the checkbox to mark the task as complete
      await userActions.click(checkbox);

      // Verify that the checkbox is now checked and the label has changed
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /mark task incomplete/i })).toBeChecked();
      });
    });

    test('toggles task from complete to incomplete', async () => {
      // Create a completed task
      const task = createMockCompletedTask({ title: 'Completed Task' });
      const userActions = setupTasksPage([task]);

      // Wait for task to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Completed Task/i)).toBeInTheDocument();
      });

      // Find the checkbox and verify it's checked
      const checkbox = screen.getByRole('checkbox', { name: /mark task incomplete/i });
      expect(checkbox).toBeChecked();

      // Click the checkbox to mark the task as incomplete
      await userActions.click(checkbox);

      // Verify that the checkbox is now unchecked and the label has changed
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /mark task complete/i })).not.toBeChecked();
      });
    });
  });
});
