import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';
import { getToken, setToken, removeToken, getUser, setUser } from '../utils/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState(null);

  useEffect(() => {
    const initAuth = () => {
      const savedToken = getToken();
      const savedUser = getUser();
      
      if (savedToken && savedUser) {
        setTokenState(savedToken);
        setUserState(savedUser);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { user: userData, access_token } = response.data;
      
      setToken(access_token);
      setUser(userData);
      setTokenState(access_token);
      setUserState(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      const { user: newUser, access_token } = response.data;
      
      setToken(access_token);
      setUser(newUser);
      setTokenState(access_token);
      setUserState(newUser);
      
      return { success: true, user: newUser };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      const errorDetails = error.response?.data?.details || [];
      return { success: false, error: errorMessage, details: errorDetails };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      removeToken();
      setTokenState(null);
      setUserState(null);
    }
  };

  const updateProfile = async (updatedData) => {
    try {
      const response = await authAPI.updateProfile(updatedData);
      const { user: updatedUser } = response.data;
      
      setUser(updatedUser);
      setUserState(updatedUser);
      
      return { success: true, user: updatedUser };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Profile update failed';
      return { success: false, error: errorMessage };
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      const { user: userData } = response.data;
      
      setUser(userData);
      setUserState(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      return { success: false, error: 'Failed to refresh profile' };
    }
  };

  const isAuthenticated = () => {
    return !!(token && user);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateProfile,
    refreshProfile,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};