export const formatDate = (dateString) => {
  if (!dateString) return '';

  // Handle date-only strings (YYYY-MM-DD) by parsing them as local dates
  const date = dateString.includes('T')
    ? new Date(dateString)
    : new Date(dateString + 'T00:00:00');

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  return formatDate(dateString);
};

const normalizeToLocalDate = (dateString) => {
  if (!dateString) return null;

  if (!dateString.includes('T')) {
    const [year, month, day] = dateString.split('-').map(Number);
    if ([year, month, day].some(Number.isNaN)) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const isOverdue = (dueDateString) => {
  if (!dueDateString) return false;
  
  const dueDate = normalizeToLocalDate(dueDateString);
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return dueDate < today;
};

export const isDueToday = (dueDateString) => {
  if (!dueDateString) return false;
  
  const dueDate = normalizeToLocalDate(dueDateString);
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return dueDate.getTime() === today.getTime();
};

export const isDueSoon = (dueDateString, days = 3) => {
  if (!dueDateString) return false;
  
  const dueDate = normalizeToLocalDate(dueDateString);
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureDays = new Date(today);
  futureDays.setDate(today.getDate() + days);
  
  return dueDate >= today && dueDate <= futureDays;
};

export const getPriorityColor = (priority) => {
  switch (priority) {
  case 'high':
    return 'text-red-600 bg-red-50 border-red-200';
  case 'medium':
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  case 'low':
    return 'text-green-600 bg-green-50 border-green-200';
  default:
    return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getPriorityBadgeColor = (priority) => {
  switch (priority) {
  case 'high':
    return 'bg-red-100 text-red-800';
  case 'medium':
    return 'bg-yellow-100 text-yellow-800';
  case 'low':
    return 'bg-green-100 text-green-800';
  default:
    return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusColor = (isCompleted) => {
  return isCompleted 
    ? 'text-green-600 bg-green-50 border-green-200'
    : 'text-blue-600 bg-blue-50 border-blue-200';
};

export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

export const generateRandomColor = () => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
    '#EC4899', '#6366F1', '#14B8A6', '#F43F5E'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const downloadJSON = (data, filename) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};
