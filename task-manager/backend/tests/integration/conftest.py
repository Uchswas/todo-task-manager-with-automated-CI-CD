"""Shared fixtures for PostgreSQL-backed integration tests."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable, Dict, Tuple
from uuid import uuid4

import pytest
from flask.testing import FlaskClient
from sqlalchemy import text

from app import create_app, db
from tests.integration.helpers import register_and_login

DEFAULT_TEST_DB_URI = "postgresql://todo_user_test:todo_test_password@localhost:5432/todo_app_test"
# Use a fixed secret so locally generated tokens remain predictable across tests
_DEFAULT_SECRET = "integration-tests-secret"


@pytest.fixture(scope="session", name="flask_app")
def _flask_app():
    """Create the Flask application configured for testing."""
    os.environ.setdefault("TEST_DATABASE_URL", DEFAULT_TEST_DB_URI)
    os.environ.setdefault("JWT_SECRET", _DEFAULT_SECRET)
    os.environ.setdefault("SECRET_KEY", _DEFAULT_SECRET)

    application = create_app("testing")

    with application.app_context():
        # Provision the schema once per test session
        db.create_all()

    yield application

    with application.app_context():
        # Ensure tables are dropped at the end of the test session
        db.drop_all()
        db.session.remove()


@pytest.fixture(autouse=True, name="reset_database")
def _reset_database(flask_app):
    """Ensure each test runs with a clean database state."""
    yield

    with flask_app.app_context():
        # Truncate every table to guarantee isolation between tests
        table_names = [table.name for table in db.metadata.sorted_tables]
        if not table_names:
            return

        quoted_names = ", ".join(f'"{name}"' for name in table_names)
        db.session.execute(
            text(f"TRUNCATE TABLE {quoted_names} RESTART IDENTITY CASCADE")
        )
        db.session.commit()


@pytest.fixture(scope="function", name="flask_client")
def _flask_client(flask_app) -> FlaskClient:
    """Provide a Flask test client bound to the application context."""
    with flask_app.test_client() as test_client:
        yield test_client


RegistrationHelper = Callable[..., Tuple[Any, Dict[str, Any]]]
LoginHelper = Callable[..., Tuple[Any, Dict[str, Any]]]


@pytest.fixture(name="register_user")
def _register_user_fixture(flask_client: FlaskClient) -> RegistrationHelper:
    """Return a helper that registers users through the public API."""

    def _register_user(
        *,
        email: str | None = None,
        password: str = "Password123!",
        name: str = "Test User",
    ):
        chosen_email = email or f"user_{uuid4().hex}@example.com"
        payload = {
            "email": chosen_email,
            "password": password,
            "name": name,
        }

        # Call the real registration endpoint just like the UI would
        response = flask_client.post("/api/auth/register", json=payload, follow_redirects=False)
        data = response.get_json() or {}

        if response.status_code >= 400:
            # Fail fast with context so the underlying issue is visible in the test output
            raise AssertionError(f"Registration failed: {response.status_code} {data}")

        return response, data

    return _register_user


@pytest.fixture(name="login_user")
def _login_user_fixture(flask_client: FlaskClient) -> LoginHelper:
    """Return a helper that performs logins through the public API."""

    def _login_user(*, email: str, password: str):
        payload = {
            "email": email,
            "password": password,
        }

        # Execute the login flow and surface any unexpected failures immediately
        response = flask_client.post("/api/auth/login", json=payload, follow_redirects=False)
        data = response.get_json() or {}

        if response.status_code >= 400:
            raise AssertionError(f"Login failed: {response.status_code} {data}")

        return response, data

    return _login_user


def auth_headers(token: str) -> Dict[str, str]:
    """Construct an Authorization header for authenticated requests."""
    # Keeps header creation consistent across tests that reuse the same token
    return {"Authorization": f"Bearer {token}"}


@dataclass(frozen=True)
class AuthorizedClient:
    """Container for an authenticated client and associated metadata."""

    client: FlaskClient
    headers: Dict[str, str]
    token: str
    user: Dict[str, Any]


@pytest.fixture(name="authorized_client")
def _authorized_client(
    flask_client: FlaskClient,
    register_user: RegistrationHelper,
    login_user: LoginHelper,
) -> AuthorizedClient:
    """Register and authenticate a default user for convenience."""
    # Drive a full register/login cycle so subsequent requests operate as an authenticated user
    registration, login_payload = register_and_login(
        register_user,
        login_user,
    )
    token = login_payload["access_token"]

    return AuthorizedClient(
        client=flask_client,
        headers=auth_headers(token),
        token=token,
        user=registration["user"],
    )
