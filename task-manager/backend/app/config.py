"""Configuration objects and helpers for the Flask application."""

import os
from datetime import timedelta
from typing import Any, Dict

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration with defaults shared across environments."""

    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or (
        'postgresql://todo_user:password@localhost/todo_app_dev'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.environ.get('SQLALCHEMY_ECHO', 'False').lower() == 'true'

    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET') or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # CORS Configuration
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')

    # Pagination
    TASKS_PER_PAGE = int(os.environ.get('TASKS_PER_PAGE', '50'))

    # Validation
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file upload

    @classmethod
    def init_app(cls, app) -> None:
        """Hook for subclasses to customize the Flask app at runtime."""

    @classmethod
    def to_mapping(cls) -> Dict[str, Any]:
        """Return a dict of uppercase configuration entries for inspection."""
        return {
            key: getattr(cls, key)
            for key in dir(cls)
            if key.isupper()
        }


class DevelopmentConfig(Config):
    """Configuration tailored for local development."""

    DEBUG = True
    SQLALCHEMY_ECHO = True


class TestingConfig(Config):
    """Configuration for running the automated test suite."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or (
        'postgresql://todo_user:password@localhost/todo_app_test'
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)  # Shorter for testing


class ProductionConfig(Config):
    """Configuration optimized for production deployments."""

    DEBUG = False
    SQLALCHEMY_ECHO = False


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
