"""Shared helpers for route modules."""

from flask import jsonify, request
from sqlalchemy import asc, desc
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import BadRequest


def load_json_payload():
    """Parse and validate JSON payloads from the current request."""
    try:
        data = request.get_json()
    except BadRequest as error:
        return None, (jsonify({'error': 'Invalid JSON payload', 'details': str(error)}), 400)

    if not data:
        return None, (jsonify({'error': 'No data provided'}), 400)

    return data, None


def paginate_sorted_query(query, sort_column, sort_order, page, per_page):
    """Apply sorting to a query and return a paginated result."""
    if sort_order == 'desc':
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    return query.paginate(page=page, per_page=per_page, error_out=False)


def build_pagination_metadata(pagination, page, per_page):
    """Construct pagination metadata for JSON responses."""
    return {
        'page': page,
        'per_page': per_page,
        'total': pagination.total,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
    }


def commit_with_handling(session, logger, error_message):
    """Commit a database session, rolling back and returning an error response if needed."""
    try:
        session.commit()
    except SQLAlchemyError as exc:
        session.rollback()
        logger.exception(error_message)
        return jsonify({'error': error_message, 'details': str(exc)}), 500

    return None


def finalize_commit_response(error_response, session, logger, error_message):
    """Return the first non-null error response or commit the session."""
    if error_response is not None:
        return error_response

    commit_error = commit_with_handling(session, logger, error_message)
    if commit_error is not None:
        return commit_error

    return None
