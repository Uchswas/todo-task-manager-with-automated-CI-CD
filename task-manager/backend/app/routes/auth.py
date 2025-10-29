from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required

from app.models import User, Category, db
from app.utils.auth import validate_user_registration, validate_user_login, jwt_required_with_user

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate input data
        errors = validate_user_registration(data)
        if errors:
            return jsonify({'error': 'Validation failed', 'details': errors}), 400

        # Create new user
        user = User(
            email=data['email'].lower().strip(),
            name=data['name'].strip()
        )
        user.set_password(data['password'])

        db.session.add(user)
        db.session.commit()

        # Create default categories for the user
        default_categories = [
            {'name': 'Work', 'color': '#3B82F6'},
            {'name': 'Personal', 'color': '#10B981'},
            {'name': 'Shopping', 'color': '#F59E0B'},
            {'name': 'Health', 'color': '#EF4444'}
        ]

        for cat_data in default_categories:
            category = Category(
                user_id=user.id,
                name=cat_data['name'],
                color=cat_data['color']
            )
            db.session.add(category)

        db.session.commit()

        # Create access token (identity must be a string)
        access_token = create_access_token(identity=str(user.id))

        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(),
            'access_token': access_token
        }), 201

    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.exception("Registration failed")
        return jsonify({'error': 'Registration failed', 'details': str(exc)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate input data
        errors = validate_user_login(data)
        if errors:
            return jsonify({'error': 'Validation failed', 'details': errors}), 400

        # Find user and verify password
        user = User.query.filter_by(email=data['email'].lower().strip()).first()

        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401

        # Create access token (identity must be a string)
        access_token = create_access_token(identity=str(user.id))

        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token
        }), 200

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Login failed")
        return jsonify({'error': 'Login failed', 'details': str(exc)}), 500


@auth_bp.route('/profile', methods=['GET'])
@jwt_required_with_user
def get_profile(current_user):
    try:
        return jsonify({
            'user': current_user.to_dict()
        }), 200

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Profile retrieval failed")
        return jsonify({'error': 'Failed to get profile', 'details': str(exc)}), 500


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required_with_user
def update_profile(current_user):
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Update name if provided
        if 'name' in data:
            name = data['name'].strip()
            if len(name) < 2:
                return jsonify({'error': 'Name must be at least 2 characters long'}), 400
            if len(name) > 100:
                return jsonify({'error': 'Name must be less than 100 characters'}), 400
            current_user.name = name

        # Update email if provided
        if 'email' in data:
            email = data['email'].lower().strip()

            # Validate email format
            from app.utils.auth import validate_email
            if not validate_email(email):
                return jsonify({'error': 'Invalid email format'}), 400

            # Check if email already exists (excluding current user)
            existing_user = (
                User.query.filter_by(email=email)
                .filter(User.id != current_user.id)
                .first()
            )
            if existing_user:
                return jsonify({'error': 'Email already registered'}), 400

            current_user.email = email

        db.session.commit()

        return jsonify({
            'message': 'Profile updated successfully',
            'user': current_user.to_dict(),
        }), 200

    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.exception("Profile update failed")
        return jsonify({'error': 'Failed to update profile', 'details': str(exc)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # In a more sophisticated implementation, you might want to blacklist the token
    # For now, we just return a success response
    # The client should delete the token from storage
    return jsonify({'message': 'Logout successful'}), 200
