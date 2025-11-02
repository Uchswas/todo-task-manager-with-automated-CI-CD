"""Unit tests for app.utils.auth helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.utils import auth as auth_utils


def test_validate_email_success():
    """Valid email passes validation."""
    assert auth_utils.validate_email("valid.email@example.com")


@pytest.mark.parametrize(
    "email",
    [
        "",
        None,
        "missing-at",
        "missing-domain@",
        "bad@domain",
        "double..dot@example.com",
    ],
)
def test_validate_email_failures(email):
    """Invalid emails are rejected."""
    assert auth_utils.validate_email(email) is False


def test_validate_password_success():
    """Valid password satisfies all rules."""
    valid, message = auth_utils.validate_password("Pass1234")
    assert valid is True
    assert message == "Password is valid"


@pytest.mark.parametrize(
    "password, expected",
    [
        ("short7", "Password must be at least 8 characters long"),
        ("NoNumberHere", "Password must contain at least one number"),
        ("12345678", "Password must contain at least one letter"),
        (None, "Password must be at least 8 characters long"),
    ],
)
def test_validate_password_failures(password, expected):
    """Invalid passwords return appropriate messages."""
    valid, message = auth_utils.validate_password(password)
    assert valid is False
    assert message == expected


def test_validate_name_success():
    """Valid names satisfy constraints."""
    valid, message = auth_utils.validate_name("Tester Name")
    assert valid is True
    assert message == "Name is valid"


@pytest.mark.parametrize(
    "name, expected",
    [
        ("", "Name must be at least 2 characters long"),
        ("A", "Name must be at least 2 characters long"),
        (" " * 5, "Name must be at least 2 characters long"),
        ("X" * 101, "Name must be less than 100 characters"),
    ],
)
def test_validate_name_failures(name, expected):
    """Invalid names yield validation errors."""
    valid, message = auth_utils.validate_name(name)
    assert valid is False
    assert message == expected


def test_validate_user_registration_success(monkeypatch):
    """Registration succeeds when data is valid and email unused."""
    mock_query = MagicMock()
    # Simulate lookup returning no existing user for the provided email.
    mock_query.filter_by.return_value.first.return_value = None
    monkeypatch.setattr(auth_utils, "User", SimpleNamespace(query=mock_query))

    errors = auth_utils.validate_user_registration(
        {
            "email": "newuser@example.com",
            "password": "Password123",
            "name": "Tester",
        }
    )

    assert not errors


def test_validate_user_registration_failures(monkeypatch):
    """Registration errors include missing fields and duplicate email."""
    existing_user = SimpleNamespace(id=1)
    mock_query = MagicMock()
    # Pretend the email is already taken by returning an existing user.
    mock_query.filter_by.return_value.first.return_value = existing_user
    monkeypatch.setattr(auth_utils, "User", SimpleNamespace(query=mock_query))

    errors = auth_utils.validate_user_registration(
        {
            "email": "existing@example.com",
            "password": "weak",
            "name": "A",
        }
    )

    assert "Email already registered" in errors
    assert "Password must be at least 8 characters long" in errors
    assert "Name must be at least 2 characters long" in errors


def test_validate_user_login_success():
    """Login validator succeeds when both fields exist."""
    payload = {"email": "user@example.com", "password": "Password123"}
    errors = auth_utils.validate_user_login(payload)
    assert not errors


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({}, ["Email is required", "Password is required"]),
        ({"email": "user@example.com"}, ["Password is required"]),
        ({"password": "Password123"}, ["Email is required"]),
    ],
)
def test_validate_user_login_failures(payload, expected):
    """Login validator surfaces missing field messages."""
    errors = auth_utils.validate_user_login(payload)
    assert errors == expected


def test_jwt_required_with_user_success(monkeypatch):
    """Decorator injects current user when token is valid."""
    user = SimpleNamespace(id=1, email="user@example.com")
    verify_mock = MagicMock()
    get_identity_mock = MagicMock(return_value=str(user.id))
    session_get_mock = MagicMock(return_value=user)

    # Swap JWT helpers and session lookup with mocks that imitate a valid token.
    monkeypatch.setattr(auth_utils, "verify_jwt_in_request", verify_mock)
    monkeypatch.setattr(auth_utils, "get_jwt_identity", get_identity_mock)
    monkeypatch.setattr(auth_utils.db.session, "get", session_get_mock)

    protected = auth_utils.jwt_required_with_user(lambda current_user: current_user)
    result = protected()

    verify_mock.assert_called_once()
    session_get_mock.assert_called_once()
    assert result is user


def test_jwt_required_with_user_missing_user(monkeypatch):
    """Decorator returns 401 when user cannot be located."""
    verify_mock = MagicMock()
    get_identity_mock = MagicMock(return_value="42")
    session_get_mock = MagicMock(return_value=None)
    jsonify_mock = MagicMock(return_value="json")

    # Force the decorator to experience a missing user scenario.
    monkeypatch.setattr(auth_utils, "verify_jwt_in_request", verify_mock)
    monkeypatch.setattr(auth_utils, "get_jwt_identity", get_identity_mock)
    monkeypatch.setattr(auth_utils.db.session, "get", session_get_mock)
    monkeypatch.setattr(auth_utils, "jsonify", jsonify_mock)

    protected = auth_utils.jwt_required_with_user(lambda current_user: current_user)
    response = protected()

    verify_mock.assert_called_once()
    session_get_mock.assert_called_once()
    jsonify_mock.assert_called_once()
    assert response == ("json", 401)


def test_jwt_required_with_user_invalid_token(monkeypatch):
    """Decorator returns 401 when token verification fails."""
    verify_mock = MagicMock(side_effect=auth_utils.JWTExtendedException("bad token"))
    jsonify_mock = MagicMock(return_value="json")
    current_app_mock = SimpleNamespace(logger=MagicMock())

    # Raise a JWT exception to verify the error-handling branch.
    monkeypatch.setattr(auth_utils, "verify_jwt_in_request", verify_mock)
    monkeypatch.setattr(auth_utils, "jsonify", jsonify_mock)
    monkeypatch.setattr(auth_utils, "current_app", current_app_mock)

    protected = auth_utils.jwt_required_with_user(lambda current_user: current_user)
    response = protected()

    verify_mock.assert_called_once()
    jsonify_mock.assert_called_once()
    assert response == ("json", 401)
