import { renderApp, screen, waitFor, within, userEvent } from '../helpers/test-utils';
import { setMockTasks, setMockCategories } from '../helpers/api-mocks';
import {
  createMockTask,
  createMockCompletedTask,
  createMockOverdueTask,
  createMockCategory,
  createMockUser,
} from '../helpers/mock-data';

describe('Dashboard Page Integration', () => {
  test('displays personalised stats and recent tasks with live data', async () => {
    // Arrange: create categories and tasks that cover each dashboard summary state.
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0); // Normalise to midnight so "due today" comparisons remain stable.

    const workCategory = createMockCategory({ name: 'Work', color: '#3B82F6' });
    const personalCategory = createMockCategory({ name: 'Personal', color: '#10B981' });

    setMockCategories([workCategory, personalCategory]);

    // Provide tasks that cover each of the dashboard summary scenarios (due today, completed, overdue).
    setMockTasks([
      createMockTask({
        title: 'Prepare presentation',
        priority: 'high',
        category_id: workCategory.id,
        due_date: startOfToday.toISOString(),
      }),
      createMockCompletedTask({
        title: 'Submit expense report',
        category_id: workCategory.id,
      }),
      createMockOverdueTask({
        title: 'Book dentist appointment',
        category_id: personalCategory.id,
        priority: 'low',
      }),
      createMockTask({
        title: 'Plan weekend trip',
        category_id: personalCategory.id,
      }),
    ]);

    const authUser = createMockUser({ name: 'Dashboard Tester', email: 'dash@example.com' });

    renderApp({
      initialRoute: '/dashboard',
      authValue: { user: authUser, token: 'token-123' },
    });

    await waitFor(() => {
      expect(screen.getByText(/welcome back, dashboard tester/i)).toBeInTheDocument();
    });

    // Dashboard metrics use definition lists, so locate the cards via their `<dt>` labels.
    const totalTasksLabel = screen.getByText('Total Tasks', { selector: 'dt' });
    const totalTasksCard = totalTasksLabel.closest('div');
    expect(totalTasksCard).toBeTruthy();
    expect(within(totalTasksCard).getByText('4')).toBeInTheDocument();

    const completedLabel = screen.getByText('Completed', { selector: 'dt' });
    const completedCard = completedLabel.closest('div');
    expect(completedCard).toBeTruthy();
    expect(within(completedCard).getByText('1')).toBeInTheDocument();

    const overdueCardLabel = screen.getByText('Overdue', { selector: 'dt' });
    const overdueCard = overdueCardLabel.closest('div');
    expect(overdueCard).toBeTruthy();
    expect(within(overdueCard).getByText('2')).toBeInTheDocument();

    expect(screen.getByText(/Recent Tasks/i)).toBeInTheDocument();
    const prepareTaskMatches = screen.getAllByText(/Prepare presentation/i);
    const weekendTaskMatches = screen.getAllByText(/Plan weekend trip/i);
    expect(prepareTaskMatches.length).toBeGreaterThan(0);
    expect(weekendTaskMatches.length).toBeGreaterThan(0);

    const user = userEvent.setup();
    // Multiple cards expose a "View All" link; pick the first which points to the tasks page.
    const viewAllLinks = screen.getAllByRole('link', { name: /view all/i });
    await user.click(viewAllLinks[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
    });
  });
});
