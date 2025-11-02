"""Routes for creating, retrieving, and managing tasks."""

from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import and_, or_
from sqlalchemy.exc import SQLAlchemyError

from app.models import Task, db
from app.routes.common import (
    build_pagination_metadata,
    commit_with_handling,
    finalize_commit_response,
    load_json_payload,
    paginate_sorted_query,
)
from app.utils.auth import jwt_required_with_user
from app.utils.validators import (
    validate_pagination_params,
    validate_task_data,
    validate_task_filters,
)

tasks_bp = Blueprint('tasks', __name__)


def _apply_updates_to_task(task, data):
    """Apply allowed field updates to an existing task record."""
    # Update task fields
    if 'title' in data:
        task.title = data['title'].strip()

    if 'description' in data:
        # Normalize description whitespace
        desc_value = data['description']
        task.description = desc_value.strip() if desc_value else None

    if 'priority' in data:
        task.priority = data['priority']

    if 'category_id' in data:
        category_id_value = data['category_id']
        if category_id_value == '' or category_id_value is None:
            category_id_value = None
        elif category_id_value:
            try:
                category_id_value = int(category_id_value)
            except (ValueError, TypeError):
                category_id_value = None
        task.category_id = category_id_value

    if 'due_date' in data:
        due_date_value = data['due_date']
        if due_date_value and (isinstance(due_date_value, str) and due_date_value.strip()):
            try:
                task.due_date = datetime.fromisoformat(
                    due_date_value.replace('Z', '+00:00')
                ).date()
            except (ValueError, AttributeError):
                task.due_date = None
        else:
            task.due_date = None


def _validate_and_apply_task_update(task, data, user_id, task_id):
    """Validate update payload and mutate the task when valid."""
    try:
        # Validate input data
        errors = validate_task_data(data, user_id, task_id)
    except SQLAlchemyError as exc:
        return None, exc

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), None

    _apply_updates_to_task(task, data)
    return None, None


@tasks_bp.route('', methods=['GET'])
@jwt_required_with_user
def get_tasks(current_user):
    """Return paginated tasks filtered and sorted per query parameters."""
    try:
        # Parse filters and pagination from request
        # Get pagination parameters
        page, per_page = validate_pagination_params(request.args)

        # Get filters
        filters = validate_task_filters(request.args)

        # Build query
        query = Task.query.filter_by(user_id=current_user.id)

        # Apply filters
        if 'is_completed' in filters:
            query = query.filter(Task.is_completed == filters['is_completed'])

        if 'priority' in filters:
            query = query.filter(Task.priority == filters['priority'])

        if 'category_id' in filters:
            query = query.filter(Task.category_id == filters['category_id'])

        if 'due_before' in filters:
            query = query.filter(Task.due_date <= filters['due_before'])

        if 'due_after' in filters:
            query = query.filter(Task.due_date >= filters['due_after'])

        if 'search' in filters:
            search_term = f"%{filters['search']}%"
            query = query.filter(
                or_(
                    Task.title.ilike(search_term),
                    Task.description.ilike(search_term)
                )
            )

        # Apply sorting
        sort_column = getattr(Task, filters['sort_by'])
        # Execute paginated query
        pagination = paginate_sorted_query(
            query,
            sort_column,
            filters['sort_order'],
            page,
            per_page,
        )

        tasks = [task.to_dict() for task in pagination.items]

        return jsonify({
            'tasks': tasks,
            'pagination': build_pagination_metadata(pagination, page, per_page),
            'filters_applied': filters,
        }), 200

    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to get tasks")
        return jsonify({'error': 'Failed to get tasks', 'details': str(exc)}), 500


@tasks_bp.route('', methods=['POST'])
@jwt_required_with_user
def create_task(current_user):
    """Create a new task for the authenticated user."""
    # Parse incoming payload
    data, error_response = load_json_payload()
    if error_response is not None:
        return error_response

    try:
        # Validate input data
        errors = validate_task_data(data, current_user.id)
    except SQLAlchemyError as exc:
        current_app.logger.exception("Task validation failed")
        return jsonify({'error': 'Failed to create task', 'details': str(exc)}), 500

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    category_id_value = data.get('category_id')
    if category_id_value == '' or category_id_value is None:
        category_id_value = None
    elif category_id_value:
        try:
            category_id_value = int(category_id_value)
        except (ValueError, TypeError):
            category_id_value = None

    # Prepare description
    description_value = data.get('description') or ''
    description_value = description_value.strip() if description_value else None

    # Create new task
    task = Task(
        user_id=current_user.id,
        title=data['title'].strip(),
        description=description_value,
        priority=data.get('priority', 'medium'),
        category_id=category_id_value
    )

    # Set due date if provided
    due_date_value = data.get('due_date')
    if due_date_value and isinstance(due_date_value, str) and due_date_value.strip():
        try:
            task.due_date = datetime.fromisoformat(due_date_value.replace('Z', '+00:00')).date()
        except (ValueError, AttributeError):
            task.due_date = None
    else:
        task.due_date = None

    # Persist new task
    db.session.add(task)
    commit_error = commit_with_handling(
        db.session,
        current_app.logger,
        "Failed to create task",
    )
    if commit_error is not None:
        return commit_error

    return jsonify({
        'message': 'Task created successfully',
        'task': task.to_dict(),
    }), 201


