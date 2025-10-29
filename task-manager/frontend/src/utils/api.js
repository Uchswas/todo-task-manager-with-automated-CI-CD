import axios from 'axios';

/* eslint-disable-next-line no-undef */
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if it's not a login/register attempt
    // This allows login errors to be handled by the component
    const isAuthEndpoint = error.config?.url?.includes('/api/auth/login') ||
                          error.config?.url?.includes('/api/auth/register');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  logout: () => api.post('/api/auth/logout'),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (userData) => api.put('/api/auth/profile', userData),
};

// Tasks API calls
export const tasksAPI = {
  getTasks: (params = {}) => api.get('/api/tasks', { params }),
  getTask: (id) => api.get(`/api/tasks/${id}`),
  createTask: (taskData) => api.post('/api/tasks', taskData),
  updateTask: (id, taskData) => api.put(`/api/tasks/${id}`, taskData),
  deleteTask: (id) => api.delete(`/api/tasks/${id}`),
  toggleComplete: (id) => api.patch(`/api/tasks/${id}/complete`),
  getOverdueTasks: (params = {}) => api.get('/api/tasks/overdue', { params }),
};

// Categories API calls
export const categoriesAPI = {
  getCategories: () => api.get('/api/categories'),
  getCategory: (id) => api.get(`/api/categories/${id}`),
  createCategory: (categoryData) => api.post('/api/categories', categoryData),
  updateCategory: (id, categoryData) => api.put(`/api/categories/${id}`, categoryData),
  deleteCategory: (id) => api.delete(`/api/categories/${id}`),
  getCategoryTasks: (id, params = {}) => api.get(`/api/categories/${id}/tasks`, { params }),
};

// Statistics API calls
export const statsAPI = {
  getStats: () => api.get('/api/stats'),
  getSummaryStats: () => api.get('/api/stats/summary'),
};

// Health check
export const healthAPI = {
  getHealth: () => api.get('/health'),
  getDetailedHealth: () => api.get('/health/detailed'),
};

export default api;