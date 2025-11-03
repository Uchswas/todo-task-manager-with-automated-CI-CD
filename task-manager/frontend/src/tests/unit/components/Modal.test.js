import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../../../components/common/Modal';

// Exercises the modal to confirm open/close flows, sizing, and accessibility wiring.

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>
  };

  beforeEach(() => {
    // Clear mock state and ensure document styles start from a known baseline.
    jest.clearAllMocks();
    // Reset body overflow style to its default between test runs.
    document.body.style.overflow = 'unset';
  });

  test('renders nothing when closed', () => {
    // Rendering with isOpen set to false should keep modal markup unmounted.
    render(<Modal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  test('renders modal when open', () => {
    // When open, the title and content should be visible on screen.
    render(<Modal {...defaultProps} />);

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  test('renders without title when not provided', () => {
    // Omitting the title should remove the header while keeping content.
    render(<Modal {...defaultProps} title={undefined} />);

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  test('calls onClose when close button clicked', () => {
    const mockClose = jest.fn();
    // Clicking the close button should invoke the provided handler.
    render(<Modal {...defaultProps} onClose={mockClose} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when background overlay clicked', () => {
    const mockClose = jest.fn();
    // The backdrop click should also trigger onClose for accessibility.
    render(<Modal {...defaultProps} onClose={mockClose} />);

    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when Escape key pressed', () => {
    const mockClose = jest.fn();
    // Pressing Escape should close the modal via the keydown listener.
    render(<Modal {...defaultProps} onClose={mockClose} />);

    fireEvent.keyDown(document, { keyCode: 27 }); // Escape key
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('does not render close button when showCloseButton is false', () => {
    // Disabling the close button should remove it from the header entirely.
    render(<Modal {...defaultProps} showCloseButton={false} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('applies correct size classes', () => {
    // Verify each size preset maps to the expected max-width utility.
    const { rerender } = render(<Modal {...defaultProps} size="sm" />);

    let modalPanel = screen.getByTestId('modal-panel');
    expect(modalPanel).toHaveClass('max-w-sm');

    rerender(<Modal {...defaultProps} size="lg" />);
    modalPanel = screen.getByTestId('modal-panel');
    expect(modalPanel).toHaveClass('max-w-lg');

    rerender(<Modal {...defaultProps} size="xl" />);
    modalPanel = screen.getByTestId('modal-panel');
    expect(modalPanel).toHaveClass('max-w-xl');

    rerender(<Modal {...defaultProps} size="2xl" />);
    modalPanel = screen.getByTestId('modal-panel');
    expect(modalPanel).toHaveClass('max-w-2xl');
  });

  test('applies default medium size when size not specified', () => {
    // Without a size prop the modal should default to the medium width.
    render(<Modal {...defaultProps} />);

    const modalPanel = screen.getByTestId('modal-panel');
    expect(modalPanel).toHaveClass('max-w-md');
  });

  test('sets body overflow to hidden when modal opens', () => {
    // Opening the modal should lock document scrolling.
    render(<Modal {...defaultProps} />);

    expect(document.body.style.overflow).toBe('hidden');
  });

  test('restores body overflow when modal closes', () => {
    // Confirm body overflow resets once the modal unmounts.
    const { rerender } = render(<Modal {...defaultProps} />);

    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Modal {...defaultProps} isOpen={false} />);

    expect(document.body.style.overflow).toBe('unset');
  });

  test('renders header with title and close button by default', () => {
    // Title-present modals should render the header block and close button.
    render(<Modal {...defaultProps} />);

    const header = screen.getByTestId('modal-header');
    expect(header).toHaveClass('px-6', 'py-4', 'border-b', 'border-gray-200');

    // The close button should be available so users can dismiss the modal.
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('does not render header when no title and showCloseButton is false', () => {
    // Without a title or close button the header slot should be omitted.
    render(<Modal {...defaultProps} title={undefined} showCloseButton={false} />);

    expect(screen.getByText('Modal content')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders content with correct styling', () => {
    // Ensure the modal body retains its padding utilities.
    render(<Modal {...defaultProps} />);

    const content = screen.getByTestId('modal-content');
    expect(content).toHaveClass('px-6', 'py-4');
  });

  test('has correct accessibility attributes', () => {
    // The overlay should expose expected backdrop semantics and labelling.
    render(<Modal {...defaultProps} />);

    const overlay = screen.getByTestId('modal-overlay');
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-gray-500', 'bg-opacity-75');
    expect(overlay).toHaveAttribute('aria-label', 'Close modal');
  });

  test('cleanup removes event listeners when unmounted', () => {
    // Unmounting should remove the keydown listener and restore body styles.
    const { unmount } = render(<Modal {...defaultProps} />);

    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(document.body.style.overflow).toBe('unset');

    removeEventListenerSpy.mockRestore();
  });
});
