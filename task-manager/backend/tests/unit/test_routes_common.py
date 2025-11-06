"""Unit tests for shared route helpers in app.routes.common."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import BadRequest

from app.routes import common as common_routes


def _jsonify_stub():
    """Return a jsonify stand-in capturing payload for assertions."""

    def _jsonify(payload):
        return SimpleNamespace(json=payload)

    return _jsonify


def test_load_json_payload_success(monkeypatch):
    """Valid JSON payload returns data and no error tuple."""
    request_mock = SimpleNamespace(get_json=MagicMock(return_value={"name": "Task"}))
    # monkeypatch injects request stub so load_json_payload reads controlled input.
    monkeypatch.setattr(common_routes, "request", request_mock)
    # MagicMock keeps jsonify dependency deterministic for assertions.
    monkeypatch.setattr(common_routes, "jsonify", _jsonify_stub())

    data, error = common_routes.load_json_payload()

    request_mock.get_json.assert_called_once()
    assert data == {"name": "Task"}
    assert error is None


def test_load_json_payload_no_data(monkeypatch):
    """Missing JSON body returns 400 error response."""
    request_mock = SimpleNamespace(get_json=MagicMock(return_value=None))
    # monkeypatch ensures the helper sees an empty payload scenario.
    monkeypatch.setattr(common_routes, "request", request_mock)
    monkeypatch.setattr(common_routes, "jsonify", _jsonify_stub())

    data, error = common_routes.load_json_payload()

    assert data is None
    assert error[1] == 400
    assert error[0].json["error"] == "No data provided"


def test_load_json_payload_bad_json(monkeypatch):
    """BadRequest from Flask is converted to a 400 error."""
    request_mock = SimpleNamespace(get_json=MagicMock(side_effect=BadRequest("invalid")))
    # monkeypatch forces BadRequest path to verify error handling branch.
    monkeypatch.setattr(common_routes, "request", request_mock)
    monkeypatch.setattr(common_routes, "jsonify", _jsonify_stub())

    data, error = common_routes.load_json_payload()

    assert data is None
    assert error[1] == 400
    assert error[0].json["error"] == "Invalid JSON payload"


def test_paginate_sorted_query_desc(monkeypatch):
    """Descending sort applies sqlalchemy.desc before pagination."""
    query_mock = MagicMock()
    query_mock.order_by.return_value = query_mock
    query_mock.paginate.return_value = "pagination"
    # MagicMock replaces SQLAlchemy desc so we can assert the column passthrough.
    desc_mock = MagicMock(return_value="DESC_COL")
    monkeypatch.setattr(common_routes, "desc", desc_mock)

    result = common_routes.paginate_sorted_query(query_mock, "column", "desc", 2, 20)

    desc_mock.assert_called_once_with("column")
    query_mock.order_by.assert_called_once_with("DESC_COL")
    query_mock.paginate.assert_called_once_with(page=2, per_page=20, error_out=False)
    assert result == "pagination"


def test_paginate_sorted_query_asc(monkeypatch):
    """Ascending sort applies sqlalchemy.asc before pagination."""
    query_mock = MagicMock()
    query_mock.order_by.return_value = query_mock
    query_mock.paginate.return_value = "pagination"
    # MagicMock injects asc so we can observe the propagated column argument.
    asc_mock = MagicMock(return_value="ASC_COL")
    monkeypatch.setattr(common_routes, "asc", asc_mock)

    result = common_routes.paginate_sorted_query(query_mock, "column", "asc", 1, 5)

    asc_mock.assert_called_once_with("column")
    query_mock.order_by.assert_called_once_with("ASC_COL")
    query_mock.paginate.assert_called_once_with(page=1, per_page=5, error_out=False)
    assert result == "pagination"


def test_build_pagination_metadata():
    """Pagination metadata helper formats paginate attributes."""
    pagination_stub = SimpleNamespace(total=10, pages=2, has_next=True, has_prev=False)

    meta = common_routes.build_pagination_metadata(pagination_stub, page=3, per_page=5)

    assert meta["page"] == 3
    assert meta["total"] == 10
    assert meta["has_next"] is True


def test_commit_with_handling_success(monkeypatch):
    """Successful commit returns None and does not log errors."""
    session_mock = MagicMock()
    logger_mock = MagicMock()
    monkeypatch.setattr(common_routes, "jsonify", _jsonify_stub())

    error = common_routes.commit_with_handling(session_mock, logger_mock, "Commit failed")

    session_mock.commit.assert_called_once()
    assert error is None
    logger_mock.exception.assert_not_called()


def test_commit_with_handling_failure(monkeypatch):
    """SQLAlchemyError triggers rollback and returns error response."""
    session_mock = MagicMock()
    session_mock.commit.side_effect = SQLAlchemyError("db error")
    logger_mock = MagicMock()
    # monkeypatch jsonify so the generated response is easy to inspect.
    monkeypatch.setattr(common_routes, "jsonify", _jsonify_stub())

    error = common_routes.commit_with_handling(session_mock, logger_mock, "Commit failed")

    session_mock.rollback.assert_called_once()
    logger_mock.exception.assert_called_once_with("Commit failed")
    assert error[1] == 500
    assert error[0].json["error"] == "Commit failed"


def test_finalize_commit_response_short_circuit():
    """Existing error response is returned directly without committing."""
    session_mock = MagicMock()
    logger_mock = MagicMock()
    error_response = ("json", 400)

    result = common_routes.finalize_commit_response(
        error_response,
        session_mock,
        logger_mock,
        "Commit failed",
    )

    assert result == error_response
    session_mock.commit.assert_not_called()


def test_finalize_commit_response_commit_failure(monkeypatch):
    """Commit failure path surfaces error from commit_with_handling."""
    session_mock = MagicMock()
    logger_mock = MagicMock()
    # MagicMock returns a consistent error tuple to simulate commit failure.
    commit_mock = MagicMock(return_value=("json", 500))
    monkeypatch.setattr(
        common_routes,
        "commit_with_handling",
        commit_mock,
    )

    result = common_routes.finalize_commit_response(
        None,
        session_mock,
        logger_mock,
        "Commit failed",
    )

    commit_mock.assert_called_once_with(session_mock, logger_mock, "Commit failed")
    assert result == ("json", 500)
