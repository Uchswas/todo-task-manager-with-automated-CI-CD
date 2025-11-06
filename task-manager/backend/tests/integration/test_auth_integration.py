"""Integration tests exercising the public authentication API."""

from __future__ import annotations

from http import HTTPStatus
from uuid import uuid4

import pytest

from app.models import Category, User, db
from tests.integration.conftest import AuthorizedClient, auth_headers
from tests.integration.helpers import register_and_login


def test_register_creates_user_and_default_categories(register_user):
    """POST /api/auth/register creates the user and default categories."""
    # Register a brand-new account and capture the JSON so we can examine DB state
    _, payload = register_user()

    user_id = payload["user"]["id"]

    user = db.session.get(User, user_id)
    assert user is not None

    categories = Category.query.filter_by(user_id=user_id).order_by(Category.name).all()
    category_names = [category.name for category in categories]

    assert len(categories) == 4
    assert category_names == sorted(category_names)


def test_register_rejects_duplicate_email(register_user, flask_client):
    """Registering with an existing email should return 400."""
    # First create a user via the helper, then submit the same payload again via the public route
    _, payload = register_user()
    email = payload["user"]["email"]

    response = flask_client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "name": "Another User",
        },
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    error = response.get_json()
    assert error["error"] == "Validation failed"
    assert "Email already registered" in error["details"]


def test_login_returns_token_and_profile(register_user, login_user, flask_client):
    """POST /api/auth/login issues a JWT that grants profile access."""
    # Chain register/login to obtain a real JWT, then hit the protected profile route with it
    registration, login_payload = register_and_login(
        register_user,
        login_user,
    )
    token = login_payload["access_token"]

    response = flask_client.get(
        "/api/auth/profile",
        headers=auth_headers(token),
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.OK
    profile = response.get_json()
    assert profile["user"]["email"] == registration["user"]["email"]


def test_logout_succeeds_with_valid_token(authorized_client: AuthorizedClient):
    """POST /api/auth/logout returns success when provided a valid JWT."""
    # Use the authorized_client fixture to issue logout and confirm the server responds as expected
    response = authorized_client.client.post(
        "/api/auth/logout",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert data["message"] == "Logout successful"


@pytest.mark.parametrize(
    ("headers", "expected_status"),
    [
        (None, HTTPStatus.UNAUTHORIZED),
        ({"Authorization": "Bearer invalid-token"}, HTTPStatus.UNPROCESSABLE_ENTITY),
    ],
)
def test_profile_requires_valid_token(flask_client, headers, expected_status):
    """GET /api/auth/profile requires a valid JWT."""
    response = flask_client.get(
        "/api/auth/profile",
        headers=headers,
        follow_redirects=False,
    )

    assert response.status_code == expected_status


def test_update_profile_success(authorized_client: AuthorizedClient):
    """PUT /api/auth/profile updates name and email."""
    # Update both name and email, then confirm the response payload reflects the new values
    new_email = f"{uuid4().hex}@example.com"

    response = authorized_client.client.put(
        "/api/auth/profile",
        json={"name": "Updated User", "email": new_email},
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.OK
    payload = response.get_json()
    assert payload["user"]["email"] == new_email
    assert payload["user"]["name"] == "Updated User"


def test_update_profile_no_payload(authorized_client: AuthorizedClient):
    """Sending an empty body returns 400."""
    response = authorized_client.client.put(
        "/api/auth/profile",
        json={},
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    payload = response.get_json()
    assert payload["error"] == "No data provided"


def test_update_profile_validation_error(authorized_client: AuthorizedClient):
    """Invalid profile data returns a validation error."""
    # Supply an invalid name (too short) and expect the route to return the validation message
    response = authorized_client.client.put(
        "/api/auth/profile",
        json={"name": "A"},
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    payload = response.get_json()
    assert payload["error"] == "Name must be at least 2 characters long"


def test_login_invalid_credentials(register_user, flask_client):
    """Login with wrong password returns 401."""
    # Register a user, then attempt login with a bad password and assert 401 plus the message
    _, registration = register_user(password="Password123!")
    response = flask_client.post(
        "/api/auth/login",
        json={"email": registration["user"]["email"], "password": "WrongPass!"},
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    payload = response.get_json()
    assert payload["error"] == "Invalid email or password"


def test_login_invalid_json(flask_client):
    """Invalid JSON payloads return 400."""
    # Send malformed JSON to ensure load_json_payload handles the BadRequest exception path
    response = flask_client.post(
        "/api/auth/login",
        data="{bad json",
        content_type="application/json",
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    payload = response.get_json()
    assert payload["error"] == "Invalid JSON payload"


def test_register_validation_failure(flask_client):
    """Registering without required fields returns validation error."""
    # Missing password should trigger the aggregate validation response from register()
    response = flask_client.post(
        "/api/auth/register",
        json={"email": "user@example.com"},
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    payload = response.get_json()
    assert payload["error"] == "Validation failed"
    assert "Password is required" in payload["details"]


def test_register_invalid_email_format(flask_client):
    """Registering with malformed email returns 400."""
    # Supply a syntactically invalid email address so the validator rejects the payload
    response = flask_client.post(
        "/api/auth/register",
        json={
            "email": "invalid-email",
            "password": "Password123!",
            "name": "User",
        },
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    payload = response.get_json()
    assert payload["error"] == "Validation failed"
    assert any("Invalid email format" in msg for msg in payload["details"])


def test_register_duplicate_email(flask_client):
    """Registering the same email twice returns 400."""
    # Register once, then resubmit the identical payload to confirm uniqueness safeguards
    payload = {
        "email": "dup@example.com",
        "password": "Password123!",
        "name": "Dup",
    }
    first = flask_client.post("/api/auth/register", json=payload, follow_redirects=False)
    assert first.status_code == HTTPStatus.CREATED

    second = flask_client.post("/api/auth/register", json=payload, follow_redirects=False)
    assert second.status_code == HTTPStatus.BAD_REQUEST
    body = second.get_json()
    assert body["error"] == "Validation failed"
    assert "Email already registered" in body["details"]
