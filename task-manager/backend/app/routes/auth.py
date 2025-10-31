"""Routes for user authentication and profile management."""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import BadRequest

from app.models import Category, User, db
from app.utils.auth import (
    jwt_required_with_user,
    validate_email,
    validate_user_login,
    validate_user_registration,
)

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    """Create a new user account and seed default categories."""
    try:
        data = request.get_json()
    except BadRequest as error:
        return jsonify({'error': 'Invalid JSON payload', 'details': str(error)}), 400

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Validate input data
    errors = validate_user_registration(data)
    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    # Create new user
    user = User(
        email=data['email'].lower().strip(),
        name=data['name'].strip(),
    )
    user.set_password(data['password'])

    # Create default categories for the user
    default_categories = [
        {'name': 'Work', 'color': '#3B82F6'},
        {'name': 'Personal', 'color': '#10B981'},
        {'name': 'Shopping', 'color': '#F59E0B'},
        {'name': 'Health', 'color': '#EF4444'},
    ]

    try:
        # Persist user and associated default categories
        db.session.add(user)
        db.session.flush()

        for cat_data in default_categories:
            category = Category(
                user_id=user.id,
                name=cat_data['name'],
                color=cat_data['color'],
            )
            db.session.add(category)

        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Registration failed")
        return jsonify({'error': 'Registration failed', 'details': str(exc)}), 500

    # Create access token (identity must be a string)
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'message': 'User registered successfully',
        'user': user.to_dict(),
        'access_token': access_token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate a user and issue a JWT access token."""
    try:
        data = request.get_json()
    except BadRequest as error:
        return jsonify({'error': 'Invalid JSON payload', 'details': str(error)}), 400

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Validate input data
    errors = validate_user_login(data)
    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    try:
        # Find user and verify password
        user = User.query.filter_by(email=data['email'].lower().strip()).first()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Login failed due to database error")
        return jsonify({'error': 'Login failed', 'details': str(exc)}), 500

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    # Create access token (identity must be a string)
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict(),
        'access_token': access_token
    }), 200


@auth_bp.route('/profile', methods=['GET'])
@jwt_required_with_user
def get_profile(current_user):
    """Return the authenticated user's profile information."""
    return jsonify({
        'user': current_user.to_dict()
    }), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required_with_user
def update_profile(current_user):
    """Update the authenticated user's profile details."""
    try:
        data = request.get_json()
    except BadRequest as error:
        return jsonify({'error': 'Invalid JSON payload', 'details': str(error)}), 400

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    if 'name' in data:
        # Update name if provided
        name = data['name'].strip()
        if len(name) < 2:
            return jsonify({'error': 'Name must be at least 2 characters long'}), 400
        if len(name) > 100:
            return jsonify({'error': 'Name must be less than 100 characters'}), 400
        current_user.name = name

    if 'email' in data:
        # Update email if provided
        email = data['email'].lower().strip()

        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400

        try:
            # Check if email already exists (excluding current user)
            existing_user = (
                User.query.filter_by(email=email)
                .filter(User.id != current_user.id)
                .first()
            )
        except SQLAlchemyError as exc:
            current_app.logger.exception("Profile update lookup failed")
            return jsonify({'error': 'Failed to update profile', 'details': str(exc)}), 500

        if existing_user:
            return jsonify({'error': 'Email already registered'}), 400

        current_user.email = email

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Profile update failed")
        return jsonify({'error': 'Failed to update profile', 'details': str(exc)}), 500

    return jsonify({
        'message': 'Profile updated successfully',
        'user': current_user.to_dict(),
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Acknowledge logout; JWT invalidation handled client-side."""
    # In a more sophisticated implementation, you might want to blacklist the token
    # For now, we just return a success response
    # The client should delete the token from storage
    return jsonify({'message': 'Logout successful'}), 200
