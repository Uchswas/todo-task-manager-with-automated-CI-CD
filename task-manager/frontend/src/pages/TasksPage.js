import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import { formatDate, isOverdue, isDueToday, getPriorityBadgeColor } from '../utils/helpers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const TasksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();
  const {
    tasks,
    loading,
    error,
    pagination,
    filters,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    refreshTasks,
    updateFilters,
    goToPage
  } = useTasks();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
    category_id: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toggleError, setToggleError] = useState('');

  // Filter state
  const [localFilters, setLocalFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
    priority: searchParams.get('priority') || 'all',
    category_id: searchParams.get('category_id') || 'all',
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: searchParams.get('sort_order') || 'desc'
  });

  // Check if we should open create modal from query params
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Apply filters with debouncing for search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const apiFilters = {
        sort_by: localFilters.sort_by,
        sort_order: localFilters.sort_order
      };

      // Only add filters if they have actual values (not "all")
      const searchTerm = localFilters.search?.trim();
      if (searchTerm) {
        apiFilters.search = searchTerm;
      }

      if (localFilters.status !== 'all') {
        apiFilters.status = localFilters.status;
      }

      if (localFilters.priority !== 'all') {
        apiFilters.priority = localFilters.priority;
      }

      if (localFilters.category_id !== 'all') {
        apiFilters.category_id = localFilters.category_id;
      }

      updateFilters(apiFilters);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFilters.search, localFilters.status, localFilters.priority, localFilters.category_id, localFilters.sort_by, localFilters.sort_order]);

  const handleFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      due_date: '',
      priority: 'medium',
      category_id: ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority,
      category_id: task.category_id || ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      due_date: '',
      priority: 'medium',
      category_id: ''
    });
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    const taskData = {
      ...formData,
      category_id: formData.category_id || null,
      description: formData.description || null,
      due_date: formData.due_date || null
    };

    const result = editingTask
      ? await updateTask(editingTask.id, taskData)
      : await createTask(taskData);

    setSubmitting(false);

    if (result.success) {
      closeModal();
    } else {
      setFormErrors({ submit: result.error });
    }
  };

  const handleToggleComplete = async (taskId) => {
    setToggleError('');
    const result = await toggleTaskComplete(taskId);
    if (result && !result.success) {
      setToggleError(result.error || 'Toggle failed');
      setTimeout(() => setToggleError(''), 3000);
    }
  };

  const handleDeleteClick = (task) => {
    setDeleteConfirm(task);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm) {
      await deleteTask(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  // Only show full-page loading on initial load (no filters applied)
  const isInitialLoad = loading && tasks.length === 0 &&
    !localFilters.search &&
    localFilters.status === 'all' &&
    localFilters.priority === 'all' &&
    localFilters.category_id === 'all';

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination?.total || 0} {pagination?.total === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshTasks}
            className="p-2 text-gray-400 hover:text-gray-600"
            aria-label="Refresh"
            title="Refresh tasks"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search tasks..."
              value={localFilters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input-field"
              aria-label="Search tasks"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={localFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field"
              aria-label="Status"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={localFilters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="input-field"
              aria-label="Priority"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={localFilters.category_id}
              onChange={(e) => handleFilterChange('category_id', e.target.value)}
              className="input-field"
              aria-label="Category"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={localFilters.sort_by}
            onChange={(e) => handleFilterChange('sort_by', e.target.value)}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            aria-label="Sort by"
          >
            <option value="created_at">Created Date</option>
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
            <option value="title">Title</option>
          </select>
          <button
            onClick={() => {
              const newOrder = localFilters.sort_order === 'asc' ? 'desc' : 'asc';
              setLocalFilters(prev => ({ ...prev, sort_order: newOrder }));
              updateFilters({ ...filters, sort_order: newOrder });
            }}
            className="p-1 text-gray-600 hover:text-gray-900"
            aria-label="Sort order"
            title={localFilters.sort_order === 'asc' ? 'Ascending' : 'Descending'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {localFilters.sort_order === 'asc' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              )}
            </svg>
          </button>
          {(localFilters.search || localFilters.status !== 'all' || localFilters.priority !== 'all' || localFilters.category_id !== 'all' || localFilters.sort_by !== 'created_at' || localFilters.sort_order !== 'desc' || Object.keys(filters || {}).length > 0) && (
            <button
              onClick={() => {
                setLocalFilters({ search: '', status: 'all', priority: 'all', category_id: 'all', sort_by: 'created_at', sort_order: 'desc' });
                updateFilters({});
              }}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {error && <ErrorMessage message={error} onRetry={refreshTasks} />}
      {toggleError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {toggleError}
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-gray-500">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new task.</p>
            <div className="mt-6">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => {
              const categoryInfo = task.category_id ? categories.find(c => c.id === task.category_id) : null;

              return (
                <div
                  key={task.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${task.is_completed ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => handleToggleComplete(task.id)}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Mark task ${task.is_completed ? 'incomplete' : 'complete'}`}
                    />

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex-1 ${task.is_completed ? 'line-through' : ''}`}>
                          <h3 className={`text-base font-medium ${
                            task.is_completed ? 'text-gray-500' : 'text-gray-900'
                          }`}>
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="mt-1 text-sm text-gray-600">
                              {task.description}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {/* Priority Badge */}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeColor(task.priority)}`}>
                              {task.priority}
                            </span>

                            {/* Category Badge */}
                            {categoryInfo && (
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: categoryInfo.color }}
                              >
                                {categoryInfo.name}
                              </span>
                            )}

                            {/* Due Date */}
                            {task.due_date && (
                              <span className={`text-xs ${
                                isOverdue(task.due_date) && !task.is_completed
                                  ? 'text-red-600 font-medium'
                                  : isDueToday(task.due_date) && !task.is_completed
                                    ? 'text-yellow-600 font-medium'
                                    : 'text-gray-500'
                              }`}>
                                {isOverdue(task.due_date) && !task.is_completed ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Edit"
                            aria-label="Edit task"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(task)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete"
                            aria-label="Delete task"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {tasks.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            {pagination.pages > 1 && (
              <div className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={!pagination.has_prev}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                aria-label="Previous page"
              >
                Previous
              </button>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={!pagination.has_next}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`input-field ${formErrors.title ? 'border-red-300' : ''}`}
              placeholder="Task title"
            />
            {formErrors.title && (
              <p className="error-message">{formErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="input-field"
              placeholder="Enter task description (optional)"
            />
          </div>

          {/* Due Date and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
                Due Date
              </label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              className="input-field"
            >
              <option value="">No Category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error Message */}
          {formErrors.submit && (
            <ErrorMessage message={formErrors.submit} />
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Removal"
        message={`Are you sure you want to remove "${deleteConfirm?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </div>
  );
};

export default TasksPage;
