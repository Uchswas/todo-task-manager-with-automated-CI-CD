"""Unit tests for app.routes.stats handlers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.exc import SQLAlchemyError

from app.routes import stats as stats_routes


def _jsonify_stub():
    """Return a fake jsonify capturing payload used by handlers."""

    def _jsonify(payload):
        return SimpleNamespace(json=payload, source="stats_stub")

    return _jsonify


class ColumnStub:
    """Minimal stand-in that records SQLAlchemy column comparisons."""

    def __init__(self, name):
        self.name = name

    def _comparison(self, operator, value):
        """Return structured comparison data for assertion-friendly checks."""
        return {"column": self.name, "operator": operator, "value": value}

    def __eq__(self, other):
        return self._comparison("==", other)

    def __lt__(self, other):
        return self._comparison("<", other)

    def is_(self, other):
        """Return comparison descriptor mimicking SQLAlchemy's is_."""
        return self._comparison("is", other)


def test_get_statistics_success(monkeypatch):
    """GET /stats returns aggregated statistics when helpers succeed."""
    current_user = SimpleNamespace(id=1)
    fake_now = SimpleNamespace(date=lambda: "today", isoformat=lambda: "ts")

    # monkeypatch injects deterministic datetime for predictable timestamps.
    monkeypatch.setattr(stats_routes, "datetime", SimpleNamespace(now=lambda: fake_now))
    # MagicMock stubs collapse helper outputs so we only validate response assembly.
    monkeypatch.setattr(
        stats_routes,
        "_basic_task_counts",
        MagicMock(return_value=(10, 4, 6)),
    )
    monkeypatch.setattr(
        stats_routes,
        "_deadline_counts",
        MagicMock(return_value=(1, 2, 3)),
    )
    # MagicMock provides stable priority breakdown data for the response payload.
    monkeypatch.setattr(
        stats_routes,
        "_priority_breakdown",
        MagicMock(return_value={"low": 1, "medium": 2, "high": 3}),
    )
    # MagicMock ensures predictable category breakdown values.
    monkeypatch.setattr(
        stats_routes,
        "_category_breakdown",
        MagicMock(return_value=[{"name": "Work"}]),
    )
    # MagicMock fixes recent activity results so assertions remain focused.
    monkeypatch.setattr(
        stats_routes,
        "_recent_activity",
        MagicMock(return_value=(5, [])),
    )
    # monkeypatch replaces jsonify so assertions can inspect the returned JSON.
    monkeypatch.setattr(stats_routes, "jsonify", _jsonify_stub())

    response, status = stats_routes.get_statistics.__wrapped__(current_user)

    assert status == 200
    assert response.json["overview"]["total_tasks"] == 10


def test_get_statistics_failure(monkeypatch):
    """GET /stats returns 500 when helper raises SQLAlchemyError."""
    current_user = SimpleNamespace(id=1)
    # MagicMock raises SQLAlchemyError to exercise error-handling branch.
    monkeypatch.setattr(
        stats_routes,
        "_basic_task_counts",
        MagicMock(side_effect=SQLAlchemyError("db")),
    )
    # monkeypatch replaces jsonify and logger so the failure branch can be inspected.
    monkeypatch.setattr(stats_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(stats_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = stats_routes.get_statistics.__wrapped__(current_user)

    assert status == 500
    assert response.json["error"] == "Failed to get statistics"


def test_get_summary_stats_success(monkeypatch):
    """GET /stats/summary returns summary metrics."""
    current_user = SimpleNamespace(id=1)
    query_mock = MagicMock()
    # Make successive filter_by(...).count() invocations return 10 consistently.
    query_mock.filter_by.return_value.count.return_value = 10
    # MagicMock gathers calls from Task.query.filter(...).count() for overdue/due_today.
    filter_result = MagicMock()
    # Capture filter().count() calls to confirm overdue/due_today branches.
    filter_result.count.side_effect = [3, 2]
    query_mock.filter.return_value = filter_result

    # Provide minimal task model columns used in filters/comparisons.
    task_model = SimpleNamespace(
        query=query_mock,
        user_id=ColumnStub("user_id"),
        due_date=ColumnStub("due_date"),
        is_completed=ColumnStub("is_completed"),
    )
    fake_now = SimpleNamespace(date=lambda: "today")

    # monkeypatch swaps ORM/model dependencies so only handler logic executes.
    monkeypatch.setattr(stats_routes, "Task", task_model)
    monkeypatch.setattr(stats_routes, "datetime", SimpleNamespace(now=lambda: fake_now))
    monkeypatch.setattr(stats_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(stats_routes, "current_app", SimpleNamespace(logger=MagicMock()))
    # monkeypatch replaces SQLAlchemy and_ so tuple-based column stubs can pass through.
    monkeypatch.setattr(stats_routes, "and_", lambda *clauses: ("and", clauses), raising=False)

    response, status = stats_routes.get_summary_stats.__wrapped__(current_user)

    assert status == 200
    assert response.json["total_tasks"] == 10


def test_get_summary_stats_failure(monkeypatch):
    """GET /stats/summary returns 500 on database error."""
    current_user = SimpleNamespace(id=1)
    query_mock = MagicMock()
    query_mock.filter_by.side_effect = SQLAlchemyError("db error")

    # Patch Task model/query so the handler encounters the simulated SQL error.
    monkeypatch.setattr(stats_routes, "Task", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(
        stats_routes,
        "datetime",
        SimpleNamespace(now=lambda: SimpleNamespace(date=lambda: "today")),
    )
    # monkeypatch ensures jsonify/logger dependencies are controllable for assertions.
    monkeypatch.setattr(stats_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(stats_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    response, status = stats_routes.get_summary_stats.__wrapped__(current_user)

    assert status == 500
    assert response.json["error"] == "Failed to get summary statistics"
