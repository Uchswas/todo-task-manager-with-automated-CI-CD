import {
  getToken, setToken, removeToken,
  getUser, setUser,
  isAuthenticated, validateEmail,
  validatePassword, validateName
} from '../../utils/auth';

describe('Token Management', () => {
  beforeEach(() => {
    // Reset the mocked storage between tests to avoid cross-test pollution.
    jest.resetAllMocks();
  });

  test('getToken returns token from localStorage', () => {
    // Pretend a token was previously stored so the getter should return it.
    localStorage.getItem.mockReturnValue('test-token');
    
    const token = getToken();
    
    // Confirm we read the correct key and that we surface the stored token.
    expect(localStorage.getItem).toHaveBeenCalledWith('token');
    expect(token).toBe('test-token');
  });

  test('setToken stores token in localStorage', () => {
    // Save a new token so we can confirm it is written to storage.
    setToken('new-token');
    
    // The setter should write the given value under the token key.
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
  });

  test('removeToken clears token and user from localStorage', () => {
    // Invoke the removal helper so both auth artefacts are purged.
    removeToken();
    
    // Ensure both the token and user entries are cleared out.
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });
});

describe('User Management', () => {
  beforeEach(() => {
    // Freshen storage mocks before each scenario.
    jest.resetAllMocks();
  });

  test('getUser returns parsed user from localStorage', () => {
    // Simulate a serialized user stored in localStorage.
    const testUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    localStorage.getItem.mockReturnValue(JSON.stringify(testUser));
    
    const user = getUser();
    
    // The helper should read, parse, and return the stored JSON payload.
    expect(localStorage.getItem).toHaveBeenCalledWith('user');
    expect(user).toEqual(testUser);
  });

  test('getUser returns null for invalid JSON', () => {
    // Provide malformed JSON to ensure the helper fails gracefully.
    localStorage.getItem.mockReturnValue('invalid-json');
    
    const user = getUser();
    
    // Invalid JSON should result in a null return rather than a throw.
    expect(user).toBeNull();
  });

  test('getUser returns null when no user stored', () => {
    // Emulate the absence of user data in storage.
    localStorage.getItem.mockReturnValue(null);
    
    const user = getUser();
    
    // Without stored data the helper should return null.
    expect(user).toBeNull();
  });

  test('setUser stores stringified user in localStorage', () => {
    // Persist a user object so we can verify JSON serialization.
    const testUser = { id: 1, name: 'Test User' };
    
    setUser(testUser);
    
    // The setter should stringify the user before writing to storage.
    expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(testUser));
  });
});

describe('Authentication Status', () => {
  beforeEach(() => {
    // Reset mocks to ensure each auth scenario is independent.
    jest.resetAllMocks();
  });

  test('isAuthenticated returns true when both token and user exist', () => {
    // Provide both a token and user so authentication should succeed.
    localStorage.getItem
      .mockReturnValueOnce('test-token') // for getToken()
      .mockReturnValueOnce('{"id": 1, "name": "Test"}'); // for getUser()
    
    const authenticated = isAuthenticated();
    
    // With both pieces in storage, the helper should return true.
    expect(authenticated).toBe(true);
  });

  test('isAuthenticated returns false when token is missing', () => {
    // Remove the token while leaving the user in place.
    localStorage.getItem
      .mockReturnValueOnce(null) // for getToken()
      .mockReturnValueOnce('{"id": 1, "name": "Test"}'); // for getUser()
    
    const authenticated = isAuthenticated();
    
    // Missing token means the user is not considered authenticated.
    expect(authenticated).toBe(false);
  });

  test('isAuthenticated returns false when user is missing', () => {
    // Provide a token but no user entry.
    localStorage.getItem
      .mockReturnValueOnce('test-token') // for getToken()
      .mockReturnValueOnce(null); // for getUser()
    
    const authenticated = isAuthenticated();
    
    // Without a user profile, authentication should fail.
    expect(authenticated).toBe(false);
  });

  test('isAuthenticated returns false when both are missing', () => {
    // Simulate a completely logged-out state.
    localStorage.getItem.mockReturnValue(null);
    
    const authenticated = isAuthenticated();
    
    // Missing both values must evaluate to false.
    expect(authenticated).toBe(false);
  });
});

