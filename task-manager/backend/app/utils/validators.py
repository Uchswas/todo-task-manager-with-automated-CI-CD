"""Validation helpers for task manager request payloads and parameters."""

import re
from datetime import datetime

from app.models import Category


def validate_task_data(data, user_id=None, _task_id=None):
    """Return a list of validation errors for task creation or updates."""
    errors = []

    # Title validation
    title = data.get('title', '').strip()
    if not title:
        errors.append('Title is required')
    elif len(title) > 200:
        errors.append('Title must be less than 200 characters')

    # Description validation
    description = data.get('description', '')
    if description and len(description) > 5000:
        errors.append('Description must be less than 5000 characters')

    # Priority validation
    priority = data.get('priority', 'medium')
    if priority not in ['low', 'medium', 'high']:
        errors.append('Priority must be low, medium, or high')

    # Due date validation
    due_date = data.get('due_date')
    if due_date:
        try:
            datetime.fromisoformat(due_date.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            errors.append('Invalid due date format. Use ISO format (YYYY-MM-DD)')

    # Category validation
    category_id = data.get('category_id')
    if category_id is not None and user_id:
        try:
            category_id = int(category_id)
            category = Category.query.filter_by(id=category_id, user_id=user_id).first()
            if not category:
                errors.append('Category not found or not owned by user')
        except (ValueError, TypeError):
            errors.append('Invalid category ID')

    return errors


def validate_category_data(data, user_id=None, exclude_category_id=None):
    """Validate category payload fields and enforce uniqueness per user."""
    errors = []

    # Name validation
    name = data.get('name', '').strip()
    if not name:
        errors.append('Category name is required')
    elif len(name) > 50:
        errors.append('Category name must be less than 50 characters')

    # Check for duplicate names (case-insensitive)
    if name and user_id:
        query = Category.query.filter_by(user_id=user_id).filter(
            Category.name.ilike(name)
        )

        # Exclude current category when updating
        if exclude_category_id:
            query = query.filter(Category.id != exclude_category_id)

        if query.first():
            errors.append('Category name already exists')

    # Color validation
    color = data.get('color')
    if color and not re.match(r'^#[0-9A-Fa-f]{6}$', color):
        errors.append('Color must be a valid hex color code (e.g., #FF5733)')

    return errors


def validate_pagination_params(request_args):
    """Extract sanitized pagination parameters from request arguments."""
    try:
        page = max(int(request_args.get('page', 1)), 1)
        per_page = int(request_args.get('per_page', 50))
        per_page = min(max(per_page, 1), 100)
        return page, per_page
    except (ValueError, TypeError):
        return 1, 50


def validate_task_filters(request_args):
    """Parse and normalize task filtering parameters from a request."""
    filters = {}

    # Status filter
    status = request_args.get('status')
    if status in ['completed', 'incomplete']:
        filters['is_completed'] = status == 'completed'

    # Priority filter
    priority = request_args.get('priority')
    if priority in ['low', 'medium', 'high']:
        filters['priority'] = priority

    # Category filter
    category_id = request_args.get('category_id')
    if category_id:
        try:
            filters['category_id'] = int(category_id)
        except (ValueError, TypeError):
            pass  # Ignore invalid category_id

    # Due date filters
    due_before = request_args.get('due_before')
    if due_before:
        try:
            filters['due_before'] = datetime.fromisoformat(due_before.replace('Z', '+00:00')).date()
        except (ValueError, AttributeError):
            pass  # Ignore invalid date

    due_after = request_args.get('due_after')
    if due_after:
        try:
            filters['due_after'] = datetime.fromisoformat(due_after.replace('Z', '+00:00')).date()
        except (ValueError, AttributeError):
            pass  # Ignore invalid date

    # Search term
    search = request_args.get('search', '').strip()
    if search:
        filters['search'] = search

    # Sorting
    sort_by = request_args.get('sort_by', 'created_at')
    if sort_by not in ['created_at', 'due_date', 'priority', 'title', 'updated_at']:
        sort_by = 'created_at'

    sort_order = request_args.get('sort_order', 'desc')
    if sort_order not in ['asc', 'desc']:
        sort_order = 'desc'

    filters['sort_by'] = sort_by
    filters['sort_order'] = sort_order

    return filters
