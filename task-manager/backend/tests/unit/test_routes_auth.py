"""Unit tests for app.routes.auth handlers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.exc import SQLAlchemyError

from app.routes import auth as auth_routes


def _jsonify_stub():
    """Return a fake jsonify that captures response payload."""

    def _jsonify(payload):
        return SimpleNamespace(json=payload)

    return _jsonify


def test_register_success(monkeypatch):
    """POST /register creates user and returns token."""
    payload = {"email": "user@example.com", "password": "Pass1234", "name": "User"}
    user_stub = SimpleNamespace(id=1, to_dict=lambda: {"id": 1}, set_password=lambda _: None)
    session_mock = MagicMock()

    # Feed valid payload via loader so we only test handler logic.
    # Stub payload parsing, validation, ORM calls, and token creation.
    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(auth_routes, "validate_user_registration", MagicMock(return_value=[]))
    monkeypatch.setattr(auth_routes, "User", MagicMock(return_value=user_stub))
    monkeypatch.setattr(auth_routes, "Category", MagicMock())
    monkeypatch.setattr(auth_routes, "db", SimpleNamespace(session=session_mock))
    monkeypatch.setattr(auth_routes, "create_access_token", MagicMock(return_value="token"))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(auth_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = auth_routes.register()

    session_mock.add.assert_called()
    session_mock.commit.assert_called_once()
    assert status == 201
    assert response.json["access_token"] == "token"


def test_register_validation_error(monkeypatch):
    """POST /register returns 400 when validation fails."""
    # Feed invalid payload and expect validator error.
    monkeypatch.setattr(
        auth_routes,
        "load_json_payload",
        MagicMock(return_value=({"email": "bad"}, None)),
    )
    # Validator returns list to simulate client error.
    monkeypatch.setattr(
        auth_routes,
        "validate_user_registration",
        MagicMock(return_value=["error"]),
    )
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())

    response, status = auth_routes.register()

    assert status == 400
    assert response.json["details"] == ["error"]


def test_register_database_failure(monkeypatch):
    """POST /register handles SQL exceptions gracefully."""
    payload = {"email": "user@example.com", "password": "Pass1234", "name": "User"}
    user_stub = SimpleNamespace(id=1, to_dict=lambda: {"id": 1}, set_password=lambda _: None)
    session_mock = MagicMock()
    session_mock.commit.side_effect = SQLAlchemyError("db error")

    # Force helper calls while commit raises SQL exception.
    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(auth_routes, "validate_user_registration", MagicMock(return_value=[]))
    monkeypatch.setattr(auth_routes, "User", MagicMock(return_value=user_stub))
    monkeypatch.setattr(auth_routes, "Category", MagicMock())
    monkeypatch.setattr(auth_routes, "db", SimpleNamespace(session=session_mock))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(auth_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = auth_routes.register()

    assert status == 500
    assert response.json["error"] == "Registration failed"


def test_login_success(monkeypatch):
    """POST /login authenticates and returns token."""
    payload = {"email": "user@example.com", "password": "pass"}
    user_stub = MagicMock()
    user_stub.to_dict.return_value = {"id": 1}
    user_stub.check_password.return_value = True

    # Mock payload, validator, user lookup, and token issuance.
    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(auth_routes, "validate_user_login", MagicMock(return_value=[]))
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = user_stub
    monkeypatch.setattr(auth_routes, "User", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(auth_routes, "create_access_token", MagicMock(return_value="token"))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(auth_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = auth_routes.login()

    assert status == 200
    assert response.json["access_token"] == "token"


def test_login_validation_error(monkeypatch):
    """POST /login returns 400 when validation fails."""
    # Validator returns error list to simulate missing credentials.
    monkeypatch.setattr(
        auth_routes,
        "load_json_payload",
        MagicMock(return_value=({"email": ""}, None)),
    )
    monkeypatch.setattr(
        auth_routes,
        "validate_user_login",
        MagicMock(return_value=["bad"]),
    )
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())

    response, status = auth_routes.login()

    assert status == 400
    assert response.json["details"] == ["bad"]


def test_login_invalid_credentials(monkeypatch):
    """POST /login rejects wrong password."""
    payload = {"email": "user@example.com", "password": "pass"}
    user_stub = MagicMock()
    user_stub.check_password.return_value = False

    # Stub payload parsing, validation, and user lookup returning wrong password.
    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(auth_routes, "validate_user_login", MagicMock(return_value=[]))
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = user_stub
    monkeypatch.setattr(auth_routes, "User", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())

    response, status = auth_routes.login()

    assert status == 401
    assert response.json["error"] == "Invalid email or password"


def test_login_database_error(monkeypatch):
    """POST /login handles SQL exceptions from user lookup."""
    payload = {"email": "user@example.com", "password": "pass"}
    query_mock = MagicMock()
    query_mock.filter_by.side_effect = SQLAlchemyError("db error")

    # Database lookup raises error to test server-side failure branch.
    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(auth_routes, "validate_user_login", MagicMock(return_value=[]))
    monkeypatch.setattr(auth_routes, "User", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(auth_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = auth_routes.login()

    assert status == 500
    assert response.json["error"] == "Login failed"


def test_get_profile(monkeypatch):
    """GET /profile returns user data."""
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    current_user = SimpleNamespace(to_dict=lambda: {"id": 1})

    response, status = auth_routes.get_profile.__wrapped__(current_user)

    assert status == 200
    assert response.json["user"] == {"id": 1}


def test_update_profile_success(monkeypatch):
    """PUT /profile updates name/email successfully."""
    payload = {"name": "New", "email": "new@example.com"}
    current_user = SimpleNamespace(
        id=1,
        to_dict=lambda: {"id": 1},
        name="Old",
        email="old@example.com",
    )
    session_mock = MagicMock()

    # Replace JSON loader and update helpers so only commit logic is exercised.
    monkeypatch.setattr(
        auth_routes,
        "load_json_payload",
        MagicMock(return_value=(payload, None)),
    )
    monkeypatch.setattr(auth_routes, "_handle_name_update", MagicMock(return_value=None))
    monkeypatch.setattr(
        auth_routes,
        "_handle_email_update",
        MagicMock(return_value=(None, "new@example.com", None)),
    )
    monkeypatch.setattr(auth_routes, "db", SimpleNamespace(session=session_mock))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())

    response, status = auth_routes.update_profile.__wrapped__(current_user)

    session_mock.commit.assert_called_once()
    assert status == 200
    assert response.json["user"] == {"id": 1}


def test_update_profile_validation_error(monkeypatch):
    """PUT /profile returns validation error response."""
    payload = {"name": "A"}
    current_user = SimpleNamespace(id=1)

    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    # Force name handler to return validation error tuple.
    monkeypatch.setattr(
        auth_routes,
        "_handle_name_update",
        MagicMock(return_value=(SimpleNamespace(json={"error": "fail"}), 400)),
    )
    monkeypatch.setattr(
        auth_routes,
        "_handle_email_update",
        MagicMock(return_value=(None, None, None)),
    )
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())

    response, status = auth_routes.update_profile.__wrapped__(current_user)

    assert status == 400
    assert response.json["error"] == "fail"


def test_update_profile_lookup_error(monkeypatch):
    """PUT /profile handles database lookup errors from email update."""
    payload = {"email": "user@example.com"}
    current_user = SimpleNamespace(id=1)

    # JSON loader + name helper succeed so email helper controls outcome.
    monkeypatch.setattr(auth_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(auth_routes, "_handle_name_update", MagicMock(return_value=None))
    monkeypatch.setattr(
        auth_routes,
        "_handle_email_update",
        MagicMock(return_value=(None, None, SQLAlchemyError("db error"))),
    )
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(auth_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = auth_routes.update_profile.__wrapped__(current_user)

    assert status == 500
    assert response.json["error"] == "Failed to update profile"


def test_update_profile_commit_error(monkeypatch):
    """PUT /profile handles commit failures gracefully."""
    payload = {"name": "New"}
    current_user = SimpleNamespace(id=1, to_dict=lambda: {"id": 1})
    session_mock = MagicMock()
    session_mock.commit.side_effect = SQLAlchemyError("commit fail")

    # Provide valid updates so commit failure is the only error path.
    monkeypatch.setattr(
        auth_routes,
        "load_json_payload",
        MagicMock(return_value=(payload, None)),
    )
    monkeypatch.setattr(auth_routes, "_handle_name_update", MagicMock(return_value=None))
    monkeypatch.setattr(
        auth_routes,
        "_handle_email_update",
        MagicMock(return_value=(None, None, None)),
    )
    monkeypatch.setattr(auth_routes, "db", SimpleNamespace(session=session_mock))
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(auth_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = auth_routes.update_profile.__wrapped__(current_user)

    assert status == 500
    assert response.json["error"] == "Failed to update profile"


def test_logout(monkeypatch):
    """POST /logout returns success message."""
    monkeypatch.setattr(auth_routes, "jsonify", _jsonify_stub())

    response, status = auth_routes.logout.__wrapped__()

    assert status == 200
    assert response.json["message"] == "Logout successful"
