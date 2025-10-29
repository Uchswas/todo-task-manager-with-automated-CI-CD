import React from 'react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to perform this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmStyle = 'danger',
  loading = false
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const getConfirmButtonClass = () => {
    switch (confirmStyle) {
    case 'danger':
      return 'bg-red-600 hover:bg-red-700 text-white';
    case 'warning':
      return 'bg-yellow-600 hover:bg-yellow-700 text-white';
    case 'primary':
      return 'bg-blue-600 hover:bg-blue-700 text-white';
    default:
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-gray-600">
          {message}
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonClass()}`}
          >
            {loading ? (
              <div className="flex items-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Processing...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;