import { renderHook, act } from '@testing-library/react';
import { useCategories } from '../../../hooks/useCategories';
import * as api from '../../../utils/api';

// Validates hook behavior covering initial load through full CRUD lifecycle.

// Mock the API module so we have full control over category responses.
jest.mock('../../../utils/api');

describe('useCategories Hook', () => {
  beforeEach(() => {
    // Reset mocks so each test configures only the calls it needs.
    jest.clearAllMocks();
  });

  describe('Initialization and Data Fetching', () => {
    test('initializes with empty state', async () => {
      // Simulate an empty API payload returned on first load.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [] }
      });

      const { result } = renderHook(() => useCategories());

      // Give the hook time to resolve its initial fetch before inspecting state.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.categories).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('fetches categories on mount', async () => {
      // Provide stubbed category data so the hook has records to ingest.
      const mockCategories = [
        { id: 1, name: 'Work', color: '#3B82F6', task_count: 5 },
        { id: 2, name: 'Personal', color: '#10B981', task_count: 3 }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: mockCategories }
      });

      // Render the hook and wait for the fetch promise to resolve.
      renderHook(() => useCategories());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(api.categoriesAPI.getCategories).toHaveBeenCalled();
    });

    test('handles fetch error', async () => {
      // Surface an error from the API to verify error state propagation.
      const errorMessage = 'Failed to fetch categories';
      api.categoriesAPI.getCategories.mockRejectedValue({
        response: { data: { error: errorMessage } }
      });

      const { result } = renderHook(() => useCategories());

      // Wait for the rejected promise to propagate through the hook.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.error).toBe(errorMessage);
    });

    test('sets loading state correctly during fetch', async () => {
      // Delay the API promise so the loading flag can be observed mid-request.
      let resolveGetCategories;
      api.categoriesAPI.getCategories.mockImplementation(() =>
        new Promise(resolve => {
          resolveGetCategories = resolve;
        })
      );

      const { result } = renderHook(() => useCategories());

      // Allow the hook's effect to fire without yet settling the promise.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // The hook should report that it's still loading while pending.
      expect(result.current.loading).toBe(true);

      // Resolve the pending request and flush state updates.
      await act(async () => {
        resolveGetCategories({ data: { categories: [] } });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('createCategory', () => {
    test('creates category successfully and adds to list', async () => {
      // Mock a successful create request on top of an empty initial load.
      const newCategory = {
        id: 1,
        name: 'New Category',
        color: '#FF5733',
        task_count: 0
      };

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [] }
      });

      api.categoriesAPI.createCategory.mockResolvedValue({
        data: { category: newCategory }
      });

      const { result } = renderHook(() => useCategories());

      // Invoke createCategory and capture its return payload.
      let createResult;
      await act(async () => {
        createResult = await result.current.createCategory({
          name: 'New Category',
          color: '#FF5733'
        });
      });

      expect(createResult.success).toBe(true);
      expect(createResult.category).toEqual(newCategory);
      expect(result.current.categories).toContainEqual(newCategory);
    });

    test('handles create category error', async () => {
      // Surface validation errors from the create endpoint to ensure they bubble up.
      const errorMessage = 'Category name is required';
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [] }
      });

      api.categoriesAPI.createCategory.mockRejectedValue({
        response: {
          data: {
            error: 'Validation failed',
            details: [errorMessage]
          }
        }
      });

      const { result } = renderHook(() => useCategories());

      // Attempt to create a category with missing data.
      let createResult;
      await act(async () => {
        createResult = await result.current.createCategory({});
      });

      expect(createResult.success).toBe(false);
      expect(createResult.error).toBe('Validation failed');
      expect(createResult.details).toContain(errorMessage);
    });

    test('adds new category to the list', async () => {
      // Start with one category and prepare a successful create response.
      const existingCategories = [
        { id: 1, name: 'Existing Category', color: '#000000', task_count: 0 }
      ];

      const newCategory = { id: 2, name: 'New Category', color: '#FFFFFF', task_count: 0 };

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: existingCategories }
      });

      api.categoriesAPI.createCategory.mockResolvedValue({
        data: { category: newCategory }
      });

      const { result } = renderHook(() => useCategories());

      // Allow the initial fetch to populate state before creating a second record.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.createCategory({ name: 'New Category', color: '#FFFFFF' });
      });

      expect(result.current.categories).toHaveLength(2);
      expect(result.current.categories).toContainEqual(newCategory);
    });

    test('handles duplicate category name error', async () => {
      // Simulate a duplicate name failure from the backend.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [{ id: 1, name: 'Work' }] }
      });

      api.categoriesAPI.createCategory.mockRejectedValue({
        response: {
          data: {
            error: 'Validation failed',
            details: ['Category name already exists']
          }
        }
      });

      const { result } = renderHook(() => useCategories());

      // Try to create a category with an existing name.
      let createResult;
      await act(async () => {
        createResult = await result.current.createCategory({ name: 'Work' });
      });

      expect(createResult.success).toBe(false);
      expect(createResult.details).toContain('Category name already exists');
    });
  });

  describe('updateCategory', () => {
    test('updates category successfully', async () => {
      // Prepare seed data and a successful update response.
      const originalCategory = { id: 1, name: 'Original', color: '#000000', task_count: 5 };
      const updatedCategory = { id: 1, name: 'Updated', color: '#FFFFFF', task_count: 5 };

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [originalCategory] }
      });

      api.categoriesAPI.updateCategory.mockResolvedValue({
        data: { category: updatedCategory }
      });

      const { result } = renderHook(() => useCategories());

      // Allow the initial load to finish before issuing the update.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateCategory(1, {
          name: 'Updated',
          color: '#FFFFFF'
        });
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.category).toEqual(updatedCategory);
      expect(result.current.categories[0]).toEqual(updatedCategory);
    });

    test('handles update category error', async () => {
      // Force the API to reject the update request.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [{ id: 1, name: 'Category' }] }
      });

      api.categoriesAPI.updateCategory.mockRejectedValue({
        response: {
          data: { error: 'Category not found' }
        }
      });

      const { result } = renderHook(() => useCategories());

      // Attempt to update a non-existent category id.
      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateCategory(999, { name: 'Updated' });
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toBe('Category not found');
    });

    test('updates correct category in list', async () => {
      // Use multiple categories so we can verify only one entry changes.
      const categories = [
        { id: 1, name: 'Category 1', color: '#111111' },
        { id: 2, name: 'Category 2', color: '#222222' },
        { id: 3, name: 'Category 3', color: '#333333' }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories }
      });

      api.categoriesAPI.updateCategory.mockResolvedValue({
        data: { category: { id: 2, name: 'Updated Category 2', color: '#999999' } }
      });

      const { result } = renderHook(() => useCategories());

      // Wait for initial data, then perform the update call.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateCategory(2, { name: 'Updated Category 2', color: '#999999' });
      });

      expect(result.current.categories[1].name).toBe('Updated Category 2');
      expect(result.current.categories[1].color).toBe('#999999');
      expect(result.current.categories[0].name).toBe('Category 1');
      expect(result.current.categories[2].name).toBe('Category 3');
    });

    test('handles invalid color format error', async () => {
      // Configure the API to report a validation failure for invalid colors.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [{ id: 1, name: 'Category' }] }
      });

      api.categoriesAPI.updateCategory.mockRejectedValue({
        response: {
          data: {
            error: 'Validation failed',
            details: ['Color must be a valid hex color code']
          }
        }
      });

      const { result } = renderHook(() => useCategories());

      // Attempt to update with a malformed color value.
      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateCategory(1, { color: 'invalid' });
      });

      // The hook should return the validation failure and surface the details array.
      expect(updateResult.success).toBe(false);
      expect(updateResult.details).toContain('Color must be a valid hex color code');
    });
  });

  describe('deleteCategory', () => {
    test('deletes category successfully', async () => {
      // Seed with multiple categories and mock a successful delete response.
      const categories = [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories }
      });

      api.categoriesAPI.deleteCategory.mockResolvedValue({});

      const { result } = renderHook(() => useCategories());

      // Allow the initial fetch to populate state, then issue the delete call.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteCategory(1);
      });

      expect(deleteResult.success).toBe(true);
      expect(result.current.categories).toHaveLength(1);
      expect(result.current.categories[0].id).toBe(2);
    });

    test('handles delete category error', async () => {
      // Simulate a not-found response from the API.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [{ id: 1, name: 'Category' }] }
      });

      api.categoriesAPI.deleteCategory.mockRejectedValue({
        response: { data: { error: 'Category not found' } }
      });

      const { result } = renderHook(() => useCategories());

      // Attempt to delete a missing category id.
      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteCategory(999);
      });

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toBe('Category not found');
    });

    test('removes only specified category from list', async () => {
      // Ensure removing one item leaves the rest untouched.
      const categories = [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' },
        { id: 3, name: 'Category 3' }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories }
      });

      api.categoriesAPI.deleteCategory.mockResolvedValue({});

      const { result } = renderHook(() => useCategories());

      // Wait for the initial data before deleting one entry.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.deleteCategory(2);
      });

      expect(result.current.categories).toHaveLength(2);
      expect(result.current.categories.find(c => c.id === 2)).toBeUndefined();
      expect(result.current.categories.find(c => c.id === 1)).toBeDefined();
      expect(result.current.categories.find(c => c.id === 3)).toBeDefined();
    });

    test('handles delete category with tasks error', async () => {
      // Reject deletion when the category still has associated tasks.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [{ id: 1, name: 'Category', task_count: 5 }] }
      });

      api.categoriesAPI.deleteCategory.mockRejectedValue({
        response: {
          data: {
            error: 'Cannot delete category with existing tasks',
            details: { tasks: 5 }
          }
        }
      });

      const { result } = renderHook(() => useCategories());

      // Attempt to delete the category that still has tasks.
      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteCategory(1);
      });

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toBe('Cannot delete category with existing tasks');
      expect(deleteResult.details).toEqual({ tasks: 5 });
    });
  });

  describe('Utility Functions', () => {
    test('refreshCategories re-fetches categories', async () => {
      // Resolve the initial call, then confirm the manual refresh hits the API again.
      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [] }
      });

      const { result } = renderHook(() => useCategories());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      jest.clearAllMocks();

      await act(async () => {
        result.current.refreshCategories();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // The refresh call should trigger another fetch against the API mock.
      expect(api.categoriesAPI.getCategories).toHaveBeenCalled();
    });

    test('getCategoryById returns correct category', async () => {
      // Load multiple categories so lookups can return a match.
      const categories = [
        { id: 1, name: 'Work' },
        { id: 2, name: 'Personal' },
        { id: 3, name: 'Shopping' }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories }
      });

      const { result } = renderHook(() => useCategories());

      // Wait for categories to populate then look up by id.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const category = result.current.getCategoryById(2);

      expect(category).toEqual({ id: 2, name: 'Personal' });
    });

    test('getCategoryById returns undefined for non-existent ID', async () => {
      // Use a single category so a missing lookup returns undefined.
      const categories = [
        { id: 1, name: 'Work' }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories }
      });

      const { result } = renderHook(() => useCategories());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const category = result.current.getCategoryById(999);

      expect(category).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('handles network error gracefully', async () => {
      // Throw a generic error during initial fetch to verify defensive state.
      api.categoriesAPI.getCategories.mockRejectedValue(new Error('Network error'));

      let result;
      await act(async () => {
        result = renderHook(() => useCategories()).result;
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.categories).toEqual([]);
    });

    test('clears error on successful operation', async () => {
      // Emulate a retry scenario: first call fails, second succeeds.
      // First call fails
      api.categoriesAPI.getCategories.mockRejectedValueOnce({
        response: { data: { error: 'Failed to fetch' } }
      });

      // Second call succeeds
      api.categoriesAPI.getCategories.mockResolvedValueOnce({
        data: { categories: [{ id: 1, name: 'Category' }] }
      });

      const { result } = renderHook(() => useCategories());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Confirm the hook captured the initial failure message.
      expect(result.current.error).toBe('Failed to fetch');

      await act(async () => {
        result.current.refreshCategories();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // After a successful retry the error should clear and data should load.
      expect(result.current.error).toBeNull();
      expect(result.current.categories).toHaveLength(1);
    });
  });

  describe('State Consistency', () => {
    test('maintains category order after update', async () => {
      // Verify updates do not reorder the list.
      const categories = [
        { id: 1, name: 'A Category' },
        { id: 2, name: 'B Category' },
        { id: 3, name: 'C Category' }
      ];

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories }
      });

      api.categoriesAPI.updateCategory.mockResolvedValue({
        data: { category: { id: 2, name: 'Z Category', color: '#000000' } }
      });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load then update one category.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateCategory(2, { name: 'Z Category' });
      });

      // Order should remain the same (id 1, 2, 3)
      expect(result.current.categories[0].id).toBe(1);
      expect(result.current.categories[1].id).toBe(2);
      expect(result.current.categories[2].id).toBe(3);
    });

    test('task_count reflects in category object', async () => {
      // Ensure task counts from the API payload persist in hook state.
      const category = {
        id: 1,
        name: 'Work',
        color: '#3B82F6',
        task_count: 10
      };

      api.categoriesAPI.getCategories.mockResolvedValue({
        data: { categories: [category] }
      });

      const { result } = renderHook(() => useCategories());

      // Wait for the initial fetch so task_count is populated.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.categories[0].task_count).toBe(10);
    });
  });
});
