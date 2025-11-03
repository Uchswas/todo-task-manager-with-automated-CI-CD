import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../hooks/useAuth';
import * as authUtils from '../../../utils/auth';
import * as api from '../../../utils/api';

// Covers control flow and edge cases for the authentication hook.

// Mock the utils and API modules so we can fully control their behaviour in each test.
jest.mock('../../../utils/auth');
jest.mock('../../../utils/api');

// Provide a deterministic mock for localStorage interactions.
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
global.localStorage = localStorageMock;

describe('useAuth Hook', () => {
  // Render hook consumers inside the provider so context is available.
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations ensure the hook starts unauthenticated unless a test overrides them.
    authUtils.getToken.mockReturnValue(null);
    authUtils.getUser.mockReturnValue(null);
    authUtils.setToken.mockImplementation(() => {});
    authUtils.setUser.mockImplementation(() => {});
    authUtils.removeToken.mockImplementation(() => {});
  });

  test('initializes with no user when no stored auth', () => {
    // Render inside the provider to inspect the unauthenticated default state.
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Without stored credentials the hook should report a clean unauthenticated state.
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated()).toBe(false);
  });

  test('initializes with stored user and token', () => {
    // Pretend auth data exists in storage so the hook boots into an authenticated state.
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    const mockToken = 'stored-token';

    authUtils.getToken.mockReturnValue(mockToken);
    authUtils.getUser.mockReturnValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // With both pieces of auth data present the hook should hydrate to a logged-in state.
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.isAuthenticated()).toBe(true);
  });

  test('login success updates state and stores auth data', async () => {
    // Mock a successful login response to ensure state and storage update.
    const mockResponse = {
      data: {
        user: { id: 1, name: 'Test User', email: 'test@example.com' },
        access_token: 'new-token'
      }
    };

    api.authAPI.login.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Trigger the login call and capture its return payload.
    let loginResult;
    await act(async () => {
      loginResult = await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // Successful login should return data and persist the token/user combo.
    expect(loginResult.success).toBe(true);
    expect(loginResult.user).toEqual(mockResponse.data.user);
    expect(authUtils.setToken).toHaveBeenCalledWith('new-token');
    expect(authUtils.setUser).toHaveBeenCalledWith(mockResponse.data.user);
  });

  test('login failure returns error', async () => {
    // Force the login endpoint to reject so we can surface its error details.
    const mockError = {
      response: {
        data: {
          error: 'Invalid credentials'
        }
      }
    };

    api.authAPI.login.mockRejectedValue(mockError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt the login with bad credentials to receive the failed result.
    let loginResult;
    await act(async () => {
      loginResult = await result.current.login({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      });
    });

    // The helper should surface the backend error when login fails.
    expect(loginResult.success).toBe(false);
    expect(loginResult.error).toBe('Invalid credentials');
  });

  test('register success updates state and stores auth data', async () => {
    // Mock the register endpoint so we can confirm new credentials persist correctly.
    const mockResponse = {
      data: {
        user: { id: 1, name: 'New User', email: 'new@example.com' },
        access_token: 'register-token'
      }
    };

    api.authAPI.register.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Call register and check what the hook returns.
    let registerResult;
    await act(async () => {
      registerResult = await result.current.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123'
      });
    });

    // Registration should mirror login by returning data and storing it.
    expect(registerResult.success).toBe(true);
    expect(registerResult.user).toEqual(mockResponse.data.user);
    expect(authUtils.setToken).toHaveBeenCalledWith('register-token');
    expect(authUtils.setUser).toHaveBeenCalledWith(mockResponse.data.user);
  });

  test('register failure returns error and details', async () => {
    // Return validation errors from register to see how they propagate through the hook.
    const mockError = {
      response: {
        data: {
          error: 'Validation failed',
          details: ['Email already exists', 'Password too weak']
        }
      }
    };

    api.authAPI.register.mockRejectedValue(mockError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt to register with invalid data to surface the mocked error response.
    let registerResult;
    await act(async () => {
      registerResult = await result.current.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak'
      });
    });

    // When registration fails the hook should expose both the message and detail list.
    expect(registerResult.success).toBe(false);
    expect(registerResult.error).toBe('Validation failed');
    expect(registerResult.details).toEqual(['Email already exists', 'Password too weak']);
  });

  test('logout clears state and calls API', async () => {
    // Preload tokens and user data so logout has something to clear.
    const mockUser = { id: 1, name: 'Test User' };
    authUtils.getToken.mockReturnValue('token');
    authUtils.getUser.mockReturnValue(mockUser);

    api.authAPI.logout.mockResolvedValue({});

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Invoke logout and await completion.
    await act(async () => {
      await result.current.logout();
    });

    // A successful logout should call the API, clear storage, and reset state.
    expect(api.authAPI.logout).toHaveBeenCalled();
    expect(authUtils.removeToken).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  test('logout clears state even if API call fails', async () => {
    // Even if the API rejects, the hook should still drop local credentials.
    const mockUser = { id: 1, name: 'Test User' };
    authUtils.getToken.mockReturnValue('token');
    authUtils.getUser.mockReturnValue(mockUser);

    api.authAPI.logout.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Call logout and swallow the promise rejection.
    await act(async () => {
      await result.current.logout();
    });

    // Even when the API rejects we still expect local credentials to be cleared.
    expect(authUtils.removeToken).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  test('updateProfile success updates user state', async () => {
    // Seed the hook with an existing user then simulate a successful update.
    const initialUser = { id: 1, name: 'Old Name', email: 'old@example.com' };
    const updatedUser = { id: 1, name: 'New Name', email: 'new@example.com' };

    authUtils.getToken.mockReturnValue('token');
    authUtils.getUser.mockReturnValue(initialUser);

    const mockResponse = {
      data: {
        user: updatedUser
      }
    };

    api.authAPI.updateProfile.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Call updateProfile and store the result to inspect.
    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateProfile({
        name: 'New Name',
        email: 'new@example.com'
      });
    });

    // Successful updates should reflect in state and propagate to the storage helper.
    expect(updateResult.success).toBe(true);
    expect(updateResult.user).toEqual(updatedUser);
    expect(authUtils.setUser).toHaveBeenCalledWith(updatedUser);
  });

  test('updateProfile failure returns error', async () => {
    // Surface a validation error from updateProfile to ensure it's passed through.
    const mockError = {
      response: {
        data: {
          error: 'Email already taken'
        }
      }
    };

    api.authAPI.updateProfile.mockRejectedValue(mockError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt the update with mocked failure to capture the error payload.
    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateProfile({
        email: 'taken@example.com'
      });
    });

    // The hook should bubble up the validation failure message.
    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toBe('Email already taken');
  });

  test('refreshProfile success updates user state', async () => {
    // Mock getProfile so refresh pulls down a new user snapshot.
    const refreshedUser = { id: 1, name: 'Refreshed User', email: 'refresh@example.com' };

    const mockResponse = {
      data: {
        user: refreshedUser
      }
    };

    api.authAPI.getProfile.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Invoke refreshProfile and gather its result.
    let refreshResult;
    await act(async () => {
      refreshResult = await result.current.refreshProfile();
    });

    // The refreshed profile should be returned and cached for future reads.
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.user).toEqual(refreshedUser);
    expect(authUtils.setUser).toHaveBeenCalledWith(refreshedUser);
  });

  test('refreshProfile failure returns error', async () => {
    // Have getProfile throw to verify the hook returns a friendly error message.
    api.authAPI.getProfile.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Run refreshProfile to see how the rejection is surfaced.
    let refreshResult;
    await act(async () => {
      refreshResult = await result.current.refreshProfile();
    });

    // Failures should bubble up a clear error object to the caller.
    expect(refreshResult.success).toBe(false);
    expect(refreshResult.error).toBe('Failed to refresh profile');
  });

  test('isAuthenticated returns correct boolean', async () => {
    // Inspect how isAuthenticated flips after a successful login.
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Before logging in the helper should report an unauthenticated state.
    expect(result.current.isAuthenticated()).toBe(false);

    // Mock a successful login so the helper can transition to true.
    const mockResponse = {
      data: {
        user: { id: 1, name: 'Test User' },
        access_token: 'test-token'
      }
    };

    api.authAPI.login.mockResolvedValue(mockResponse);

    // Perform a login so the helper should start returning true.
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    // After login the helper should now report that the user is authenticated.
    expect(result.current.isAuthenticated()).toBe(true);
  });

  test('throws error when used outside AuthProvider', () => {
    // Suppress console.error for this test to avoid noisy output.
    const originalError = console.error;
    console.error = jest.fn();

    // Calling the hook without its provider should throw a helpful error.
    expect(() => {
      renderHook(() => useAuth()); // No wrapper
    }).toThrow('useAuth must be used within an AuthProvider');

    console.error = originalError;
  });
});