describe('Email Validation', () => {
  test('validates correct email formats', () => {
    // Known good addresses should pass validation.
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@test-domain.com'
    ];

    // Each valid sample should be accepted.
    validEmails.forEach(email => {
      expect(validateEmail(email)).toBe(true);
    });
  });

  test('rejects invalid email formats', () => {
    // Include a spread of malformed addresses and edge cases.
    const invalidEmails = [
      'invalid-email',
      '@domain.com',
      'user@',
      'user..name@domain.com',
      'user@domain',
      '',
      null,
      undefined,
      'user name@domain.com'
    ];

    // Every invalid address should be rejected by the validator.
    invalidEmails.forEach(email => {
      expect(validateEmail(email)).toBe(false);
    });
  });
});

describe('Password Validation', () => {
  test('accepts valid passwords', () => {
    // Valid examples include a mix of letters and numbers with sufficient length.
    const validPasswords = [
      'password1',
      'mySecure123',
      'test1234',
      'abcdefgh1'
    ];

    // Each valid password should return no validation errors.
    validPasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors).toHaveLength(0);
    });
  });

  test('rejects passwords that are too short', () => {
    // Provide passwords shorter than the minimum length.
    const shortPasswords = ['short1', '1234567'];

    // Every short password should produce the length error.
    shortPasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors).toContain('Password must be at least 8 characters long');
    });
  });

  test('rejects passwords without numbers', () => {
    // These passwords lack the required numeric character.
    const passwordsWithoutNumbers = ['password', 'abcdefgh'];

    // Validators should flag the missing number requirement.
    passwordsWithoutNumbers.forEach(password => {
      const errors = validatePassword(password);
      expect(errors).toContain('Password must contain at least one number');
    });
  });

  test('handles empty password', () => {
    // An empty string should trigger the required error.
    const errors = validatePassword('');
    expect(errors).toContain('Password is required');
  });

  test('handles null/undefined password', () => {
    // Nullish inputs should return the same required error.
    expect(validatePassword(null)).toContain('Password is required');
    expect(validatePassword(undefined)).toContain('Password is required');
  });
});

describe('Name Validation', () => {
  test('accepts valid names', () => {
    // Legitimate names of different formats should be accepted.
    const validNames = [
      'John Doe',
      'Alice',
      'Bob Smith-Jones',
      'Mary Jane'
    ];

    // Expect zero validation issues for each acceptable name.
    validNames.forEach(name => {
      const errors = validateName(name);
      expect(errors).toHaveLength(0);
    });
  });

  test('rejects names that are too short', () => {
    // Provide a name below the minimum length threshold.
    const shortNames = ['A'];

    // The validator should complain that the name is too short.
    shortNames.forEach(name => {
      const errors = validateName(name);
      expect(errors).toContain('Name must be at least 2 characters long');
    });
  });

  test('rejects empty or whitespace names', () => {
    // Blank strings and whitespace-only values should fail.
    const emptyNames = ['', '   '];

    // Both cases should yield the required-field error.
    emptyNames.forEach(name => {
      const errors = validateName(name);
      expect(errors).toContain('Name is required');
    });
  });

  test('rejects names that are too long', () => {
    // Construct a name that exceeds the maximum allowed length.
    const longName = 'A'.repeat(101);
    const errors = validateName(longName);
    expect(errors).toContain('Name must be less than 100 characters');
  });

  test('handles null/undefined name', () => {
    // Nullish names should still produce the required error message.
    expect(validateName(null)).toContain('Name is required');
    expect(validateName(undefined)).toContain('Name is required');
  });
});
