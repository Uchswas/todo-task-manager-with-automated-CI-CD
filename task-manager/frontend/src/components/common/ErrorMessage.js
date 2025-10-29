import React from 'react';

const ErrorMessage = ({ message, details = [], onRetry, className = '' }) => {
  if (!message) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`} data-testid="error-message">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            data-testid="error-icon"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Error
          </h3>
          <p className="mt-1 text-sm text-red-700">
            {message}
          </p>
          {details.length > 0 && (
            <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className="text-sm text-red-600 hover:text-red-500 font-medium"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;