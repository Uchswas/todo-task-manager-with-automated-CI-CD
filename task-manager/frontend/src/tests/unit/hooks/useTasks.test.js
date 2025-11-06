import { renderHook, act } from '@testing-library/react';
import { useTasks } from '../../../hooks/useTasks';
import * as api from '../../../utils/api';

// Exercises the task hook across lifecycle events and CRUD methods to ensure state stays in sync with API mocks.

// Mock the API module so we can dictate the responses returned to the hook.
jest.mock('../../../utils/api');

describe('useTasks Hook', () => {
  beforeEach(() => {
    // Reset API call history between tests so no assertions bleed over.
    jest.clearAllMocks();
  });

  describe('Initialization and Data Fetching', () => {
    test('initializes with empty state', async () => {
      // Stub an empty dataset with pagination defaults.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: {
          tasks: [],
          pagination: {
            page: 1,
            per_page: 50,
            total: 0,
            pages: 0,
            has_next: false,
            has_prev: false
          }
        }
      });

      const { result } = renderHook(() => useTasks());

      // Wait for the hook's initial fetch to complete before reading state.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.tasks).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('fetches tasks on mount', async () => {
      // Mock two initial tasks so we can assert the fetch occurs.
      const mockTasks = [
        { id: 1, title: 'Task 1', is_completed: false },
        { id: 2, title: 'Task 2', is_completed: true }
      ];

      api.tasksAPI.getTasks.mockResolvedValue({
        data: {
          tasks: mockTasks,
          pagination: {
            page: 1,
            per_page: 50,
            total: 2,
            pages: 1,
            has_next: false,
            has_prev: false
          }
        }
      });

      // Render the hook and flush pending promises so the API mock is consumed.
      renderHook(() => useTasks());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(api.tasksAPI.getTasks).toHaveBeenCalled();
    });

    test('handles fetch error', async () => {
      // Emulate an API error so the hook reports it via state.
      const errorMessage = 'Failed to fetch tasks';
      api.tasksAPI.getTasks.mockRejectedValue({
        response: { data: { error: errorMessage } }
      });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.error).toBe(errorMessage);
    });

    test('initializes with custom filters', async () => {
      // Set expectations on the filters forwarded to the API.
      const customFilters = { status: 'completed', priority: 'high' };

      api.tasksAPI.getTasks.mockResolvedValue({
        data: {
          tasks: [],
          pagination: {
            page: 1,
            per_page: 50,
            total: 0,
            pages: 0,
            has_next: false,
            has_prev: false
          }
        }
      });

      // Render with filters and allow the fetch cycle to complete.
      renderHook(() => useTasks(customFilters));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(api.tasksAPI.getTasks).toHaveBeenCalledWith(
        expect.objectContaining(customFilters)
      );
    });
  });

  describe('createTask', () => {
    test('creates task successfully and adds to list', async () => {
      // Stub a successful task creation to ensure optimistic updates work properly.
      const newTask = {
        id: 1,
        title: 'New Task',
        description: 'Task description',
        priority: 'high'
      };

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: {} }
      });

      api.tasksAPI.createTask.mockResolvedValue({
        data: { task: newTask }
      });

      const { result } = renderHook(() => useTasks());

      // Invoke createTask and capture the resulting payload.
      let createResult;
      await act(async () => {
        createResult = await result.current.createTask({
          title: 'New Task',
          description: 'Task description',
          priority: 'high'
        });
      });

      // The hook should return the new task and include it in state.
      expect(createResult.success).toBe(true);
      expect(createResult.task).toEqual(newTask);
      expect(result.current.tasks).toContainEqual(newTask);
    });

    test('handles create task error', async () => {
      // Surface validation errors from the API so the hook can relay them.
      const errorMessage = 'Title is required';
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: {} }
      });

      api.tasksAPI.createTask.mockRejectedValue({
        response: {
          data: {
            error: 'Validation failed',
            details: [errorMessage]
          }
        }
      });

      const { result } = renderHook(() => useTasks());

      // Attempt to create a task without the required fields.
      let createResult;
      await act(async () => {
        createResult = await result.current.createTask({});
      });

      // Failed creates should return the error message and forward the details array.
      expect(createResult.success).toBe(false);
      expect(createResult.error).toBe('Validation failed');
      expect(createResult.details).toContain(errorMessage);
    });

    test('adds new task to the beginning of the list', async () => {
      // Ensure the new task gets unshifted onto the array.
      const existingTasks = [
        { id: 1, title: 'Existing Task' }
      ];

      const newTask = { id: 2, title: 'New Task' };

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: existingTasks, pagination: {} }
      });

      api.tasksAPI.createTask.mockResolvedValue({
        data: { task: newTask }
      });

      const { result } = renderHook(() => useTasks());

      // Allow the initial load to finish before adding a new task.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.createTask({ title: 'New Task' });
      });

      // Newly created tasks should appear at the top of the collection.
      expect(result.current.tasks[0]).toEqual(newTask);
      expect(result.current.tasks).toHaveLength(2);
    });
  });

  describe('updateTask', () => {
    test('updates task successfully', async () => {
      // Provide an initial task and a mock response representing the updated values.
      const originalTask = { id: 1, title: 'Original', priority: 'low' };
      const updatedTask = { id: 1, title: 'Updated', priority: 'high' };

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [originalTask], pagination: {} }
      });

      api.tasksAPI.updateTask.mockResolvedValue({
        data: { task: updatedTask }
      });

      const { result } = renderHook(() => useTasks());

      // Allow the hook to load the existing task before issuing the update.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateTask(1, {
          title: 'Updated',
          priority: 'high'
        });
      });

      // After the mutation, the hook should expose the new task both in the return payload and local state.
      expect(updateResult.success).toBe(true);
      expect(updateResult.task).toEqual(updatedTask);
      expect(result.current.tasks[0]).toEqual(updatedTask);
    });

    test('handles update task error', async () => {
      // Seed state with a single task and configure the API to reject the update.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [{ id: 1, title: 'Task' }], pagination: {} }
      });

      api.tasksAPI.updateTask.mockRejectedValue({
        response: {
          data: { error: 'Task not found' }
        }
      });

      const { result } = renderHook(() => useTasks());

      // Attempt to update a non-existent id and confirm the error is propagated.
      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateTask(999, { title: 'Updated' });
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toBe('Task not found');
    });

    test('updates correct task in list', async () => {
      // Provide several tasks to ensure only the targeted entry changes.
      const tasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
        { id: 3, title: 'Task 3' }
      ];

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks, pagination: {} }
      });

      api.tasksAPI.updateTask.mockResolvedValue({
        data: { task: { id: 2, title: 'Updated Task 2' } }
      });

      const { result } = renderHook(() => useTasks());

      // Wait for initial data to hydrate the hook before performing the update.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateTask(2, { title: 'Updated Task 2' });
      });

      // Only the updated task should change; the others remain untouched.
      expect(result.current.tasks[1].title).toBe('Updated Task 2');
      expect(result.current.tasks[0].title).toBe('Task 1');
      expect(result.current.tasks[2].title).toBe('Task 3');
    });
  });

  describe('deleteTask', () => {
    test('deletes task successfully', async () => {
      // Populate the list with two tasks so we can observe one being removed.
      const tasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' }
      ];

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks, pagination: {} }
      });

      api.tasksAPI.deleteTask.mockResolvedValue({});

      const { result } = renderHook(() => useTasks());

      // Wait for the initial fetch to populate the hook.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteTask(1);
      });

      // We should see a successful response and the remaining list should shrink accordingly.
      expect(deleteResult.success).toBe(true);
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].id).toBe(2);
    });

    test('handles delete task error', async () => {
      // Configure the API to return an error when deleting a missing task id.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [{ id: 1, title: 'Task' }], pagination: {} }
      });

      api.tasksAPI.deleteTask.mockRejectedValue({
        response: { data: { error: 'Task not found' } }
      });

      const { result } = renderHook(() => useTasks());

      // Attempt the delete and check that the error message is surfaced.
      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteTask(999);
      });

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toBe('Task not found');
    });

    test('removes only specified task from list', async () => {
      // Provide several tasks to make sure only the specified id is removed.
      const tasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
        { id: 3, title: 'Task 3' }
      ];

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks, pagination: {} }
      });

      api.tasksAPI.deleteTask.mockResolvedValue({});

      const { result } = renderHook(() => useTasks());

      // Wait for the initial fetch to complete.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.deleteTask(2);
      });

      // Exactly one task should disappear while the others remain present.
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks.find(t => t.id === 2)).toBeUndefined();
      expect(result.current.tasks.find(t => t.id === 1)).toBeDefined();
      expect(result.current.tasks.find(t => t.id === 3)).toBeDefined();
    });
  });

  describe('toggleTaskComplete', () => {
    test('toggles task completion status', async () => {
      // Prepare a task starting in an incomplete state and configure the API to return it toggled.
      const task = { id: 1, title: 'Task', is_completed: false };
      const toggledTask = { id: 1, title: 'Task', is_completed: true, completed_at: '2024-01-01' };

      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [task], pagination: {} }
      });

      api.tasksAPI.toggleComplete.mockResolvedValue({
        data: { task: toggledTask }
      });

      const { result } = renderHook(() => useTasks());

      // Wait for the hook to load the task before toggling.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let toggleResult;
      await act(async () => {
        toggleResult = await result.current.toggleTaskComplete(1);
      });

      // After toggling, both the response and local state should reflect completion.
      expect(toggleResult.success).toBe(true);
      expect(toggleResult.task.is_completed).toBe(true);
      expect(result.current.tasks[0].is_completed).toBe(true);
    });

    test('handles toggle error', async () => {
      // Configure the toggle endpoint to throw so we can verify error propagation.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [{ id: 1, title: 'Task' }], pagination: {} }
      });

      api.tasksAPI.toggleComplete.mockRejectedValue({
        response: { data: { error: 'Failed to toggle completion' } }
      });

      const { result } = renderHook(() => useTasks());

      // Attempt the toggle and ensure the failure bubbles outward.
      let toggleResult;
      await act(async () => {
        toggleResult = await result.current.toggleTaskComplete(1);
      });

      expect(toggleResult.success).toBe(false);
      expect(toggleResult.error).toBe('Failed to toggle completion');
    });
  });

  describe('Filter Management', () => {
    test('updateFilters updates filters and resets to page 1', async () => {
      // Mock empty results so we can focus solely on filter state transitions.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: { page: 1 } }
      });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        result.current.updateFilters({ status: 'completed', priority: 'high' });
      });

      // Updated filters should merge the new values and reset the page counter.
      expect(result.current.filters).toMatchObject({
        status: 'completed',
        priority: 'high',
        page: 1
      });
    });

    test('updateFilters replaces old filters completely', async () => {
      // Provide initial filters so we can confirm they are overwritten.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: {} }
      });

      const { result } = renderHook(() => useTasks({ status: 'completed', category_id: 1 }));

      await act(async () => {
        result.current.updateFilters({ priority: 'high' });
      });

      // Only the new filter values should remain after the update.
      expect(result.current.filters.priority).toBe('high');
      expect(result.current.filters.page).toBe(1);
    });

    test('refreshTasks re-fetches current tasks', async () => {
      // Mock the API so we can verify refresh triggers another fetch.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: {} }
      });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      jest.clearAllMocks();

      await act(async () => {
        result.current.refreshTasks();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Refreshing should call back into the API with the existing filters.
      expect(api.tasksAPI.getTasks).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    test('loadMore fetches next page if has_next is true', async () => {
      // Provide two sequential pages so loadMore can request the follow-up data set.
      api.tasksAPI.getTasks
        .mockResolvedValueOnce({
          data: {
            tasks: [{ id: 1 }],
            pagination: { page: 1, has_next: true, has_prev: false }
          }
        })
        .mockResolvedValueOnce({
          data: {
            tasks: [{ id: 2 }],
            pagination: { page: 2, has_next: false, has_prev: true }
          }
        });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.loadMore();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // The second API call should request page two of results.
      expect(api.tasksAPI.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    test('loadMore does nothing if has_next is false', async () => {
      // Mock a single-page response so the hook knows there are no additional pages.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: {
          tasks: [{ id: 1 }],
          pagination: { page: 1, has_next: false, has_prev: false }
        }
      });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      jest.clearAllMocks();

      act(() => {
        result.current.loadMore();
      });

      // Without another page queued up, no API call should be issued.
      expect(api.tasksAPI.getTasks).not.toHaveBeenCalled();
    });

    test('goToPage navigates to specific page', async () => {
      // Calling goToPage should request the given page from the backend.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: {} }
      });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        result.current.goToPage(3);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // The API call should target the requested page index.
      expect(api.tasksAPI.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3 })
      );
    });
  });

  describe('State Management', () => {
    test('setTasks directly updates tasks state', async () => {
      // Mock the API to avoid unintended updates when the hook mounts.
      api.tasksAPI.getTasks.mockResolvedValue({
        data: { tasks: [], pagination: {} }
      });

      const { result } = renderHook(() => useTasks());

      // Provide a new tasks array to confirm the setter replaces the existing state.
      const newTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' }
      ];

      act(() => {
        result.current.setTasks(newTasks);
      });

      // The hook should expose the tasks array exactly as provided.
      expect(result.current.tasks).toEqual(newTasks);
    });

    test('pagination state updates correctly', async () => {
      // Create a full pagination payload so we can verify it is mirrored in state.
      const mockPagination = {
        page: 2,
        per_page: 25,
        total: 100,
        pages: 4,
        has_next: true,
        has_prev: true
      };

      api.tasksAPI.getTasks.mockResolvedValue({
        data: {
          tasks: [],
          pagination: mockPagination
        }
      });

      const { result } = renderHook(() => useTasks());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Once the initial fetch resolves, pagination should match the API response.
      expect(result.current.pagination).toEqual(mockPagination);
    });
  });
});
