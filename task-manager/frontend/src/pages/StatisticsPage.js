import React, { useState, useEffect } from 'react';
import { statsAPI } from '../utils/api';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const StatisticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await statsAPI.getStats();
      setStats(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchStatistics} />;
  }

  if (!stats) {
    return null;
  }

  const { overview, priority_breakdown, category_breakdown, weekly_trend } = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistics & Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your productivity and task completion trends
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{overview.total_tasks}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{overview.completed_tasks}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{overview.pending_tasks}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{overview.overdue_tasks}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L2.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Rate */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Completion Rate</h2>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-blue-600">
                    {overview.completion_rate}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    {overview.completed_tasks} / {overview.total_tasks} tasks
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-4 text-xs flex rounded-full bg-gray-200" role="progressbar" aria-valuenow={overview.completion_rate} aria-valuemin="0" aria-valuemax="100">
                <div
                  style={{ width: `${overview.completion_rate}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Recent Activity</p>
            <p className="text-2xl font-bold text-gray-900">{overview.recent_completions}</p>
            <p className="text-xs text-gray-500">Last 7 days</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Priority Breakdown</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium text-gray-700">High Priority</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{priority_breakdown.high}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${overview.total_tasks > 0 ? (priority_breakdown.high / overview.total_tasks) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium text-gray-700">Medium Priority</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{priority_breakdown.medium}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${overview.total_tasks > 0 ? (priority_breakdown.medium / overview.total_tasks) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium text-gray-700">Low Priority</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{priority_breakdown.low}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${overview.total_tasks > 0 ? (priority_breakdown.low / overview.total_tasks) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Due Dates Overview */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Due Dates Overview</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div>
                <p className="text-sm font-medium text-red-900">Overdue Tasks</p>
                <p className="text-xs text-red-600 mt-1">Need immediate attention</p>
              </div>
              <div className="text-3xl font-bold text-red-600">{overview.overdue_tasks}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div>
                <p className="text-sm font-medium text-yellow-900">Due Today</p>
                <p className="text-xs text-yellow-600 mt-1">Complete these today</p>
              </div>
              <div className="text-3xl font-bold text-yellow-600">{overview.due_today}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="text-sm font-medium text-blue-900">Due This Week</p>
                <p className="text-xs text-blue-600 mt-1">Plan ahead</p>
              </div>
              <div className="text-3xl font-bold text-blue-600">{overview.due_this_week}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Completion Trend</h2>
        <div className="space-y-3">
          {weekly_trend.map((week, index) => {
            const maxCompletions = Math.max(...weekly_trend.map(w => w.completions), 1);
            const barWidth = (week.completions / maxCompletions) * 100;

            // Determine if this is the current week
            const isCurrentWeek = week.is_current_week || index === weekly_trend.length - 1;
            const dateLabel = isCurrentWeek
              ? `This Week (${formatDate(week.week_start)} - Today)`
              : `${formatDate(week.week_start)} - ${formatDate(week.week_end)}`;

            return (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">
                    {dateLabel}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {week.completions} completed
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3" role="progressbar" aria-valuenow={week.completions} aria-valuemin="0" aria-valuemax={maxCompletions}>
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks by Category</h2>
        {category_breakdown.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No categories with tasks yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {category_breakdown.map((category, index) => (
              <div
                key={index}
                className="border-2 rounded-lg p-4 hover:shadow-md transition-shadow"
                style={{ borderColor: category.color }}
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color }}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500">{category.total_tasks} tasks</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Completed</span>
                    <span className="font-medium text-green-600">{category.completed_tasks}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pending</span>
                    <span className="font-medium text-yellow-600">{category.pending_tasks}</span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${category.total_tasks > 0 ? (category.completed_tasks / category.total_tasks) * 100 : 0}%`,
                        backgroundColor: category.color
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics Generated Time */}
      <div className="text-center text-sm text-gray-500">
        Statistics generated at {new Date(stats.generated_at).toLocaleString()}
      </div>
    </div>
  );
};

export default StatisticsPage;
