import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../hooks/useAuth';
import { setMockUser } from './api-mocks';

/**
 * Custom render function that wraps components with all necessary providers
 * for integration testing (AuthProvider, Router, etc.)
 *
 * IMPORTANT: Pass routes or individual page components, NOT the App component
 * (which already includes a Router)
 *
 * @param {React.ReactElement} ui - The component or Routes to render
 * @param {Object} options - Configuration options
 * @param {string} options.initialRoute - Initial route for MemoryRouter (default: '/')
 * @param {Array<string>} options.initialEntries - All initial history entries for MemoryRouter
 * @param {Object} options.authValue - Initial auth context value (for pre-authenticated tests)
 * @param {Object} options.renderOptions - Additional options to pass to RTL render
 * @returns {Object} RTL render result with custom utilities
 */
export function renderWithProviders(
  ui,
  {
    initialRoute = '/',
    initialEntries = null,
    authValue = null,
    ...renderOptions
  } = {}
) {
  // Use initialEntries if provided, otherwise use initialRoute
  const routerEntries = initialEntries || [initialRoute];

  if (authValue?.user) {
    // Keep the API mock store in sync with the AuthProvider so components read the same user details.
    setMockUser(authValue.user);
  } else if (!authValue && typeof window !== 'undefined') {
    const storedUser = window.localStorage?.getItem('user');
    if (storedUser) {
      try {
        setMockUser(JSON.parse(storedUser));
      } catch (error) {
        // Ignore malformed storage state during tests
      }
    }
  }

  function Wrapper({ children }) {
    return (
      <AuthProvider initialValue={authValue}>
        <MemoryRouter initialEntries={routerEntries}>
          {children}
        </MemoryRouter>
      </AuthProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Renders the entire app with routing for full integration tests
 * This re-creates the App structure without the duplicate Router
 *
 * @param {Object} options - Configuration options
 * @param {string} options.initialRoute - Initial route (default: '/')
 * @param {Object} options.authValue - Initial auth state for testing (optional)
 * @returns {Object} RTL render result
 */
export function renderApp(options = {}) {
  const { initialRoute = '/', authValue = null, ...rest } = options;

  // Import all pages (done here to avoid circular imports)
  const LoginPage = require('../../../pages/LoginPage').default;
  const RegisterPage = require('../../../pages/RegisterPage').default;
  const DashboardPage = require('../../../pages/DashboardPage').default;
  const TasksPage = require('../../../pages/TasksPage').default;
  const CategoriesPage = require('../../../pages/CategoriesPage').default;
  const StatisticsPage = require('../../../pages/StatisticsPage').default;
  const ProfilePage = require('../../../pages/ProfilePage').default;
  const NotFoundPage = require('../../../pages/NotFoundPage').default;
  const ProtectedRoute = require('../../../components/auth/ProtectedRoute').default;
  const Layout = require('../../../components/layout/Layout').default;

  const AppRoutes = () => (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <DashboardPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/tasks" element={
        <ProtectedRoute>
          <Layout>
            <TasksPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/categories" element={
        <ProtectedRoute>
          <Layout>
            <CategoriesPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/statistics" element={
        <ProtectedRoute>
          <Layout>
            <StatisticsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout>
            <ProfilePage />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />

      {/* 404 Page */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

  return renderWithProviders(<AppRoutes />, { initialRoute, authValue, ...rest });
}

// Re-export everything from React Testing Library for convenience
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
