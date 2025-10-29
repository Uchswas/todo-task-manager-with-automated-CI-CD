export const getToken = () => {
  return localStorage.getItem('token');
};

export const setToken = (token) => {
  localStorage.setItem('token', token);
};

export const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getUser = () => {
  const userStr = localStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

export const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const isAuthenticated = () => {
  const token = getToken();
  const user = getUser();
  return !!(token && user);
};

export const logout = () => {
  removeToken();
  window.location.href = '/login';
};

export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // More strict email validation: no consecutive dots, no dots at start/end of local or domain parts
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  // Check for consecutive dots
  if (email.includes('..')) {
    return false;
  }
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return errors;
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return errors;
};

export const validateName = (name) => {
  const errors = [];
  
  if (!name || !name.trim()) {
    errors.push('Name is required');
    return errors;
  }
  
  if (name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (name.trim().length > 100) {
    errors.push('Name must be less than 100 characters');
  }
  
  return errors;
};