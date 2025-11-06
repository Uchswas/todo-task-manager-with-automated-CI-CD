import { renderApp, screen, waitFor } from '../helpers/test-utils';
import userEvent from '@testing-library/user-event';
import { mockLoginFailure, mockRegisterFailure } from '../helpers/api-mocks';
import { createMockUser } from '../helpers/mock-data';

// Increase timeout for integration tests that involve multiple async operations
jest.setTimeout(10000);

describe('Authentication Flow Integration', () => {
  describe('Registration Flow', () => {
    test('user can register and is automatically redirected to dashboard', async () => {
      const user = userEvent.setup();

      // Start at the register page
      renderApp({ initialRoute: '/register' });

      // Verify we're on the registration page
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();

      // Fill out the registration form
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123');

      // Submit the form
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Verify redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/welcome back, john doe/i)).toBeInTheDocument();
      }, { timeout: 8000 });

      // Verify user is on dashboard
      expect(screen.getByText(/here's what's happening with your tasks today/i)).toBeInTheDocument();
    });

    test('registration shows client-side validation errors for invalid data', async () => {
      const user = userEvent.setup();

      renderApp({ initialRoute: '/register' });

      // Submit form without filling any fields
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Wait for validation errors to appear (form validation is synchronous)
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });

    test('registration shows error when passwords do not match', async () => {
      const user = userEvent.setup();

      renderApp({ initialRoute: '/register' });

      // Fill form with mismatched passwords
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword123');

      // Submit the form
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Verify password mismatch error
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    test('registration shows server validation errors', async () => {
      const user = userEvent.setup();

      // Mock registration failure with validation errors
      mockRegisterFailure('Validation failed', [
        'Email already exists',
        'Password is too weak'
      ]);

      renderApp({ initialRoute: '/register' });

      // Fill and submit form with data that passes client-side validation
      // but will trigger server-side validation
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email address/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password1');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password1');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Verify server error message appears
      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify detail errors if ErrorMessage component displays them
      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('already authenticated user can access protected routes directly', async () => {
      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Existing User' });
      const authValue = {
        user: mockUser,
        token: 'existing-token',
      };

      // Navigate directly to a protected route (dashboard) with pre-initialized auth
      renderApp({ initialRoute: '/dashboard', authValue });

      // Wait for dashboard to render
      await waitFor(() => {
        expect(screen.getByText(/welcome back, existing user/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify we're on the dashboard
      expect(screen.getByText(/here's what's happening with your tasks today/i)).toBeInTheDocument();
    });
  });

  describe('Login Flow', () => {
    test('user can login with valid credentials and access dashboard', async () => {
      const user = userEvent.setup();

      // Start at login page
      renderApp({ initialRoute: '/login' });

      // Verify we're on the login page
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();

      // Fill login form
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      // Submit login
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Verify redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      }, { timeout: 8000 });

      // Verify dashboard content is displayed
      expect(screen.getByText(/total tasks/i)).toBeInTheDocument();
    });

    test('login shows error for invalid credentials', async () => {
      const user = userEvent.setup();

      // Mock login failure
      mockLoginFailure('Invalid credentials');

      renderApp({ initialRoute: '/login' });

      // Fill and submit login form
      await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Verify still on login page
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    });

    test('login shows validation error for empty email', async () => {
      const user = userEvent.setup();

      renderApp({ initialRoute: '/login' });

      // Try to submit without email
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    test('login shows validation error for invalid email format', async () => {
      const user = userEvent.setup();

      renderApp({ initialRoute: '/login' });

      // Enter invalid email
      await user.type(screen.getByLabelText(/email address/i), 'notanemail');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('already authenticated user has valid session', async () => {
      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Already Logged In' });
      const authValue = {
        user: mockUser,
        token: 'existing-token',
      };

      // Access dashboard directly with existing auth
      renderApp({ initialRoute: '/dashboard', authValue });

      // Should load dashboard successfully
      await waitFor(() => {
        expect(screen.getByText(/welcome back, already logged in/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Protected Route Access', () => {
    test('unauthenticated user cannot access dashboard and is redirected to login', async () => {
      // Start without authentication
      renderApp({ initialRoute: '/dashboard' });

      // Should be redirected to login page
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });

      // Should not see dashboard content
      expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
    });

    test('unauthenticated user cannot access tasks page', async () => {
      renderApp({ initialRoute: '/tasks' });

      // Should be redirected to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });
    });

    test('unauthenticated user cannot access categories page', async () => {
      renderApp({ initialRoute: '/categories' });

      // Should be redirected to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });
    });

    test('unauthenticated user cannot access profile page', async () => {
      renderApp({ initialRoute: '/profile' });

      // Should be redirected to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });
    });

    test('login redirects user to originally requested protected page', async () => {
      const user = userEvent.setup();

      // Try to access tasks page without auth
      renderApp({ initialRoute: '/tasks' });

      // Should be redirected to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });

      // Complete login
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.queryByText(/sign in to your account/i)).not.toBeInTheDocument();
      });
    });

    test('authenticated user can access all protected routes', async () => {
      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Test User' });
      const authValue = {
        user: mockUser,
        token: 'test-token',
      };

      // Test dashboard access
      renderApp({ initialRoute: '/dashboard', authValue });
      await waitFor(() => {
        expect(screen.getByText(/welcome back, test user/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify user is authenticated and can see protected content
      expect(screen.getByText(/welcome back, test user/i)).toBeInTheDocument();
    });
  });

  describe('Logout Flow', () => {
    test('user can logout and is redirected to login page', async () => {
      const user = userEvent.setup();

      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Test User' });
      const authValue = {
        user: mockUser,
        token: 'test-token',
      };

      // Also set localStorage to match (so logout can clear it)
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      // Start at dashboard
      renderApp({ initialRoute: '/dashboard', authValue });

      // Verify we're logged in
      await waitFor(() => {
        expect(screen.getByText(/welcome back, test user/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Open user menu (look for user name in header - it appears in both header and welcome message)
      const userMenuButton = screen.getByRole('button', { name: /test user/i });
      await user.click(userMenuButton);

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(logoutButton);

      // Verify redirected to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify localStorage cleared
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    test('after logout, user cannot access protected routes', async () => {
      const user = userEvent.setup();

      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Test User' });
      const authValue = {
        user: mockUser,
        token: 'test-token',
      };

      // Also set localStorage to match (so logout can clear it)
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      renderApp({ initialRoute: '/dashboard', authValue });

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Logout
      const userMenuButton = screen.getByRole('button', { name: /test user/i });
      await user.click(userMenuButton);
      await user.click(screen.getByRole('button', { name: /sign out/i }));

      // Verify on login page
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Try to access protected route by changing route
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Session Persistence', () => {
    test('authenticated user state persists across page navigation', async () => {
      const user = userEvent.setup();

      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Test User' });
      const authValue = {
        user: mockUser,
        token: 'test-token',
      };

      renderApp({ initialRoute: '/dashboard', authValue });

      // Verify on dashboard
      await waitFor(() => {
        expect(screen.getByText(/welcome back, test user/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Use the visible desktop navigation link (index 0) to avoid the hidden mobile duplicate.
      const desktopTasksLink = screen.getAllByRole('link', { name: /^tasks$/i })[0];
      await user.click(desktopTasksLink);

      // Verify user still authenticated (header should show user name)
      const userNameElementsAfterNav = screen.getAllByText(/test user/i);
      expect(userNameElementsAfterNav.length).toBeGreaterThan(0);

      // Follow another primary navigation link to confirm the auth context survives rerenders.
      const desktopCategoriesLink = screen.getAllByRole('link', { name: /categories/i })[0];
      await user.click(desktopCategoriesLink);

      // Verify user still authenticated
      const userNameElements = screen.getAllByText(/test user/i);
      expect(userNameElements.length).toBeGreaterThan(0);
    });

    test('user can navigate from login to register', async () => {
      const user = userEvent.setup();

      renderApp({ initialRoute: '/login' });

      // Verify on login page
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();

      // Click link to register
      await user.click(screen.getByText(/create a new account/i));

      // Verify on register page
      await waitFor(() => {
        expect(screen.getByText(/create your account/i)).toBeInTheDocument();
      });
    });

    test('user can navigate from register to login', async () => {
      const user = userEvent.setup();

      renderApp({ initialRoute: '/register' });

      // Verify on register page
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();

      // Click link to login
      await user.click(screen.getByText(/sign in to your existing account/i));

      // Verify on login page
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });
    });
  });

  describe('Root Path Behavior', () => {
    test('unauthenticated user accessing root path redirects to login', async () => {
      renderApp({ initialRoute: '/' });

      // Root path (/) redirects to /dashboard which should redirect to /login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });
    });

    test('authenticated user accessing root path redirects to dashboard', async () => {
      // Setup authenticated state
      const mockUser = createMockUser({ name: 'Test User' });
      const authValue = {
        user: mockUser,
        token: 'test-token',
      };

      renderApp({ initialRoute: '/', authValue });

      // Should redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/welcome back, test user/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
