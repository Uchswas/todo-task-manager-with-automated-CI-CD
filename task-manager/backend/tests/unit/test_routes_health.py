"""Unit tests for app.routes.health endpoints and helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.exc import SQLAlchemyError

from app.routes import health as health_routes


def _jsonify_stub():
    """Return a jsonify replacement that captures JSON payloads."""

    def _jsonify(payload):
        return SimpleNamespace(json=payload)

    return _jsonify


def test_check_database_connection_success(monkeypatch):
    """Database connectivity helper reports healthy status and timing."""
    session_mock = MagicMock()
    # Swap db reference so execute() is tracked without hitting a real database.
    monkeypatch.setattr(
        health_routes,
        "db",
        SimpleNamespace(session=session_mock, text=lambda query: query),
    )
    time_calls = iter([100.0, 100.123])
    # Override time.time to yield deterministic timestamps for elapsed calculation.
    monkeypatch.setattr(health_routes.time, "time", lambda: next(time_calls))

    result = health_routes.check_database_connection()

    session_mock.execute.assert_called_once_with("SELECT 1")
    assert result["connected"] is True
    assert result["response_time_ms"] == 123.0


def test_check_database_connection_failure(monkeypatch):
    """Database helper returns error details when SQL execution fails."""
    session_mock = MagicMock()
    session_mock.execute.side_effect = SQLAlchemyError("db down")
    # Inject db stub whose execute() raises to simulate connectivity issues.
    monkeypatch.setattr(
        health_routes,
        "db",
        SimpleNamespace(session=session_mock, text=lambda query: query),
    )

    result = health_routes.check_database_connection()

    assert result["connected"] is False
    assert result["response_time_ms"] is None
    assert "db down" in result["error"]


def test_get_memory_usage_success(monkeypatch):
    """Process memory usage is converted to megabytes."""
    process_mock = MagicMock()
    process_mock.memory_info.return_value = SimpleNamespace(rss=50 * 1024 * 1024)
    # Replace psutil.Process so the helper reads from the fake rss value.
    monkeypatch.setattr(health_routes.psutil, "Process", MagicMock(return_value=process_mock))

    result = health_routes.get_memory_usage()

    assert result == 50.0


def test_get_memory_usage_failure(monkeypatch):
    """Process memory helper returns None when psutil raises errors."""
    # Make psutil.Process raise to exercise error handling path.
    monkeypatch.setattr(
        health_routes.psutil,
        "Process",
        MagicMock(side_effect=health_routes.psutil.Error("no perms")),
    )

    result = health_routes.get_memory_usage()

    assert result is None


def test_health_check_healthy(monkeypatch):
    """Health endpoint reports healthy status when dependencies succeed."""
    # Stub helpers so the handler only assembles response payload.
    monkeypatch.setattr(
        health_routes,
        "check_database_connection",
        MagicMock(return_value={"connected": True, "response_time_ms": 12.5}),
    )
    monkeypatch.setattr(health_routes, "get_memory_usage", MagicMock(return_value=256.5))
    monkeypatch.setattr(health_routes, "_utc_timestamp", MagicMock(return_value="now"))
    monkeypatch.setattr(health_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(health_routes, "start_time", 100.0, raising=False)

    # Provide deterministic uptime calculation.
    monkeypatch.setattr(health_routes.time, "time", MagicMock(return_value=250.0))

    response, status = health_routes.health_check()

    assert status == 200
    assert response.json["status"] == "healthy"
    assert response.json["uptime_seconds"] == 150
    assert response.json["memory_usage_mb"] == 256.5


def test_health_check_unhealthy(monkeypatch):
    """Health endpoint returns 503 when database is unavailable."""
    monkeypatch.setattr(
        health_routes,
        "check_database_connection",
        MagicMock(return_value={"connected": False, "response_time_ms": None}),
    )
    monkeypatch.setattr(health_routes, "get_memory_usage", MagicMock(return_value=None))
    monkeypatch.setattr(health_routes, "_utc_timestamp", MagicMock(return_value="now"))
    monkeypatch.setattr(health_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(health_routes, "start_time", 50.0, raising=False)
    # Uptime is deterministic for the unhealthy branch too.
    monkeypatch.setattr(health_routes.time, "time", MagicMock(return_value=80.0))

    response, status = health_routes.health_check()

    assert status == 503
    assert response.json["status"] == "unhealthy"
    assert response.json["database"]["connected"] is False


def test_detailed_health_check_success(monkeypatch):
    """Detailed health endpoint aggregates system and database metrics."""
    monkeypatch.setattr(
        health_routes,
        "check_database_connection",
        MagicMock(return_value={"connected": True, "response_time_ms": 10.0}),
    )
    monkeypatch.setattr(health_routes, "get_memory_usage", MagicMock(return_value=512.0))
    monkeypatch.setattr(health_routes, "_utc_timestamp", MagicMock(return_value="now"))
    monkeypatch.setattr(health_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(health_routes, "start_time", 10.0, raising=False)
    monkeypatch.setattr(health_routes.time, "time", MagicMock(return_value=70.0))

    # Replace psutil metrics to avoid hitting the real system.
    monkeypatch.setattr(health_routes.psutil, "cpu_percent", MagicMock(return_value=27.5))
    monkeypatch.setattr(
        health_routes.psutil,
        "disk_usage",
        MagicMock(return_value=SimpleNamespace(percent=66.6)),
    )

    # Provide deterministic query.count() values for each model.
    monkeypatch.setattr(
        health_routes,
        "User",
        SimpleNamespace(query=SimpleNamespace(count=MagicMock(return_value=3))),
    )
    monkeypatch.setattr(
        health_routes,
        "Task",
        SimpleNamespace(query=SimpleNamespace(count=MagicMock(return_value=7))),
    )
    monkeypatch.setattr(
        health_routes,
        "Category",
        SimpleNamespace(query=SimpleNamespace(count=MagicMock(return_value=2))),
    )

    response, status = health_routes.detailed_health_check()

    assert status == 200
    assert response.json["status"] == "healthy"
    assert response.json["system"]["cpu_usage_percent"] == 27.5
    assert response.json["statistics"]["tasks_count"] == 7


def test_detailed_health_check_with_failures(monkeypatch):
    """Detailed health endpoint handles psutil and database failures gracefully."""
    monkeypatch.setattr(
        health_routes,
        "check_database_connection",
        MagicMock(return_value={"connected": False, "response_time_ms": None}),
    )
    monkeypatch.setattr(health_routes, "get_memory_usage", MagicMock(return_value=None))
    monkeypatch.setattr(health_routes, "_utc_timestamp", MagicMock(return_value="now"))
    monkeypatch.setattr(health_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(health_routes, "start_time", 0.0, raising=False)
    monkeypatch.setattr(health_routes.time, "time", MagicMock(return_value=5.0))

    # Make psutil helpers raise so fallback values are used.
    monkeypatch.setattr(
        health_routes.psutil,
        "cpu_percent",
        MagicMock(side_effect=health_routes.psutil.Error("cpu failed")),
    )
    monkeypatch.setattr(
        health_routes.psutil,
        "disk_usage",
        MagicMock(side_effect=health_routes.psutil.Error("disk failed")),
    )

    # Have model count lookups raise SQLAlchemyError to exercise error branch.
    count_mock = MagicMock(side_effect=SQLAlchemyError("count failed"))
    monkeypatch.setattr(
        health_routes,
        "User",
        SimpleNamespace(query=SimpleNamespace(count=count_mock)),
    )
    monkeypatch.setattr(
        health_routes,
        "Task",
        SimpleNamespace(query=SimpleNamespace(count=count_mock)),
    )
    monkeypatch.setattr(
        health_routes,
        "Category",
        SimpleNamespace(query=SimpleNamespace(count=count_mock)),
    )

    response, status = health_routes.detailed_health_check()

    assert status == 503
    assert response.json["status"] == "unhealthy"
    assert response.json["system"]["cpu_usage_percent"] is None
    assert response.json["statistics"]["error"] == "Failed to get table statistics"
