import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Validates the sizing and styling variants for the loading spinner widget.

describe('LoadingSpinner Component', () => {
  test('renders with default props', () => {
    // Default usage should show the medium-sized spinner footprint.
    render(<LoadingSpinner />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('h-8', 'w-8'); // Default medium size
  });

  test('renders with small size', () => {
    // Passing size="sm" should shrink the spinner to the small preset.
    render(<LoadingSpinner size="sm" />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('h-4', 'w-4');
  });

  test('renders with large size', () => {
    // Large variant should use the corresponding larger dimensions.
    render(<LoadingSpinner size="lg" />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('h-12', 'w-12');
  });

  test('renders with extra large size', () => {
    // Extra-large option needs to expand to the biggest size map.
    render(<LoadingSpinner size="xl" />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('h-16', 'w-16');
  });

  test('applies custom className', () => {
    // Custom classes should bubble down to the container wrapper.
    render(<LoadingSpinner className="custom-class" />);

    const container = screen.getByTestId('loading-spinner-container');
    expect(container).toHaveClass('custom-class');
  });

  test('has correct animation classes', () => {
    // Animation and border utility classes should remain intact.
    render(<LoadingSpinner />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('rounded-full');
    expect(spinner).toHaveClass('border-2');
    expect(spinner).toHaveClass('border-gray-300');
    expect(spinner).toHaveClass('border-t-blue-600');
  });

  test('is centered by default', () => {
    // The surrounding div should center the spinner by default.
    render(<LoadingSpinner />);

    const container = screen.getByTestId('loading-spinner-container');
    expect(container).toHaveClass('flex', 'justify-center', 'items-center');
  });
});
