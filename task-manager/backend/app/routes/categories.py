"""Routes for managing task categories and category-specific tasks."""

from sqlalchemy.exc import SQLAlchemyError
from flask import Blueprint, current_app, jsonify, request

from app.models import Category, Task, db
from app.routes.common import (
    build_pagination_metadata,
    commit_with_handling,
    finalize_commit_response,
    load_json_payload,
    paginate_sorted_query,
)
from app.utils.auth import jwt_required_with_user
from app.utils.validators import (
    validate_category_data,
    validate_pagination_params,
)

categories_bp = Blueprint('categories', __name__)


def _apply_category_updates(category, data, user_id, category_id=None):
    """Validate payload and mutate category attributes as needed."""
    if not data:
        return jsonify({'error': 'No data provided'}), None

    try:
        # Validate input data
        errors = validate_category_data(data, user_id, category_id)
    except SQLAlchemyError as exc:
        return None, exc

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), None

    # Update category fields
    if 'name' in data:
        category.name = data['name'].strip()

    if 'color' in data:
        category.color = data['color']

    return None, None


@categories_bp.route('', methods=['GET'])
@jwt_required_with_user
def get_categories(current_user):
    """Return all categories owned by the authenticated user."""
    try:
        # Fetch categories owned by the current user
        categories = Category.query.filter_by(user_id=current_user.id).order_by(Category.name).all()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to get categories")
        return jsonify({'error': 'Failed to get categories', 'details': str(exc)}), 500

    return jsonify({
        'categories': [category.to_dict() for category in categories]
    }), 200


@categories_bp.route('', methods=['POST'])
@jwt_required_with_user
def create_category(current_user):
    """Create a new category for the authenticated user."""
    # Parse incoming payload
    data, error_response = load_json_payload()
    if error_response is not None:
        return error_response

    try:
        # Validate input data
        errors = validate_category_data(data, current_user.id)
    except SQLAlchemyError as exc:
        current_app.logger.exception("Category validation failed")
        return jsonify({'error': 'Failed to create category', 'details': str(exc)}), 500

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    # Create new category
    category = Category(
        user_id=current_user.id,
        name=data['name'].strip(),
        color=data.get('color')
    )

    # Persist the newly created category
    db.session.add(category)
    commit_error = commit_with_handling(
        db.session,
        current_app.logger,
        "Failed to create category",
    )
    if commit_error is not None:
        return commit_error

    return jsonify({
        'message': 'Category created successfully',
        'category': category.to_dict()
    }), 201


@categories_bp.route('/<int:category_id>', methods=['GET'])
@jwt_required_with_user
def get_category(current_user, category_id):
    """Fetch a single category by identifier."""
    try:
        # Select category ensuring ownership
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to get category")
        return jsonify({'error': 'Failed to get category', 'details': str(exc)}), 500

    if not category:
        return jsonify({'error': 'Category not found'}), 404

    return jsonify({'category': category.to_dict()}), 200


@categories_bp.route('/<int:category_id>', methods=['PUT'])
@jwt_required_with_user
def update_category(current_user, category_id):
    """Update category metadata such as name or color."""
    error_response = None
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to load category for update")
        return jsonify({'error': 'Failed to update category', 'details': str(exc)}), 500

    if category is None:
        error_response = jsonify({'error': 'Category not found'}), 404

    data = None
    if error_response is None:
        # Parse incoming payload for updates
        data, json_error = load_json_payload()
        if json_error is not None:
            error_response = json_error

    validation_error = None
    if error_response is None:
        error_response, validation_error = _apply_category_updates(
            category,
            data,
            current_user.id,
            category_id,
        )

    if validation_error is not None:
        current_app.logger.exception("Category validation failed during update")
        return jsonify({
            'error': 'Failed to update category',
            'details': str(validation_error),
        }), 500

    final_error = finalize_commit_response(
        error_response,
        db.session,
        current_app.logger,
        "Failed to update category",
    )
    if final_error is not None:
        return final_error

    return jsonify({
        'message': 'Category updated successfully',
        'category': category.to_dict()
    }), 200


@categories_bp.route('/<int:category_id>', methods=['DELETE'])
@jwt_required_with_user
def delete_category(current_user, category_id):
    """Delete a category that is not associated with any tasks."""
    try:
        # Load the category scheduled for deletion
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to load category for deletion")
        return jsonify({'error': 'Failed to delete category', 'details': str(exc)}), 500

    if not category:
        return jsonify({'error': 'Category not found'}), 404

    try:
        # Check if category has tasks
        task_count = Task.query.filter_by(category_id=category_id).count()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to count tasks for category deletion")
        return jsonify({'error': 'Failed to delete category', 'details': str(exc)}), 500

    if task_count > 0:
        return jsonify({
            'error': 'Cannot delete category with existing tasks',
            'details': f'Category has {task_count} tasks. Please move or delete them first.'
        }), 400

    # Remove the category
    db.session.delete(category)
    commit_error = commit_with_handling(
        db.session,
        current_app.logger,
        "Failed to delete category",
    )
    if commit_error is not None:
        return commit_error

    return jsonify({'message': 'Category deleted successfully'}), 200


@categories_bp.route('/<int:category_id>/tasks', methods=['GET'])
@jwt_required_with_user
def get_category_tasks(current_user, category_id):
    """List tasks belonging to a category with pagination and sorting."""
    try:
        # Confirm the requested category belongs to the user
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to load category for task listing")
        return jsonify({'error': 'Failed to get category tasks', 'details': str(exc)}), 500

    if not category:
        return jsonify({'error': 'Category not found'}), 404

    # Get pagination parameters
    page, per_page = validate_pagination_params(request.args)

    try:
        # Get tasks in this category
        query = Task.query.filter_by(category_id=category_id, user_id=current_user.id)

        # Apply sorting
        sort_by = request.args.get('sort_by', 'created_at')
        if sort_by not in ['created_at', 'due_date', 'priority', 'title', 'updated_at']:
            sort_by = 'created_at'

        sort_order = request.args.get('sort_order', 'desc')
        if sort_order not in ['asc', 'desc']:
            sort_order = 'desc'

        sort_column = getattr(Task, sort_by)
        # Execute paginated query
        pagination = paginate_sorted_query(query, sort_column, sort_order, page, per_page)
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to fetch category tasks")
        return jsonify({'error': 'Failed to get category tasks', 'details': str(exc)}), 500

    tasks = [task.to_dict() for task in pagination.items]

    return jsonify({
        'category': category.to_dict(),
        'tasks': tasks,
        'pagination': build_pagination_metadata(pagination, page, per_page)
    }), 200
