"""Aggregate statistics endpoints for task insights."""

from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify
from sqlalchemy import and_, case, func
from sqlalchemy.exc import SQLAlchemyError

from app.models import Category, Task, db
from app.utils.auth import jwt_required_with_user

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('', methods=['GET'])
@jwt_required_with_user
def get_statistics(current_user):
    """Return detailed productivity and completion statistics for the user."""
    try:
        user_id = current_user.id
        today = datetime.now().date()

        # Basic task counts
        total_tasks = Task.query.filter_by(user_id=user_id).count()
        completed_tasks = Task.query.filter_by(user_id=user_id, is_completed=True).count()
        pending_tasks = total_tasks - completed_tasks

        # Overdue tasks (incomplete tasks past due date)
        overdue_tasks = Task.query.filter(
            and_(
                Task.user_id == user_id,
                Task.due_date < today,
                Task.is_completed.is_(False),
            )
        ).count()

        # Tasks due today
        due_today = Task.query.filter(
            and_(
                Task.user_id == user_id,
                Task.due_date == today,
                Task.is_completed.is_(False),
            )
        ).count()

        # Tasks due this week
        week_start = today
        week_end = today + timedelta(days=7)
        due_this_week = Task.query.filter(
            and_(
                Task.user_id == user_id,
                Task.due_date >= week_start,
                Task.due_date <= week_end,
                Task.is_completed.is_(False),
            )
        ).count()

        # Priority breakdown
        priority_stats = db.session.query(
            Task.priority,
            func.count(Task.id).label('count'),  # pylint: disable=not-callable
        ).filter_by(user_id=user_id, is_completed=False).group_by(Task.priority).all()

        priority_breakdown = {
            'low': 0,
            'medium': 0,
            'high': 0
        }
        for priority, count in priority_stats:
            priority_breakdown[priority] = count

        # Category breakdown
        category_stats = db.session.query(
            Category.name,
            Category.color,
            func.count(Task.id).label('task_count'),  # pylint: disable=not-callable
            func.sum(case((Task.is_completed.is_(True), 1), else_=0)).label('completed_count'),
        ).outerjoin(
            Task,
            and_(Task.category_id == Category.id, Task.user_id == user_id)
        ).filter(Category.user_id == user_id).group_by(
            Category.id, Category.name, Category.color
        ).all()

        category_breakdown = []
        for name, color, task_count, completed_count in category_stats:
            category_breakdown.append({
                'name': name,
                'color': color,
                'total_tasks': task_count or 0,
                'completed_tasks': completed_count or 0,
                'pending_tasks': (task_count or 0) - (completed_count or 0)
            })

        # Tasks without category
        uncategorized_count = Task.query.filter_by(user_id=user_id, category_id=None).count()
        uncategorized_completed = Task.query.filter_by(
            user_id=user_id, category_id=None, is_completed=True
        ).count()

        if uncategorized_count > 0:
            category_breakdown.append({
                'name': 'Uncategorized',
                'color': '#6B7280',
                'total_tasks': uncategorized_count,
                'completed_tasks': uncategorized_completed,
                'pending_tasks': uncategorized_count - uncategorized_completed
            })

        # Completion rate
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

        # Recent activity (tasks completed in last 7 days)
        seven_days_ago = datetime.now().date() - timedelta(days=7)
        recent_completions = Task.query.filter(
            and_(
                Task.user_id == user_id,
                Task.is_completed.is_(True),
                Task.completed_at.isnot(None),
                func.date(Task.completed_at) >= seven_days_ago,
            )
        ).count()

        # Weekly completion trend (last 4 weeks including current week)
        weekly_trend = []
        for i in range(4):
            if i == 0:
                # Current week: from 7 days ago to today (inclusive)
                week_start = today - timedelta(days=6)  # Last 7 days including today
                week_end = today
            else:
                # Previous weeks
                week_end = today - timedelta(days=i*7)
                week_start = week_end - timedelta(days=6)  # 7-day period

            week_completions = Task.query.filter(
                and_(
                    Task.user_id == user_id,
                    Task.is_completed.is_(True),
                    Task.completed_at.isnot(None),
                    func.date(Task.completed_at) >= week_start,
                    func.date(Task.completed_at) <= week_end,
                )
            ).count()

            weekly_trend.insert(0, {
                'week_start': week_start.isoformat(),
                'week_end': week_end.isoformat(),
                'completions': week_completions,
                'is_current_week': (i == 0),
            })

        return jsonify({
            'overview': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'pending_tasks': pending_tasks,
                'overdue_tasks': overdue_tasks,
                'due_today': due_today,
                'due_this_week': due_this_week,
                'completion_rate': round(completion_rate, 1),
                'recent_completions': recent_completions,
            },
            'priority_breakdown': priority_breakdown,
            'category_breakdown': category_breakdown,
            'weekly_trend': weekly_trend,
            'generated_at': datetime.now().isoformat(),
        }), 200

    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to get statistics")
        return jsonify({'error': 'Failed to get statistics', 'details': str(exc)}), 500


@stats_bp.route('/summary', methods=['GET'])
@jwt_required_with_user
def get_summary_stats(current_user):
    """Return a concise summary of current task metrics."""
    try:
        user_id = current_user.id
        today = datetime.now().date()

        # Quick summary stats
        total_tasks = Task.query.filter_by(user_id=user_id).count()
        completed_tasks = Task.query.filter_by(user_id=user_id, is_completed=True).count()

        overdue_tasks = Task.query.filter(
            and_(
                Task.user_id == user_id,
                Task.due_date < today,
                Task.is_completed.is_(False),
            )
        ).count()

        due_today = Task.query.filter(
            and_(
                Task.user_id == user_id,
                Task.due_date == today,
                Task.is_completed.is_(False),
            )
        ).count()

        return jsonify({
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'pending_tasks': total_tasks - completed_tasks,
            'overdue_tasks': overdue_tasks,
            'due_today': due_today,
            'completion_rate': round(
                (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
                1,
            ),
        }), 200

    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to get summary statistics")
        return jsonify({'error': 'Failed to get summary statistics', 'details': str(exc)}), 500
