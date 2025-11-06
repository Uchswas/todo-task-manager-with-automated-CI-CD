import { renderApp, screen, waitFor, userEvent } from '../helpers/test-utils';
import { createMockUser } from '../helpers/mock-data';

describe('Profile Page Integration', () => {
  test('updates profile information and reflects changes in the header', async () => {
    // Arrange: authenticate as a user whose profile details will be updated during the test.
    const authUser = createMockUser({ name: 'Taylor Swift', email: 'taylor@example.com' });

    renderApp({
      initialRoute: '/profile',
      authValue: { user: authUser, token: 'token-123' },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /profile settings/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Taylor Swift/i).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'Taylor Alison Swift');
    await user.clear(emailInput);
    await user.type(emailInput, 'taylor.alison@example.com');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/Taylor Alison Swift/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });
  });

  test('shows validation errors for invalid inputs', async () => {
    const authUser = createMockUser({ name: 'Invalid Tester', email: 'invalid@example.com' });

    renderApp({
      initialRoute: '/profile',
      authValue: { user: authUser, token: 'token-123' },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /profile settings/i })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'A');
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Form validation should surface both custom name rules and email format guidance.
    expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });
});
