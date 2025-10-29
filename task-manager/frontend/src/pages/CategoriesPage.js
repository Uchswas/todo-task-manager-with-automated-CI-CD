import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../hooks/useCategories';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ColorPicker = ({ selectedColor, onColorChange }) => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
    '#EC4899', '#6366F1', '#14B8A6', '#F43F5E',
    '#6B7280', '#1F2937', '#991B1B', '#047857'
  ];

  return (
    <div className="grid grid-cols-8 gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onColorChange(color)}
          className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-900' : ''
          }`}
          style={{ backgroundColor: color }}
          title={color}
          aria-label="Select color"
        />
      ))}
    </div>
  );
};

const CategoriesPage = () => {
  const navigate = useNavigate();
  const {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    refreshCategories
  } = useCategories();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6'
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      color: '#3B82F6'
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      color: category.color
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      color: '#3B82F6'
    });
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleColorChange = (color) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    }
    if (formData.name.trim().length > 50) {
      errors.name = 'Category name must be less than 50 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    // Trim whitespace from form data
    const trimmedData = {
      ...formData,
      name: formData.name.trim()
    };

    const result = editingCategory
      ? await updateCategory(editingCategory.id, trimmedData)
      : await createCategory(trimmedData);

    setSubmitting(false);

    if (result.success) {
      closeModal();
    } else {
      setFormErrors({ submit: result.error });
    }
  };

  const handleDeleteClick = (category) => {
    setDeleteConfirm(category);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm) {
      const result = await deleteCategory(deleteConfirm.id);
      if (result.success) {
        setDeleteConfirm(null);
      } else {
        alert(result.error);
      }
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} • Organize your tasks with custom categories
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshCategories}
            className="p-2 text-gray-400 hover:text-gray-600"
            aria-label="Refresh"
            title="Refresh categories"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Category
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && <ErrorMessage message={error} onRetry={refreshCategories} />}

      {/* Categories Grid */}
      <div className="bg-white shadow rounded-lg">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No categories</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first category.</p>
            <div className="mt-6">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Category
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6" role="list">
            {categories.map((category) => (
              <article
                key={category.id}
                className="relative group bg-white border-2 border-gray-200 rounded-lg shadow p-4 hover:shadow-md transition-all"
                style={{ borderColor: category.color }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: category.color }}
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {category.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {category.task_count || 0} tasks
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Created: {formatDate(category.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(category)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edit"
                      aria-label="Edit category"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(category)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
                      aria-label="Delete category"
                      disabled={category.task_count > 0}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* View Tasks Button */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/tasks?category_id=${category.id}`)}
                    disabled={category.task_count === 0}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    View Tasks
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCategory ? 'Edit Category' : 'Create New Category'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`input-field ${formErrors.name ? 'border-red-300' : ''}`}
              placeholder="Category name"
              maxLength={50}
              aria-label="Category name"
            />
            {formErrors.name && (
              <p className="error-message">{formErrors.name}</p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <ColorPicker
              selectedColor={formData.color}
              onColorChange={handleColorChange}
            />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Selected:</span>
              <div
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: formData.color }}
              />
              <span className="text-sm font-mono text-gray-600">{formData.color}</span>
            </div>
          </div>

          {/* Error Message */}
          {formErrors.submit && (
            <ErrorMessage message={formErrors.submit} />
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={`Are you sure you want to delete the category "${deleteConfirm?.name}"? Tasks in this category will become uncategorized.`}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </div>
  );
};

export default CategoriesPage;
