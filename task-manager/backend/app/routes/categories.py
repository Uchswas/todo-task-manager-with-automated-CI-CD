"""Routes for managing task categories and category-specific tasks."""

from sqlalchemy import asc, desc
from sqlalchemy.exc import SQLAlchemyError
from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest

from app.models import Category, Task, db
from app.utils.auth import jwt_required_with_user
from app.utils.validators import (
    validate_category_data,
    validate_pagination_params,
)

categories_bp = Blueprint('categories', __name__)


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
    try:
        # Parse incoming payload
        data = request.get_json()
    except BadRequest as error:
        return jsonify({'error': 'Invalid JSON payload', 'details': str(error)}), 400

    if not data:
        return jsonify({'error': 'No data provided'}), 400

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

    try:
        # Persist the newly created category
        db.session.add(category)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Failed to create category")
        return jsonify({'error': 'Failed to create category', 'details': str(exc)}), 500

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
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to load category for update")
        return jsonify({'error': 'Failed to update category', 'details': str(exc)}), 500

    if not category:
        return jsonify({'error': 'Category not found'}), 404

    try:
        # Parse incoming payload for updates
        data = request.get_json()
    except BadRequest as error:
        return jsonify({'error': 'Invalid JSON payload', 'details': str(error)}), 400

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        # Validate input data
        errors = validate_category_data(data, current_user.id, category_id)
    except SQLAlchemyError as exc:
        current_app.logger.exception("Category validation failed during update")
        return jsonify({'error': 'Failed to update category', 'details': str(exc)}), 500

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    # Update category fields
    if 'name' in data:
        category.name = data['name'].strip()

    if 'color' in data:
        category.color = data['color']

    try:
        # Commit updates to the database
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Failed to update category")
        return jsonify({'error': 'Failed to update category', 'details': str(exc)}), 500

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

    try:
        # Remove the category
        db.session.delete(category)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Failed to delete category")
        return jsonify({'error': 'Failed to delete category', 'details': str(exc)}), 500

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
        if sort_order == 'desc':
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

        # Execute paginated query
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to fetch category tasks")
        return jsonify({'error': 'Failed to get category tasks', 'details': str(exc)}), 500

    tasks = [task.to_dict() for task in pagination.items]

    return jsonify({
        'category': category.to_dict(),
        'tasks': tasks,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev
        }
    }), 200
