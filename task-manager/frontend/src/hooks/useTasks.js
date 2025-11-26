import { useState, useEffect, useCallback, useRef } from 'react';
import { tasksAPI } from '../utils/api';

export const useTasks = (initialFilters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    pages: 0,
    has_next: false,
    has_prev: false
  });
  const [filters, setFilters] = useState(initialFilters);
  const initialFiltersRef = useRef(initialFilters);

  useEffect(() => {
    initialFiltersRef.current = initialFilters;
  }, [initialFilters]);

  const fetchTasks = useCallback(async (customFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = { ...filters, ...customFilters };
      const response = await tasksAPI.getTasks(params);

      setTasks(response.data.tasks);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createTask = async (taskData) => {
    try {
      const response = await tasksAPI.createTask(taskData);
      const newTask = response.data.task;
      
      setTasks(prevTasks => [newTask, ...prevTasks]);
      return { success: true, task: newTask };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create task';
      const errorDetails = err.response?.data?.details || [];
      return { success: false, error: errorMessage, details: errorDetails };
    }
  };

  const updateTask = async (taskId, taskData) => {
    try {
      const response = await tasksAPI.updateTask(taskId, taskData);
      const updatedTask = response.data.task;
      
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? updatedTask : task
        )
      );
      
      return { success: true, task: updatedTask };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to update task';
      const errorDetails = err.response?.data?.details || [];
      return { success: false, error: errorMessage, details: errorDetails };
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await tasksAPI.deleteTask(taskId);
      
      setTasks(prevTasks => 
        prevTasks.filter(task => task.id !== taskId)
      );
      
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to delete task';
      return { success: false, error: errorMessage };
    }
  };

  const toggleTaskComplete = async (taskId) => {
    try {
      const response = await tasksAPI.toggleComplete(taskId);
      const updatedTask = response.data.task;
      
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? updatedTask : task
        )
      );
      
      return { success: true, task: updatedTask };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to toggle task completion';
      return { success: false, error: errorMessage };
    }
  };

  const refreshTasks = () => {
    fetchTasks();
  };

  const updateFilters = useCallback((newFilters) => {
    // Replace filters entirely instead of merging to properly clear old filters
    setFilters({
      ...initialFiltersRef.current,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    });
  }, []);

  const loadMore = () => {
    if (pagination.has_next) {
      fetchTasks({ page: pagination.page + 1 });
    }
  };

  const goToPage = (page) => {
    fetchTasks({ page });
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
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
    loadMore,
    goToPage,
    setTasks
  };
};

export default useTasks;