@tasks_bp.route('/<int:task_id>', methods=['GET'])
@jwt_required_with_user
def get_task(current_user, task_id):
    """Retrieve a single task by identifier."""
    try:
        # Fetch requested task
        task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to get task")
        return jsonify({'error': 'Failed to get task', 'details': str(exc)}), 500

    if not task:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify({'task': task.to_dict()}), 200


@tasks_bp.route('/<int:task_id>', methods=['PUT'])
@jwt_required_with_user
def update_task(current_user, task_id):
    """Update metadata for an existing task."""
    db_error = None
    try:
        # Fetch requested task
        task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        db_error = exc
        task = None

    if db_error is not None:
        current_app.logger.exception("Failed to load task for update")
        return jsonify({'error': 'Failed to update task', 'details': str(db_error)}), 500

    error_response = None
    validation_error = None
    data = None

    if task is None:
        error_response = jsonify({'error': 'Task not found'}), 404

    if error_response is None:
        # Parse incoming payload
        data, json_error = load_json_payload()
        if json_error is not None:
            error_response = json_error

    if error_response is None:
        error_response, validation_error = _validate_and_apply_task_update(
            task,
            data,
            current_user.id,
            task_id,
        )

    if validation_error is not None:
        current_app.logger.exception("Task validation failed during update")
        return jsonify({'error': 'Failed to update task', 'details': str(validation_error)}), 500

    final_error = finalize_commit_response(
        error_response,
        db.session,
        current_app.logger,
        "Failed to update task",
    )
    if final_error is not None:
        return final_error

    return jsonify({
        'message': 'Task updated successfully',
        'task': task.to_dict(),
    }), 200


@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
@jwt_required_with_user
def delete_task(current_user, task_id):
    """Remove a task from the user's collection."""
    try:
        # Lookup task prior to deletion
        task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to load task for deletion")
        return jsonify({'error': 'Failed to delete task', 'details': str(exc)}), 500

    if not task:
        return jsonify({'error': 'Task not found'}), 404

    # Remove task from persistence layer
    db.session.delete(task)
    commit_error = commit_with_handling(
        db.session,
        current_app.logger,
        "Failed to delete task",
    )
    if commit_error is not None:
        return commit_error

    return jsonify({'message': 'Task deleted successfully'}), 200


@tasks_bp.route('/<int:task_id>/complete', methods=['PATCH'])
@jwt_required_with_user
def toggle_task_completion(current_user, task_id):
    """Toggle the completion state of a task."""
    try:
        task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to load task for completion toggle")
        return jsonify({
            'error': 'Failed to update task completion',
            'details': str(exc),
        }), 500

    if not task:
        return jsonify({'error': 'Task not found'}), 404

    # Toggle completion status
    if task.is_completed:
        task.mark_incomplete()
    else:
        task.mark_completed()

    # Persist the change in completion state
    commit_error = commit_with_handling(
        db.session,
        current_app.logger,
        "Failed to toggle task completion",
    )
    if commit_error is not None:
        return commit_error

    status_text = "completed" if task.is_completed else "incomplete"

    return jsonify({
        'message': f'Task marked as {status_text}',
        'task': task.to_dict(),
    }), 200


@tasks_bp.route('/overdue', methods=['GET'])
@jwt_required_with_user
def get_overdue_tasks(current_user):
    """Return paginated list of overdue tasks ordered by due date."""
    try:
        # Get pagination parameters
        page, per_page = validate_pagination_params(request.args)

        # Query for overdue tasks
        today = datetime.now().date()
        query = Task.query.filter(
            and_(
                Task.user_id == current_user.id,
                Task.due_date < today,
                Task.is_completed.is_(False),
            )
        ).order_by(Task.due_date.asc())

        # Execute paginated query
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        tasks = [task.to_dict() for task in pagination.items]

        return jsonify({
            'overdue_tasks': tasks,
            'pagination': build_pagination_metadata(pagination, page, per_page),
        }), 200

    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to fetch overdue tasks")
        return jsonify({
            'error': 'Failed to get overdue tasks',
            'details': str(exc),
        }), 500
