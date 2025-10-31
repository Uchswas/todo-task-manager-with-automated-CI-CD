"""Health and diagnostics endpoints for the API."""

import time
from datetime import datetime, timezone

import psutil
from flask import Blueprint, jsonify
from sqlalchemy.exc import SQLAlchemyError

from app.models import Category, Task, User, db

health_bp = Blueprint('health', __name__)

# Store application start time
start_time = time.time()


def _utc_timestamp():
    """Return a UTC timestamp string with Z suffix."""
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


@health_bp.route('/health', methods=['GET'])
def health_check():
    """Report application status along with uptime and database health."""
    # Check database connection
    db_status = check_database_connection()
    # Get system information
    uptime_seconds = int(time.time() - start_time)
    memory_usage = get_memory_usage()

    # Overall health status
    status = "healthy" if db_status['connected'] else "unhealthy"
    response = {
        "status": status,
        "timestamp": _utc_timestamp(),
        "version": "1.0.0",
        "database": db_status,
        "uptime_seconds": uptime_seconds,
        "memory_usage_mb": memory_usage
    }

    status_code = 200 if status == "healthy" else 503
    return jsonify(response), status_code


def check_database_connection():
    """Measure database connectivity and response time."""
    try:
        start_time_db = time.time()

        # Simple query to test database connection
        db.session.execute(db.text('SELECT 1'))

        response_time = (time.time() - start_time_db) * 1000  # Convert to milliseconds

        return {
            "connected": True,
            "response_time_ms": round(response_time, 2)
        }
    except SQLAlchemyError as exc:
        return {
            "connected": False,
            "error": str(exc),
            "response_time_ms": None
        }


def get_memory_usage():
    """Return current process memory use in megabytes."""
    try:
        # Get current process memory usage
        process = psutil.Process()
        memory_info = process.memory_info()
        # Return memory usage in MB
        return round(memory_info.rss / 1024 / 1024, 2)
    except (psutil.Error, OSError):
        return None


@health_bp.route('/health/detailed', methods=['GET'])
def detailed_health_check():
    """Provide an expanded health report with system metrics and counts."""
    # Database connection check
    db_status = check_database_connection()
    # System information
    uptime_seconds = int(time.time() - start_time)
    memory_usage = get_memory_usage()

    # Additional system metrics
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        disk_usage = psutil.disk_usage('/').percent
        system_info = {
            "cpu_usage_percent": cpu_percent,
            "disk_usage_percent": disk_usage,
            "memory_usage_mb": memory_usage
        }
    except (psutil.Error, OSError):
        system_info = {
            "cpu_usage_percent": None,
            "disk_usage_percent": None,
            "memory_usage_mb": memory_usage
        }

    # Check database table counts (basic functionality test)
    try:
        table_stats = {
            "users_count": User.query.count(),
            "tasks_count": Task.query.count(),
            "categories_count": Category.query.count()
        }
    except SQLAlchemyError as exc:
        table_stats = {
            "error": "Failed to get table statistics",
            "details": str(exc)
        }

    status = "healthy" if db_status['connected'] else "unhealthy"

    response = {
        "status": status,
        "timestamp": _utc_timestamp(),
        "version": "1.0.0",
        "uptime_seconds": uptime_seconds,
        "database": db_status,
        "system": system_info,
        "statistics": table_stats,
        "checks": {
            "database_connection": db_status['connected'],
            "system_resources": memory_usage is not None
        }
    }

    status_code = 200 if status == "healthy" else 503
    return jsonify(response), status_code
