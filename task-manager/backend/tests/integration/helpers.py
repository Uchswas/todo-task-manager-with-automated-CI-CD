"""Shared helper utilities for integration tests."""

# The helper module centralizes common HTTP helpers so individual tests remain concise
# while still performing real requests against the Flask application under test.

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Dict, Tuple

from flask.testing import FlaskClient

if TYPE_CHECKING:
    from tests.integration.conftest import AuthorizedClient

JSONDict = Dict[str, Any]
ResponseTuple = Tuple[Any, JSONDict]
RegisterFunc = Callable[..., Tuple[Any, JSONDict]]
LoginFunc = Callable[..., Tuple[Any, JSONDict]]


def post_json(
    client: AuthorizedClient,
    path: str,
    payload: JSONDict,
) -> ResponseTuple:
    """Submit a POST request and return the response and JSON payload."""
    # Issue the request with the caller's auth headers so fixtures stay DRY
    response = client.client.post(
        path,
        json=payload,
        headers=client.headers,
        follow_redirects=False,
    )
    return response, response.get_json() if response.is_json else {}


def get_json(
    client: AuthorizedClient,
    path: str,
) -> ResponseTuple:
    """Issue a GET request and return the response and JSON payload."""
    # Mirror post_json but for GET requests, preserving auth headers provided by the fixture
    response = client.client.get(
        path,
        headers=client.headers,
        follow_redirects=False,
    )
    return response, response.get_json() if response.is_json else {}


def post_anonymous(
    client: FlaskClient,
    path: str,
    payload: JSONDict,
) -> ResponseTuple:
    """Submit an unauthenticated POST (useful for register/login tests)."""
    # Some routes (register/login) intentionally omit auth, so provide a helper without headers
    response = client.post(
        path,
        json=payload,
        follow_redirects=False,
    )
    return response, response.get_json() if response.is_json else {}


def register_and_login(
    register_user: RegisterFunc,
    login_user: LoginFunc,
    *,
    password: str = "Password123!",
) -> Tuple[JSONDict, JSONDict]:
    """Register a user and perform login, returning the payloads."""
    # End-to-end helper that mirrors the user journey for tests needing a JWT
    _, registration = register_user(password=password)
    email = registration["user"]["email"]

    _, login_payload = login_user(email=email, password=password)
    return registration, login_payload


def get_public_json(
    client: FlaskClient,
    path: str,
) -> ResponseTuple:
    """Issue a GET request without authentication headers."""
    # Health endpoints do not require authentication, so provide a convenience wrapper
    response = client.get(
        path,
        follow_redirects=False,
    )
    return response, response.get_json() if response.is_json else {}


def assert_error_response(response, expected_status: int, expected_message: str) -> JSONDict:
    """Assert an error response and return the parsed payload."""
    # Shared assertion for error responses keeps individual tests focused on setup
    assert response.status_code == expected_status
    payload = response.get_json()
    assert payload["error"] == expected_message
    return payload
