import { renderApp, screen, waitFor, within } from '../helpers/test-utils';
import { setMockTasks, setMockCategories } from '../helpers/api-mocks';
import {
  createMockTask,
  createMockCompletedTask,
  createMockOverdueTask,
  createMockCategory,
  createMockUser,
} from '../helpers/mock-data';

const authUser = createMockUser({ name: 'Analyst', email: 'analyst@example.com' });

/**
 * Render the statistics dashboard with the supplied tasks/categories so each test can
 * focus on asserting analytics output rather than setup concerns.
 */
function setupStatisticsPage(seedTasks = [], seedCategories = []) {
  setMockCategories(seedCategories);
  setMockTasks(seedTasks);

  renderApp({
    initialRoute: '/statistics',
    authValue: { user: authUser, token: 'token-123' },
  });
}

describe('Statistics Page Integration', () => {
  describe('Overview Statistics', () => {
    test('summarises productivity metrics across tasks and categories', async () => {
      // Provide categories and tasks that exercise overdue, completed, and active states
      const work = createMockCategory({ name: 'Work', color: '#3B82F6' });
      const personal = createMockCategory({ name: 'Personal', color: '#10B981' });
      setMockCategories([work, personal]);

      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString();

      setMockTasks([
        createMockTask({
          title: 'Draft quarterly report',
          priority: 'high',
          category_id: work.id,
          created_at: twoDaysAgo,
        }),
        createMockCompletedTask({
          title: 'Team retrospective',
          priority: 'medium',
          category_id: work.id,
          updated_at: twoDaysAgo,
        }),
        createMockOverdueTask({
          title: 'Renew gym membership',
          priority: 'low',
          category_id: personal.id,
          created_at: fiveDaysAgo,
        }),
      ]);

      renderApp({
        initialRoute: '/statistics',
        authValue: { user: authUser, token: 'token-123' },
      });

      // Wait for the statistics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that totals card, priority breakdown, and category summaries surface the expected data
      const totalCard = screen.getByText(/Total Tasks/i).closest('div');
      expect(totalCard).toBeTruthy();
      expect(within(totalCard).getByText('3')).toBeInTheDocument();

      expect(screen.getByText(/Priority Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/High Priority/i)).toBeInTheDocument();
      expect(screen.getByText(/Medium Priority/i)).toBeInTheDocument();

      const workEntries = screen.getAllByRole('heading', { name: /Work/i });
      expect(workEntries.length).toBeGreaterThan(0);
      const personalEntries = screen.getAllByRole('heading', { name: /Personal/i });
      expect(personalEntries.length).toBeGreaterThan(0);

      expect(screen.getByText(/Completion Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    });

    test('displays total tasks count', async () => {
      // Seed a mix of completed and pending tasks
      const tasks = [
        createMockTask({ title: 'Task 1' }),
        createMockTask({ title: 'Task 2' }),
        createMockCompletedTask({ title: 'Task 3' }),
        createMockTask({ title: 'Task 4' }),
        createMockCompletedTask({ title: 'Task 5' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the page to finish loading data
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the total tasks widget shows an aggregate of five
      const totalCard = screen.getByText(/Total Tasks/i).closest('div');
      expect(within(totalCard).getByText('5')).toBeInTheDocument();
    });

    test('displays completed tasks count', async () => {
      // Ensure only two tasks are marked complete
      const tasks = [
        createMockTask({ title: 'Task 1', is_completed: false }),
        createMockCompletedTask({ title: 'Task 2' }),
        createMockCompletedTask({ title: 'Task 3' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the completed card shows the correct total
      const completedCard = screen.getByText('Completed', { selector: 'p' }).closest('div');
      expect(within(completedCard).getByText('2')).toBeInTheDocument();
    });

    test('displays pending tasks count', async () => {
      // Provide three active tasks and one completed to exercise the pending metric
      const tasks = [
        createMockTask({ title: 'Task 1', is_completed: false }),
        createMockTask({ title: 'Task 2', is_completed: false }),
        createMockTask({ title: 'Task 3', is_completed: false }),
        createMockCompletedTask({ title: 'Task 4' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the metrics to populate
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that pending total reflects the three incomplete tasks
      const pendingCard = screen.getByText('Pending', { selector: 'p' }).closest('div');
      expect(within(pendingCard).getByText('3')).toBeInTheDocument();
    });

    test('displays overdue tasks count', async () => {
      // Include two overdue tasks to validate the overdue badge
      const tasks = [
        createMockOverdueTask({ title: 'Overdue 1' }),
        createMockOverdueTask({ title: 'Overdue 2' }),
        createMockTask({ title: 'Not Overdue' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the metrics to populate
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the overdue total reports the two overdue items
      const overdueCard = screen.getByText('Overdue', { selector: 'p' }).closest('div');
      expect(within(overdueCard).getByText('2')).toBeInTheDocument();
    });

    test('calculates completion rate correctly', async () => {
      // Balance completed vs. active tasks to yield a 50% completion rate
      const tasks = [
        createMockCompletedTask({ title: 'Done 1' }),
        createMockCompletedTask({ title: 'Done 2' }),
        createMockTask({ title: 'Not Done 1' }),
        createMockTask({ title: 'Not Done 2' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the metrics to populate
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that completion rate and supporting text match the 2/4 ratio
      expect(screen.getByText(/50%/i)).toBeInTheDocument();
      expect(screen.getByText(/2 \/ 4 tasks/i)).toBeInTheDocument();
    });

    test('displays 0% completion rate when no tasks are completed', async () => {
      // No completed tasks means the completion rate should fall back to zero
      const tasks = [
        createMockTask({ title: 'Task 1' }),
        createMockTask({ title: 'Task 2' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the metrics to populate
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the rate falls back to 0%
      expect(screen.getByText(/0%/i)).toBeInTheDocument();
    });

    test('displays 100% completion rate when all tasks are completed', async () => {
      // Every task is completed to assert the upper bound of the metric
      const tasks = [
        createMockCompletedTask({ title: 'Done 1' }),
        createMockCompletedTask({ title: 'Done 2' }),
        createMockCompletedTask({ title: 'Done 3' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the metrics to populate
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the rate tops out at 100%
      expect(screen.getByText(/100%/i)).toBeInTheDocument();
    });
  });

  describe('Priority Breakdown', () => {
    test('displays priority breakdown with counts', async () => {
      // Include tasks across all priority levels to populate each bar segment
      const tasks = [
        createMockTask({ title: 'High 1', priority: 'high' }),
        createMockTask({ title: 'High 2', priority: 'high' }),
        createMockTask({ title: 'Medium 1', priority: 'medium' }),
        createMockTask({ title: 'Low 1', priority: 'low' }),
        createMockTask({ title: 'Low 2', priority: 'low' }),
        createMockTask({ title: 'Low 3', priority: 'low' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the priority table to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that each label reports the correct count
      const highPriorityRow = screen.getByText('High Priority', { selector: 'span' }).parentElement.parentElement;
      expect(within(highPriorityRow).getByText('2')).toBeInTheDocument();

      const mediumPriorityRow = screen.getByText('Medium Priority', { selector: 'span' }).parentElement.parentElement;
      expect(within(mediumPriorityRow).getByText('1')).toBeInTheDocument();

      const lowPriorityRow = screen.getByText('Low Priority', { selector: 'span' }).parentElement.parentElement;
      expect(within(lowPriorityRow).getByText('3')).toBeInTheDocument();
    });

    test('displays priority breakdown with zero counts', async () => {
      // Only high priority tasks so the remaining buckets show zero counts
      const tasks = [
        createMockTask({ title: 'High 1', priority: 'high' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the priority table to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that medium and low rows display zero
      const highPriorityRow = screen.getByText('High Priority', { selector: 'span' }).parentElement.parentElement;
      expect(within(highPriorityRow).getByText('1')).toBeInTheDocument();

      const mediumPriorityRow = screen.getByText('Medium Priority', { selector: 'span' }).parentElement.parentElement;
      expect(within(mediumPriorityRow).getByText('0')).toBeInTheDocument();

      const lowPriorityRow = screen.getByText('Low Priority', { selector: 'span' }).parentElement.parentElement;
      expect(within(lowPriorityRow).getByText('0')).toBeInTheDocument();
    });

    test('displays priority breakdown visual bars', async () => {
      // Ensuring each priority has a representative task renders all colored bars
      const tasks = [
        createMockTask({ title: 'High 1', priority: 'high' }),
        createMockTask({ title: 'Medium 1', priority: 'medium' }),
        createMockTask({ title: 'Low 1', priority: 'low' }),
      ];
      setupStatisticsPage(tasks);

      // Wait for the breakdown component to mount
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that each priority row has the expected colored progress bar
      const highBar = screen.getByText(/High Priority/i).parentElement.parentElement.querySelector('.bg-red-500');
      const mediumBar = screen.getByText(/Medium Priority/i).parentElement.parentElement.querySelector('.bg-yellow-500');
      const lowBar = screen.getByText(/Low Priority/i).parentElement.parentElement.querySelector('.bg-green-500');

      expect(highBar).toBeInTheDocument();
      expect(mediumBar).toBeInTheDocument();
      expect(lowBar).toBeInTheDocument();
    });
  });

  describe('Category Breakdown', () => {
    test('displays category breakdown with task counts', async () => {
      // Attach tasks to specific categories so the breakdown list populates
      const work = createMockCategory({ name: 'Work', color: '#3B82F6' });
      const personal = createMockCategory({ name: 'Personal', color: '#10B981' });

      const tasks = [
        createMockTask({ title: 'Work 1', category_id: work.id }),
        createMockCompletedTask({ title: 'Work 2', category_id: work.id }),
        createMockTask({ title: 'Personal 1', category_id: personal.id }),
      ];

      setupStatisticsPage(tasks, [work, personal]);

      // Wait for the category section
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that both categories render headings in the breakdown list
      const workCards = screen.getAllByRole('heading', { name: /^Work$/i });
      expect(workCards.length).toBeGreaterThan(0);

      const personalCards = screen.getAllByRole('heading', { name: /^Personal$/i });
      expect(personalCards.length).toBeGreaterThan(0);
    });

    test('displays completed and pending counts for each category', async () => {
      // Mix completed/pending tasks to confirm both counters render
      const work = createMockCategory({ name: 'Work', color: '#3B82F6' });

      const tasks = [
        createMockTask({ title: 'Work Pending 1', category_id: work.id }),
        createMockTask({ title: 'Work Pending 2', category_id: work.id }),
        createMockCompletedTask({ title: 'Work Done', category_id: work.id }),
      ];

      setupStatisticsPage(tasks, [work]);

      // Wait for the category breakdown to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the totals include both pending and completed counts
      const categorySection = screen.getByText(/tasks by category/i).parentElement;
      expect(within(categorySection).getByText('3 tasks')).toBeInTheDocument();
    });

    test('shows empty state when no categories have tasks', async () => {
      // Render the statistics page without any tasks or categories
      setupStatisticsPage([]);

      // Wait for the page layout to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the empty-state guidance is displayed
      expect(screen.getByText(/no categories with tasks yet/i)).toBeInTheDocument();
    });

    test('displays category colors correctly', async () => {
      // Provide a category with a distinct color to confirm the styling is applied
      const work = createMockCategory({ name: 'Work', color: '#3B82F6' });
      const tasks = [createMockTask({ title: 'Work Task', category_id: work.id })];

      setupStatisticsPage(tasks, [work]);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the category card border uses the supplied color
      const categoryCards = screen.getByText(/tasks by category/i).parentElement.querySelectorAll('[style*="border"]');
      expect(categoryCards.length).toBeGreaterThan(0);
    });

    test('handles uncategorized tasks', async () => {
      // Seed a task without a category so the uncategorized bucket is exercised
      const tasks = [
        createMockTask({ title: 'Uncategorized Task', category_id: null }),
      ];

      // Render the statistics page with uncategorized tasks only
      setupStatisticsPage(tasks, []);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the uncategorized bucket appears in the breakdown
      const categorySection = screen.getByText(/tasks by category/i).parentElement;
      expect(within(categorySection).getByText(/Uncategorized/i)).toBeInTheDocument();
    });
  });

  describe('Due Dates Overview', () => {
    test('displays overdue tasks count', async () => {
      // Create overdue tasks to drive the urgent count
      const tasks = [
        createMockOverdueTask({ title: 'Overdue 1' }),
        createMockOverdueTask({ title: 'Overdue 2' }),
      ];

      // Render the statistics page with the overdue sample data
      setupStatisticsPage(tasks);

      // Wait for the due date summary tiles to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the overdue tile reports the correct total and guidance text
      const overdueSection = screen.getByText('Overdue Tasks', { selector: 'p' }).closest('div').parentElement;
      expect(within(overdueSection).getByText('2')).toBeInTheDocument();
      expect(within(overdueSection).getByText(/Need immediate attention/i)).toBeInTheDocument();
    });

    test('displays due today count', async () => {
      // Schedule a task for today so the badge increments
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const tasks = [
        createMockTask({ title: 'Due Today', due_date: today.toISOString() }),
      ];

      // Render the statistics page with a task due today
      setupStatisticsPage(tasks);

      // Wait for summary cards to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the "Due Today" tile reflects the scheduled task
      const dueTodaySection = screen.getByText('Due Today', { selector: 'p' }).closest('div').parentElement;
      expect(within(dueTodaySection).getByText('1')).toBeInTheDocument();
      expect(within(dueTodaySection).getByText(/Complete these today/i)).toBeInTheDocument();
    });

    test('displays due this week count', async () => {
      // Pick a due date later in the same week to populate the "due this week" stat
      const today = new Date();
      // Calculate end of current week (Saturday)
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
      const laterThisWeek = new Date(today);
      laterThisWeek.setDate(today.getDate() + Math.max(1, daysUntilSaturday - 1));
      laterThisWeek.setHours(12, 0, 0, 0);

      const tasks = [
        createMockTask({ title: 'Due This Week 1', due_date: laterThisWeek.toISOString() }),
        createMockTask({ title: 'Due This Week 2', due_date: laterThisWeek.toISOString() }),
      ];

      // Render the statistics page with tasks scheduled later this week
      setupStatisticsPage(tasks);

      // Wait for summary cards to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the "Due This Week" tile counts both tasks
      const dueWeekSection = screen.getByText('Due This Week', { selector: 'p' }).closest('div').parentElement;
      expect(within(dueWeekSection).getByText('2')).toBeInTheDocument();
      expect(within(dueWeekSection).getByText(/Plan ahead/i)).toBeInTheDocument();
    });
  });

  describe('Weekly Trend', () => {
    test('displays weekly completion trend', async () => {
      // Include completions across two weeks so the trend card has comparative data
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 86400000);

      const tasks = [
        createMockCompletedTask({ title: 'Completed This Week', updated_at: now.toISOString() }),
        createMockCompletedTask({ title: 'Completed Last Week', updated_at: lastWeek.toISOString() }),
      ];

      setupStatisticsPage(tasks);

      // Wait for the trend section to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the weekly trend card is present with a "This Week" indicator
      expect(screen.getByRole('heading', { name: /Weekly Completion Trend/i })).toBeInTheDocument();
      const trendSection = screen.getByRole('heading', { name: /Weekly Completion Trend/i }).parentElement;
      expect(within(trendSection).getByText(/This Week/i)).toBeInTheDocument();
    });

    test('displays completion counts for each week', async () => {
      // Multiple completions in the current week should surface count labels
      const now = new Date();

      const tasks = [
        createMockCompletedTask({ title: 'Done 1', updated_at: now.toISOString() }),
        createMockCompletedTask({ title: 'Done 2', updated_at: now.toISOString() }),
      ];

      setupStatisticsPage(tasks);

      // Wait for the trend section to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that each week's completion count renders beneath the progress bar
      const trendSection = screen.getByText(/Weekly Completion Trend/i).parentElement;
      const completedTexts = within(trendSection).getAllByText(/completed/i);
      expect(completedTexts.length).toBeGreaterThan(0);
    });

    test('displays progress bars for weekly trend', async () => {
      // At least one completion ensures a progress bar is rendered for the week
      const now = new Date();

      const tasks = [
        createMockCompletedTask({ title: 'Done', updated_at: now.toISOString() }),
      ];

      setupStatisticsPage(tasks);

      // Wait for the trend section to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the weekly trend card includes progress bars representing the completion volume
      const trendSection = screen.getByText(/Weekly Completion Trend/i).parentElement;
      const progressBars = within(trendSection).getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('Recent Activity', () => {
    test('displays recent completions count', async () => {
      // Mark several tasks as completed within the last seven days
      const recent = new Date();
      const tasks = [
        createMockCompletedTask({ title: 'Recent 1', updated_at: recent.toISOString() }),
        createMockCompletedTask({ title: 'Recent 2', updated_at: recent.toISOString() }),
        createMockCompletedTask({ title: 'Recent 3', updated_at: recent.toISOString() }),
      ];

      setupStatisticsPage(tasks);

      // Wait for the summary widgets to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the recent completions counter reflects the number of recent tasks
      const recentSection = screen.getByText(/Recent Activity/i).parentElement;
      expect(within(recentSection).getByText('3')).toBeInTheDocument();
      expect(within(recentSection).getByText(/Last 7 days/i)).toBeInTheDocument();
    });

    test('displays zero recent completions when no recent activity', async () => {
      // Only include completions older than a week so the counter drops to zero
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);

      const tasks = [
        createMockCompletedTask({ title: 'Old', updated_at: oldDate.toISOString() }),
      ];

      setupStatisticsPage(tasks);

      // Wait for the summary widgets to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the recent completions counter resets to zero
      const recentSection = screen.getByText(/Recent Activity/i).parentElement;
      expect(within(recentSection).getByText('0')).toBeInTheDocument();
    });
  });

  describe('Empty States & Edge Cases', () => {
    test('displays statistics when no tasks exist', async () => {
      // Render the statistics page without supplying any tasks
      setupStatisticsPage([]);

      // Wait for the dashboard heading so metrics are ready
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that totals and completed cards fall back to zero
      const totalCard = screen.getByText(/Total Tasks/i).closest('div');
      expect(within(totalCard).getByText('0')).toBeInTheDocument();

      const completedCard = screen.getByText('Completed', { selector: 'p' }).closest('div');
      expect(within(completedCard).getByText('0')).toBeInTheDocument();
    });

    test('handles tasks without due dates', async () => {
      // Seed a task that omits a due date to ensure metrics handle null values
      const tasks = [
        createMockTask({ title: 'No Due Date', due_date: null }),
      ];

      // Render the statistics page with the undated task
      setupStatisticsPage(tasks);

      // Wait for the dashboard heading so derived metrics are computed
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the overdue tile remains at zero since due date is missing
      const overdueSection = screen.getByText('Overdue Tasks', { selector: 'p' }).closest('div').parentElement;
      expect(within(overdueSection).getByText('0')).toBeInTheDocument();
    });

    test('handles mixed task states correctly', async () => {
      // Create a category so totals can reflect grouped metrics
      const work = createMockCategory({ name: 'Work', color: '#3B82F6' });

      const tasks = [
        createMockTask({ title: 'Active', priority: 'high', category_id: work.id }),
        createMockCompletedTask({ title: 'Done', priority: 'medium', category_id: work.id }),
        createMockOverdueTask({ title: 'Late', priority: 'low', category_id: work.id }),
      ];

      // Render the statistics page with a mix of task states
      setupStatisticsPage(tasks, [work]);

      // Wait for the dashboard heading to confirm data has loaded
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that total, completed, and overdue counts each reflect one task
      const totalCard = screen.getByText(/Total Tasks/i).closest('div');
      expect(within(totalCard).getByText('3')).toBeInTheDocument();

      const completedCard = screen.getByText('Completed', { selector: 'p' }).closest('div');
      expect(within(completedCard).getByText('1')).toBeInTheDocument();

      const overdueCard = screen.getByText('Overdue', { selector: 'p' }).closest('div');
      expect(within(overdueCard).getByText('1')).toBeInTheDocument();
    });
  });

  describe('Data Visualization', () => {
    test('displays progress bars with correct aria attributes', async () => {
      // Seed completed and pending tasks so progress bars appear
      const tasks = [
        createMockCompletedTask({ title: 'Done' }),
        createMockTask({ title: 'Not Done' }),
      ];

      // Render the statistics page with mixed completion states
      setupStatisticsPage(tasks);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that progress bars exist and expose meaningful accessibility attributes
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);

      progressBars.forEach(bar => {
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin');
        expect(bar).toHaveAttribute('aria-valuemax');
      });
    });

    test('displays completion rate progress bar', async () => {
      // Seed a 50% completion mix to validate the rate bar
      const tasks = [
        createMockCompletedTask({ title: 'Done 1' }),
        createMockCompletedTask({ title: 'Done 2' }),
        createMockTask({ title: 'Not Done 1' }),
        createMockTask({ title: 'Not Done 2' }),
      ];

      // Render the statistics page with the balanced dataset
      setupStatisticsPage(tasks);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the completion rate progress bar reflects the calculated percentage
      const completionRateSection = screen.getByText(/Completion Rate/i).parentElement;
      const progressBar = within(completionRateSection).getByRole('progressbar');

      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('Statistics Metadata', () => {
    test('displays statistics generation timestamp', async () => {
      // Render the statistics page without task data
      setupStatisticsPage([]);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that the footer text shows when the statistics snapshot was generated
      expect(screen.getByText(/statistics generated at/i)).toBeInTheDocument();
    });

    test('includes descriptive text for each section', async () => {
      // Render the statistics page without task data
      setupStatisticsPage([]);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that helper text guides the user through the dashboard summary
      expect(screen.getByText(/Track your productivity and task completion trends/i)).toBeInTheDocument();
    });
  });

  describe('Loading & Error States', () => {
    test('displays statistics page content', async () => {
      // Render the statistics page without any tasks
      setupStatisticsPage([]);

      // Wait for the dashboard heading to confirm content loaded
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that even with minimal data the descriptive messaging remains visible
      expect(screen.getByText(/Track your productivity and task completion trends/i)).toBeInTheDocument();
    });
  });

  describe('Color Coding & Visual Indicators', () => {
    test('uses appropriate colors for different metrics', async () => {
      // Seed a minimal dataset so overview tiles render
      const tasks = [
        createMockTask({ title: 'Task' }),
      ];

      // Render the statistics page so the overview tiles mount
      setupStatisticsPage(tasks);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that each summary card uses the expected accent color
      const overdueSection = screen.getByText('Overdue Tasks', { selector: 'p' }).closest('div').parentElement;
      expect(overdueSection).toHaveClass('bg-red-50');

      const dueTodaySection = screen.getByText('Due Today', { selector: 'p' }).closest('div').parentElement;
      expect(dueTodaySection).toHaveClass('bg-yellow-50');

      const dueWeekSection = screen.getByText('Due This Week', { selector: 'p' }).closest('div').parentElement;
      expect(dueWeekSection).toHaveClass('bg-blue-50');
    });

    test('displays icons for each overview card', async () => {
      // Render the statistics page with a single task
      setupStatisticsPage([createMockTask({ title: 'Task' })]);

      // Wait for the analytics dashboard to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /statistics & analytics/i })).toBeInTheDocument();
      });

      // Verify that SVG icons exist in the overview cards to provide visual cues
      const overviewSection = screen.getByText(/Total Tasks/i).closest('div').parentElement.parentElement;
      const svgElements = overviewSection.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });
});
