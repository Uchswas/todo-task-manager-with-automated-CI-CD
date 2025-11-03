import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorMessage from '../../../components/common/ErrorMessage';

// Covers the visual and interactive affordances of the reusable error banner.

describe('ErrorMessage Component', () => {
  test('renders nothing when no message provided', () => {
    // Render without a message to confirm the component stays hidden.
    render(<ErrorMessage />);

    expect(screen.queryByTestId('error-message')).toBeNull();
  });

  test('renders error message', () => {
    // Rendering with a message should display the header and body copy.
    render(<ErrorMessage message="Something went wrong" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('renders error details when provided', () => {
    const details = ['Detail 1', 'Detail 2', 'Detail 3'];
    // Details should appear as individual list entries when supplied.
    render(<ErrorMessage message="Error occurred" details={details} />);

    details.forEach(detail => {
      expect(screen.getByText(detail)).toBeInTheDocument();
    });
  });

  test('renders retry button when onRetry provided', () => {
    const mockRetry = jest.fn();
    // Providing onRetry should render the action button and invoke the callback.
    render(<ErrorMessage message="Error occurred" onRetry={mockRetry} />);

    const retryButton = screen.getByText('Try again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    // Confirm the retry handler fires exactly once when the button is pressed.
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  test('does not render retry button when onRetry not provided', () => {
    // Without onRetry the action button should be omitted entirely.
    render(<ErrorMessage message="Error occurred" />);

    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });

  test('applies custom className', () => {
    // A custom class should be merged onto the root container.
    render(<ErrorMessage message="Error" className="custom-error" />);

    const container = screen.getByTestId('error-message');
    expect(container).toHaveClass('custom-error');
  });

  test('has correct styling classes', () => {
    // Verify the base Tailwind styling remains intact.
    render(<ErrorMessage message="Error occurred" />);

    const container = screen.getByTestId('error-message');
    expect(container).toHaveClass(
      'bg-red-50',
      'border',
      'border-red-200',
      'rounded-lg',
      'p-4'
    );
  });

  test('displays error icon', () => {
    // The inline SVG icon should keep its expected size and color classes.
    render(<ErrorMessage message="Error occurred" />);

    const icon = screen.getByTestId('error-icon');
    expect(icon).toHaveClass('h-5', 'w-5', 'text-red-400');
  });

  test('handles empty details array', () => {
    // An empty details array should avoid rendering an empty list wrapper.
    render(<ErrorMessage message="Error occurred" details={[]} />);

    expect(screen.getByText('Error occurred')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  test('renders details as list items', () => {
    const details = ['First error', 'Second error'];
    // When details exist they should appear as list items for accessibility.
    render(<ErrorMessage message="Multiple errors" details={details} />);

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent('First error');
    expect(listItems[1]).toHaveTextContent('Second error');
  });

  test('retry button has correct styling', () => {
    const mockRetry = jest.fn();
    // Render with retry button to verify the link-style classes.
    render(<ErrorMessage message="Error" onRetry={mockRetry} />);

    const retryButton = screen.getByText('Try again');

    expect(retryButton).toHaveClass(
      'text-sm',
      'text-red-600',
      'hover:text-red-500',
      'font-medium'
    );
  });
});
