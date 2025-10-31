"""Authentication-related utilities: validators and decorators."""

import re
from functools import wraps

from flask import current_app, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException

from app.models import User, db


def validate_email(email):
    """Return True when the email string matches the expected format."""
    if not email or not isinstance(email, str):
        return False

    # Check for consecutive dots
    if '..' in email:
        return False

    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """Validate password strength requirements and return a tuple of result/message."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"

    if not re.search(r'[a-zA-Z]', password):
        return False, "Password must contain at least one letter"

    return True, "Password is valid"


def validate_name(name):
    """Ensure a display name meets length requirements."""
    if not name or len(name.strip()) < 2:
        return False, "Name must be at least 2 characters long"

    if len(name.strip()) > 100:
        return False, "Name must be less than 100 characters"

    return True, "Name is valid"


def jwt_required_with_user(f):
    """Decorator that injects the authenticated user object into a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            current_user_id = int(get_jwt_identity())  # Convert string to int
            current_user = db.session.get(User, current_user_id)

            if not current_user:
                return jsonify({'error': 'User not found'}), 401

            return f(current_user, *args, **kwargs)
        except (JWTExtendedException, ValueError, TypeError) as exc:
            current_app.logger.exception("JWT authentication error")
            return jsonify({'error': 'Invalid token', 'details': str(exc)}), 401

    return decorated_function


def validate_user_registration(data):
    """Validate registration payload and return a list of error messages."""
    errors = []

    # Check required fields
    if not data.get('email'):
        errors.append('Email is required')
    if not data.get('password'):
        errors.append('Password is required')
    if not data.get('name'):
        errors.append('Name is required')

    # Validate email format
    if data.get('email') and not validate_email(data['email']):
        errors.append('Invalid email format')

    # Validate password strength
    if data.get('password'):
        is_valid, message = validate_password(data['password'])
        if not is_valid:
            errors.append(message)

    # Validate name
    if data.get('name'):
        is_valid, message = validate_name(data['name'])
        if not is_valid:
            errors.append(message)

    # Check if email already exists
    if data.get('email') and User.query.filter_by(email=data['email'].lower()).first():
        errors.append('Email already registered')

    return errors


def validate_user_login(data):
    """Validate login payload and return any missing-field errors."""
    errors = []

    if not data.get('email'):
        errors.append('Email is required')
    if not data.get('password'):
        errors.append('Password is required')

    return errors
