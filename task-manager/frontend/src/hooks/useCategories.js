import { useState, useEffect, useCallback } from 'react';
import { categoriesAPI } from '../utils/api';

export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await categoriesAPI.getCategories();
      setCategories(response.data.categories);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = async (categoryData) => {
    try {
      const response = await categoriesAPI.createCategory(categoryData);
      const newCategory = response.data.category;
      
      setCategories(prevCategories => [...prevCategories, newCategory]);
      return { success: true, category: newCategory };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create category';
      const errorDetails = err.response?.data?.details || [];
      return { success: false, error: errorMessage, details: errorDetails };
    }
  };

  const updateCategory = async (categoryId, categoryData) => {
    try {
      const response = await categoriesAPI.updateCategory(categoryId, categoryData);
      const updatedCategory = response.data.category;
      
      setCategories(prevCategories => 
        prevCategories.map(category => 
          category.id === categoryId ? updatedCategory : category
        )
      );
      
      return { success: true, category: updatedCategory };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to update category';
      const errorDetails = err.response?.data?.details || [];
      return { success: false, error: errorMessage, details: errorDetails };
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      await categoriesAPI.deleteCategory(categoryId);

      setCategories(prevCategories =>
        prevCategories.filter(category => category.id !== categoryId)
      );

      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to delete category';
      const errorDetails = err.response?.data?.details;
      return { success: false, error: errorMessage, details: errorDetails };
    }
  };

  const getCategoryById = (categoryId) => {
    return categories.find(category => category.id === categoryId);
  };

  const refreshCategories = () => {
    fetchCategories();
  };

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    refreshCategories,
    setCategories
  };
};

export default useCategories;