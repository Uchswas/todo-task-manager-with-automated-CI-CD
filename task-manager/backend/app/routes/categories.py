from flask import Blueprint, request, jsonify

from app.models import Category, Task, db
from app.utils.auth import jwt_required_with_user
from app.utils.validators import validate_category_data

categories_bp = Blueprint('categories', __name__)


@categories_bp.route('', methods=['GET'])
@jwt_required_with_user
def get_categories(current_user):
    try:
        categories = Category.query.filter_by(user_id=current_user.id).order_by(Category.name).all()

        return jsonify({
            'categories': [category.to_dict() for category in categories]
        }), 200

    except Exception as e:
        return jsonify({'error': 'Failed to get categories', 'details': str(e)}), 500


@categories_bp.route('', methods=['POST'])
@jwt_required_with_user
def create_category(current_user):
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate input data
        errors = validate_category_data(data, current_user.id)
        if errors:
            return jsonify({'error': 'Validation failed', 'details': errors}), 400

        # Create new category
        category = Category(
            user_id=current_user.id,
            name=data['name'].strip(),
            color=data.get('color')
        )

        db.session.add(category)
        db.session.commit()

        return jsonify({
            'message': 'Category created successfully',
            'category': category.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create category', 'details': str(e)}), 500


@categories_bp.route('/<int:category_id>', methods=['GET'])
@jwt_required_with_user
def get_category(current_user, category_id):
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return jsonify({'error': 'Category not found'}), 404

        return jsonify({'category': category.to_dict()}), 200

    except Exception as e:
        return jsonify({'error': 'Failed to get category', 'details': str(e)}), 500


@categories_bp.route('/<int:category_id>', methods=['PUT'])
@jwt_required_with_user
def update_category(current_user, category_id):
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return jsonify({'error': 'Category not found'}), 404

        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate input data
        errors = validate_category_data(data, current_user.id, category_id)
        if errors:
            return jsonify({'error': 'Validation failed', 'details': errors}), 400

        # Update category fields
        if 'name' in data:
            category.name = data['name'].strip()

        if 'color' in data:
            category.color = data['color']

        db.session.commit()

        return jsonify({
            'message': 'Category updated successfully',
            'category': category.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update category', 'details': str(e)}), 500


@categories_bp.route('/<int:category_id>', methods=['DELETE'])
@jwt_required_with_user
def delete_category(current_user, category_id):
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return jsonify({'error': 'Category not found'}), 404

        # Check if category has tasks
        task_count = Task.query.filter_by(category_id=category_id).count()

        if task_count > 0:
            return jsonify({
                'error': 'Cannot delete category with existing tasks',
                'details': f'Category has {task_count} tasks. Please move or delete them first.'
            }), 400

        db.session.delete(category)
        db.session.commit()

        return jsonify({'message': 'Category deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete category', 'details': str(e)}), 500


@categories_bp.route('/<int:category_id>/tasks', methods=['GET'])
@jwt_required_with_user
def get_category_tasks(current_user, category_id):
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return jsonify({'error': 'Category not found'}), 404

        # Get pagination parameters
        from app.utils.validators import validate_pagination_params
        page, per_page = validate_pagination_params(request.args)

        # Get tasks in this category
        query = Task.query.filter_by(category_id=category_id, user_id=current_user.id)

        # Apply sorting
        sort_by = request.args.get('sort_by', 'created_at')
        if sort_by not in ['created_at', 'due_date', 'priority', 'title', 'updated_at']:
            sort_by = 'created_at'

        sort_order = request.args.get('sort_order', 'desc')
        if sort_order not in ['asc', 'desc']:
            sort_order = 'desc'

        from sqlalchemy import desc, asc
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

    except Exception as e:
        return jsonify({'error': 'Failed to get category tasks', 'details': str(e)}), 500
