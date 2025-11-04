import {
  formatDate, formatDateTime, formatRelativeTime,
  isOverdue, isDueToday, isDueSoon,
  getPriorityColor, getPriorityBadgeColor, getStatusColor,
  truncateText, capitalizeFirst, getInitials,
  generateRandomColor
} from '../../../utils/helpers';

describe('Date Formatting', () => {
  test('formatDate formats date string correctly', () => {
    // Render Christmas Day and confirm the helper formats it into a human-friendly month string.
    const dateString = '2024-12-25T10:30:00Z';
    const formatted = formatDate(dateString);
    
    // The result should contain the expected month, day, and year.
    expect(formatted).toMatch(/Dec 25, 2024/);
  });

  test('formatDate handles empty input', () => {
    // Passing empty or nullish values should return an empty string without throwing.
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  test('formatDateTime includes time', () => {
    // Format a timestamp and ensure both date and time components are included.
    const dateString = '2024-12-25T15:30:00Z';
    const formatted = formatDateTime(dateString);

    // The literal date should be present regardless of timezone.
    expect(formatted).toMatch(/Dec 25, 2024/);
    // The formatted string should also include a clock portion.
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  test('formatRelativeTime shows relative time correctly', () => {
    // Capture the current moment so we can derive relative offsets.
    const now = new Date();
    
    // Offset the timestamp by thirty seconds so it should fall into the “Just now” bucket.
    const recent = new Date(now.getTime() - 30000);
    expect(formatRelativeTime(recent.toISOString())).toBe('Just now');
    
    // Shift the timestamp five minutes back to trigger minute-level formatting.
    const minutes = new Date(now.getTime() - 300000);
    expect(formatRelativeTime(minutes.toISOString())).toMatch(/5 minutes ago/);
    
    // Backdate the timestamp by two hours so the helper rolls up to hours.
    const hours = new Date(now.getTime() - 7200000);
    expect(formatRelativeTime(hours.toISOString())).toMatch(/2 hours ago/);
  });
});

describe('Date Status Checking', () => {
  test('isOverdue detects overdue dates', () => {
    // Move the date back one day so it is clearly overdue.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Overdue dates should return true while nullish values return false.
    expect(isOverdue(yesterday.toISOString())).toBe(true);
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue('')).toBe(false);
  });

  test('isDueToday detects today dates', () => {
    // Supply today's date which should flag as due.
    const today = new Date();
    expect(isDueToday(today.toISOString())).toBe(true);
    
    // Move a day backward to confirm non-today values return false.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isDueToday(yesterday.toISOString())).toBe(false);
  });

  test('isDueSoon detects dates within specified days', () => {
    // Create dates both inside and outside the soon threshold.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    // Dates within the window should return true, others should be false.
    expect(isDueSoon(tomorrow.toISOString(), 3)).toBe(true);
    expect(isDueSoon(nextWeek.toISOString(), 3)).toBe(false);
    expect(isDueSoon(null)).toBe(false);
  });
});

describe('Color Utilities', () => {
  test('getPriorityColor returns correct classes', () => {
    // Validate the color classes returned for each priority bucket.
    expect(getPriorityColor('high')).toContain('text-red-600');
    expect(getPriorityColor('medium')).toContain('text-yellow-600');
    expect(getPriorityColor('low')).toContain('text-green-600');
    expect(getPriorityColor('invalid')).toContain('text-gray-600');
  });

  test('getPriorityBadgeColor returns correct classes', () => {
    // Badge variants should map to matching background utilities.
    expect(getPriorityBadgeColor('high')).toContain('bg-red-100');
    expect(getPriorityBadgeColor('medium')).toContain('bg-yellow-100');
    expect(getPriorityBadgeColor('low')).toContain('bg-green-100');
    expect(getPriorityBadgeColor('invalid')).toContain('bg-gray-100');
  });

  test('getStatusColor returns correct classes for completion status', () => {
    // Completed tasks highlight green while pending tasks highlight blue.
    expect(getStatusColor(true)).toContain('text-green-600');
    expect(getStatusColor(false)).toContain('text-blue-600');
  });

  test('generateRandomColor returns valid hex color', () => {
    // The generator should always return a valid six-digit hex string.
    const color = generateRandomColor();
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('Text Utilities', () => {
  test('truncateText truncates long text', () => {
    // Provide a long string and confirm it truncates with ellipsis.
    const longText = 'This is a very long text that should be truncated';
    const truncated = truncateText(longText, 20);

    // The length should account for the ellipsis suffix.
    // The output should include three extra characters to account for the ellipsis.
    expect(truncated).toHaveLength(23);
    expect(truncated).toMatch(/\.\.\.$/);
  });

  test('truncateText leaves short text unchanged', () => {
    // Shorter strings should not be modified.
    const shortText = 'Short text';
    const result = truncateText(shortText, 20);
    
    expect(result).toBe(shortText);
  });

  test('truncateText handles empty input', () => {
    // Empty or nullish values should produce an empty string.
    expect(truncateText('')).toBe('');
    expect(truncateText(null)).toBe('');
    expect(truncateText(undefined)).toBe('');
  });

  test('capitalizeFirst capitalizes first letter', () => {
    // Verify various strings where only the first character should change.
    expect(capitalizeFirst('hello world')).toBe('Hello world');
    expect(capitalizeFirst('test')).toBe('Test');
    expect(capitalizeFirst('')).toBe('');
    expect(capitalizeFirst(null)).toBe('');
  });

  test('getInitials extracts initials from name', () => {
    // Full names and single-word names should return the expected initials.
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice')).toBe('A');
    expect(getInitials('Bob Smith-Jones')).toBe('BS');
    expect(getInitials('')).toBe('');
    expect(getInitials(null)).toBe('');
  });

  test('getInitials limits to 2 characters', () => {
    // Longer names should still only return the first two initials.
    expect(getInitials('John Michael Smith')).toBe('JM');
  });
});

describe('File Utilities', () => {
  let mockLink;

  beforeEach(() => {
    // Mock URL helpers so blob URLs can be generated without the browser runtime.
    global.URL.createObjectURL = jest.fn(() => 'mocked-url');
    global.URL.revokeObjectURL = jest.fn();

    // Create a fresh mock anchor for each test to simulate download links.
    mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    };

    // Replace DOM element creation so we can observe append/remove cycles.
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore any spies or mocks created during setup.
    jest.restoreAllMocks();
  });

  test('downloadJSON creates and triggers download', () => {
    // Require lazily to avoid hoisting issues with jest.mock.
    const { downloadJSON } = require('../../../utils/helpers');
    
    // Provide sample data and desired filename for the download.
    const testData = { name: 'test', value: 123 };
    const filename = 'test.json';
    
    downloadJSON(testData, filename);
    
    // Ensure the helper builds, clicks, and cleans up the synthetic anchor element.
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLink.download).toBe(filename);
    expect(mockLink.click).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
    expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
  });

  test('exportToCSV handles empty data', () => {
    // Require lazily so shared mocks remain intact.
    const { exportToCSV } = require('../../../utils/helpers');
    
    // Invoke the helper with empty datasets which should no-op.
    exportToCSV([], 'test.csv');
    exportToCSV(null, 'test.csv');
    
    // No DOM nodes should be created when there is nothing to export.
    expect(document.createElement).not.toHaveBeenCalled();
  });

  test('exportToCSV creates CSV content', () => {
    // Require lazily for the same reason as above.
    const { exportToCSV } = require('../../../utils/helpers');
    
    // Provide data rows so the helper generates a downloadable CSV.
    const testData = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Los Angeles' }
    ];
    
    exportToCSV(testData, 'test.csv');
    
    // A link should be created, configured, and clicked to trigger the download.
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLink.download).toBe('test.csv');
    expect(mockLink.click).toHaveBeenCalled();
  });
});

describe('Debounce Utility', () => {
  jest.useFakeTimers();

  test('debounce delays function execution', () => {
    // Debounce a mock function to ensure it waits for the timeout.
    const { debounce } = require('../../../utils/helpers');
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);
    
    // Call the debounced version; the underlying function should not fire immediately.
    debouncedFn('test');
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance timers to trigger the pending invocation.
    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  test('debounce cancels previous calls', () => {
    // Rapidly call a debounced function to ensure only the last call executes.
    const { debounce } = require('../../../utils/helpers');
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);
    
    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');
    
    // Move time forward and confirm the trailing call is the only one delivered.
    jest.advanceTimersByTime(1000);
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('third');
  });

  afterEach(() => {
    // Clear pending timers so tests remain isolated.
    jest.clearAllTimers();
  });
});
