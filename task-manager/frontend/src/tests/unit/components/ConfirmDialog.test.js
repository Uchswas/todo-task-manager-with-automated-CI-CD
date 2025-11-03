import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../../../components/common/ConfirmDialog';

// Ensures the confirm dialog surfaces the right copy, styling, and interaction flows.

describe('ConfirmDialog Component', () => {
  // Shared baseline configuration reused across scenarios.
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn()
  };

  beforeEach(() => {
    // Reset spies so call counts remain per-test.
    jest.clearAllMocks();
  });

  test('renders nothing when closed', () => {
    // Render the dialog while closed to confirm no modal content appears.
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  test('renders with default props', () => {
    // Render with baseline props to verify default copy and buttons.
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to perform this action?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('renders with custom title and message', () => {
    // Provide overrides for title/message to ensure they replace defaults.
    render(
      <ConfirmDialog
        {...defaultProps}
        title="Delete Item"
        message="This action cannot be undone"
      />
    );

    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
  });

  test('renders with custom button text', () => {
    // Swap the button labels to confirm custom values render.
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Delete"
        cancelText="Go Back"
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  test('calls onClose when cancel button clicked', () => {
    const mockClose = jest.fn();
    // Render and simulate clicking the cancel button to ensure onClose fires.
    render(<ConfirmDialog {...defaultProps} onClose={mockClose} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('calls onConfirm when confirm button clicked', () => {
    const mockConfirm = jest.fn();
    // Click the confirm button to verify the provided handler is invoked.
    render(<ConfirmDialog {...defaultProps} onConfirm={mockConfirm} />);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  test('applies danger style by default', () => {
    // Default configuration should render the danger (red) variant.
    render(<ConfirmDialog {...defaultProps} />);

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-red-600', 'hover:bg-red-700');
  });

  test('applies warning style when specified', () => {
    // The warning variant should switch to yellow button styles.
    render(<ConfirmDialog {...defaultProps} confirmStyle="warning" />);

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-yellow-600', 'hover:bg-yellow-700');
  });

  test('applies primary style when specified', () => {
    // A primary confirmStyle should use the blue palette instead.
    render(<ConfirmDialog {...defaultProps} confirmStyle="primary" />);

    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
  });

  test('shows loading spinner when loading', () => {
    // When loading, show spinner feedback instead of the regular label.
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('disables buttons when loading', () => {
    // Loading should prevent further interaction with either button.
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    const confirmButton = screen.getByRole('button', { name: /Processing/ });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  test('does not call onConfirm when button is disabled', () => {
    const mockConfirm = jest.fn();
    // Even if clicked while loading, the confirm handler should not fire.
    render(<ConfirmDialog {...defaultProps} onConfirm={mockConfirm} loading={true} />);

    const confirmButton = screen.getByRole('button', { name: /Processing/ });
    fireEvent.click(confirmButton);

    // Because the button remains disabled, the confirm handler must never receive the click.
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test('has correct button styling classes', () => {
    // Ensure the cancel button keeps its neutral styling helpers.
    render(<ConfirmDialog {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toHaveClass(
      'px-4',
      'py-2',
      'text-sm',
      'font-medium',
      'text-gray-700',
      'bg-white',
      'border',
      'border-gray-300',
      'rounded-md'
    );
  });
});
