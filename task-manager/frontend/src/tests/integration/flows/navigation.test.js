import { renderApp, screen, waitFor, userEvent, within } from '../helpers/test-utils';
import { setMockTasks, setMockCategories } from '../helpers/api-mocks';
import {
  createMockTask,
  createMockCategory,
  createMockUser,
} from '../helpers/mock-data';

const authUser = createMockUser({ name: 'Navigator', email: 'nav@example.com' });

function setupDashboardWithSeedData() {
  // Seed minimal data so each navigation target has recognisable content and avoids empty states.
  setMockCategories([createMockCategory({ name: 'Projects' })]);
  setMockTasks([createMockTask({ title: 'Review PRs' })]);

  renderApp({
    initialRoute: '/dashboard',
    authValue: { user: authUser, token: 'token-123' },
  });

  return userEvent.setup();
}

describe('Navigation Flow Integration', () => {
  test('navigates from dashboard to tasks', async () => {
    const actions = setupDashboardWithSeedData();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Navigator/i)).toBeInTheDocument();
    });

    const desktopTasksLink = screen.getAllByRole('link', { name: /^tasks$/i })[0];
    await actions.click(desktopTasksLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
    });
  });

  test('navigates from tasks to categories', async () => {
    const actions = setupDashboardWithSeedData();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Navigator/i)).toBeInTheDocument();
    });

    const desktopTasksLink = screen.getAllByRole('link', { name: /^tasks$/i })[0];
    await actions.click(desktopTasksLink);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
    });

    const desktopCategoriesLink = screen.getAllByRole('link', { name: /categories/i })[0];
    await actions.click(desktopCategoriesLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
    });
  });

  test('navigates from categories to statistics', async () => {
    const actions = setupDashboardWithSeedData();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Navigator/i)).toBeInTheDocument();
    });

    const desktopTasksLink = screen.getAllByRole('link', { name: /^tasks$/i })[0];
    await actions.click(desktopTasksLink);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
    });

    const desktopCategoriesLink = screen.getAllByRole('link', { name: /categories/i })[0];
    await actions.click(desktopCategoriesLink);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
    });

    const desktopStatisticsLink = screen.getAllByRole('link', { name: /statistics/i })[0];
    await actions.click(desktopStatisticsLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
    });
  });

  test('opens profile settings from header menu', async () => {
    const actions = setupDashboardWithSeedData();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Navigator/i)).toBeInTheDocument();
    });

    await actions.click(screen.getByRole('button', { name: /navigator/i }));
    const dropdown = await screen.findByText(authUser.email);
    const menuContainer = dropdown.closest('div');

    await actions.click(within(menuContainer.parentElement).getByRole('link', { name: /Profile Settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /profile settings/i })).toBeInTheDocument();
    });
  });
});
