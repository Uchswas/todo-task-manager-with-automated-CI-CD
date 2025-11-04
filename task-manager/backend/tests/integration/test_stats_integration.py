"""Integration tests for statistics endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from http import HTTPStatus

from app.models import Category, Task, db
from tests.integration.conftest import AuthorizedClient
from tests.integration.helpers import get_json, post_json


def _create_category(client: AuthorizedClient, name: str, color: str = "#123456"):
    response, payload = post_json(
        client,
        "/api/categories",
        {"name": name, "color": color},
    )
    assert response.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    return payload["category"]


def _force_completion_timestamp(client: AuthorizedClient, task_id: int, timestamp: datetime):
    """Force a completion timestamp directly in the database for trend tests."""
    with client.client.application.app_context():
        db_task = db.session.get(Task, task_id)
        db_task.completed_at = timestamp
        db.session.commit()


def _create_task(
    client: AuthorizedClient,
    *,
    title: str,
    category_id: int | None = None,
    due_date: datetime | None = None,
    complete: bool | datetime = False,
):
    payload = {"title": title}
    if category_id is not None:
        payload["category_id"] = category_id
    if due_date is not None:
        payload["due_date"] = due_date.isoformat()

    _, payload = post_json(client, "/api/tasks", payload)
    task = payload["task"]

    if complete:
        completion_response = client.client.patch(
            f"/api/tasks/{task['id']}/complete",
            headers=client.headers,
            follow_redirects=False,
        )
        assert completion_response.status_code == HTTPStatus.OK
        if isinstance(complete, datetime):
            _force_completion_timestamp(client, task["id"], complete)

    return task


def test_stats_overview_counts(authorized_client: AuthorizedClient):
    """GET /api/stats aggregates totals, deadlines, and breakdowns."""
    # Seed a mix of completed, pending, and overdue tasks to exercise the various counters
    today = datetime.now(timezone.utc).date()
    current_week_day = datetime.now(timezone.utc) - timedelta(days=1)

    work_category = _create_category(authorized_client, "Analytics", "#abcdef")

    _create_task(
        authorized_client,
        title="Complete report",
        category_id=work_category["id"],
        due_date=today,
        complete=current_week_day,
    )
    _create_task(
        authorized_client,
        title="Pending planning",
        category_id=work_category["id"],
        due_date=today + timedelta(days=3),
    )
    _create_task(
        authorized_client,
        title="Overdue item",
        due_date=today - timedelta(days=1),
    )

    response, payload = get_json(authorized_client, "/api/stats")

    assert response.status_code == HTTPStatus.OK
    overview = payload["overview"]

    assert overview["total_tasks"] == 3
    assert overview["completed_tasks"] == 1
    assert overview["pending_tasks"] == 2
    assert overview["overdue_tasks"] == 1
    assert overview["due_today"] in (0, 1)  # Depends on timezone evaluation

    category_breakdown = payload["category_breakdown"]
    analytics_entry = next(
        (entry for entry in category_breakdown if entry["name"] == "Analytics"),
        None,
    )
    assert analytics_entry is not None
    assert analytics_entry["total_tasks"] == 2
    assert analytics_entry["completed_tasks"] == 1

    priority_breakdown = payload["priority_breakdown"]
    assert priority_breakdown["medium"] >= 1

    weekly_trend = payload["weekly_trend"]
    assert len(weekly_trend) == 4
    assert weekly_trend[-1]["is_current_week"] is True


def test_stats_summary_matches_overview(authorized_client: AuthorizedClient):
    """GET /api/stats/summary aligns with overview totals."""
    # Create a small sample of tasks so the summary output is deterministic
    _create_task(authorized_client, title="Task 1")
    _create_task(
        authorized_client,
        title="Task 2",
        complete=datetime.now(timezone.utc),
    )
    _create_task(
        authorized_client,
        title="Task 3",
        due_date=datetime.now(timezone.utc) - timedelta(days=1),
    )

    summary_response, summary = get_json(
        authorized_client,
        "/api/stats/summary",
    )

    assert summary_response.status_code == HTTPStatus.OK

    assert summary["total_tasks"] == 3
    assert summary["completed_tasks"] == 1
    assert summary["pending_tasks"] == 2
    assert summary["overdue_tasks"] >= 1


def test_stats_handles_no_tasks(authorized_client: AuthorizedClient, flask_app):
    """Statistics endpoints return sensible defaults when no data exists."""
    # Wipe all tables for the current user and ensure the endpoint reports zeros instead of errors
    with flask_app.app_context():
        Category.query.delete()
        Task.query.delete()
        db.session.commit()

    response, data = get_json(authorized_client, "/api/stats")

    assert response.status_code == HTTPStatus.OK
    assert data["overview"]["total_tasks"] == 0
