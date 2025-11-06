"""Integration tests for task management endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from uuid import uuid4

import pytest

from app.models import Task, db
from tests.integration.conftest import AuthorizedClient
from tests.integration.helpers import assert_error_response, get_json, post_json


def _create_task_payload(
    *,
    title: str | None = None,
    priority: str | None = None,
    description: str | None = None,
    category_id: int | None = None,
    due_date: datetime | None = None,
):
    payload = {
        "title": title or f"Task {uuid4().hex[:6]}",
    }
    if priority is not None:
        payload["priority"] = priority
    if description is not None:
        payload["description"] = description
    if category_id is not None:
        payload["category_id"] = category_id
    if due_date is not None:
        payload["due_date"] = due_date.isoformat()
    return payload


def _post_task(client: AuthorizedClient, payload):
    return post_json(client, "/api/tasks", payload)


def _create_category(client: AuthorizedClient, name: str):
    response, data = post_json(client, "/api/categories", {"name": name})
    assert response.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    return data["category"]


def _get_tasks(client: AuthorizedClient, query: str = ""):
    return get_json(client, f"/api/tasks{query}")


def test_create_and_fetch_task(authorized_client: AuthorizedClient):
    """Tasks can be created and subsequently retrieved."""
    # Create a task then hit the detail endpoint to ensure persisted fields echo back correctly
    payload = _create_task_payload(
        description="Detailed work",
        priority="high",
    )
    response, data = _post_task(authorized_client, payload)

    assert response.status_code == HTTPStatus.CREATED
    task_id = data["task"]["id"]

    get_response = authorized_client.client.get(
        f"/api/tasks/{task_id}",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert get_response.status_code == HTTPStatus.OK
    task = get_response.get_json()["task"]

    assert task["title"] == payload["title"]
    assert task["description"] == "Detailed work"
    assert task["priority"] == "high"


def test_task_validation_error(authorized_client: AuthorizedClient):
    """Validation failures result in a 400 response."""
    # Omit required fields to ensure the API surfaces validation messages
    response, body = _post_task(authorized_client, {"title": ""})
    body = assert_error_response(response, HTTPStatus.BAD_REQUEST, "Validation failed")
    assert "Title is required" in body["details"]


def test_update_and_delete_task(authorized_client: AuthorizedClient, flask_app):
    """Tasks can be updated and deleted via API."""
    # Exercise the update path and confirm the row is removed after deletion
    response, data = _post_task(authorized_client, _create_task_payload())
    assert response.status_code == HTTPStatus.CREATED
    task_id = data["task"]["id"]

    update_response = authorized_client.client.put(
        f"/api/tasks/{task_id}",
        json={
            "title": "Updated Title",
            "description": "Updated description",
            "priority": "medium",
        },
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert update_response.status_code == HTTPStatus.OK
    updated_task = update_response.get_json()["task"]
    assert updated_task["title"] == "Updated Title"
    assert updated_task["description"] == "Updated description"

    delete_response = authorized_client.client.delete(
        f"/api/tasks/{task_id}",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert delete_response.status_code == HTTPStatus.OK

    with flask_app.app_context():
        assert db.session.get(Task, task_id) is None


def test_toggle_completion(authorized_client: AuthorizedClient):
    """Completion status toggles between complete and incomplete."""
    # Toggle completion twice so both mark_completed and mark_incomplete paths execute via the route
    response, payload = _post_task(authorized_client, _create_task_payload())
    assert response.status_code == HTTPStatus.CREATED
    task_id = payload["task"]["id"]

    complete = authorized_client.client.patch(
        f"/api/tasks/{task_id}/complete",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert complete.status_code == HTTPStatus.OK
    assert complete.get_json()["task"]["is_completed"] is True

    revert = authorized_client.client.patch(
        f"/api/tasks/{task_id}/complete",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert revert.status_code == HTTPStatus.OK
    assert revert.get_json()["task"]["is_completed"] is False


def test_task_filters_and_pagination(authorized_client: AuthorizedClient):
    """Task listing applies filters, search, sorting, and pagination."""
    # Build a variety of tasks and ensure the listing honours sort, paging, and filter parameters
    category = _create_category(authorized_client, "Focus")
    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)

    # Create tasks with varied attributes
    _post_task(
        authorized_client,
        _create_task_payload(
            title="Write notes",
            priority="medium",
            due_date=datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc),
        ),
    )
    _post_task(
        authorized_client,
        _create_task_payload(
            title="Plan sprint",
            priority="high",
            category_id=category["id"],
            due_date=datetime.combine(tomorrow, datetime.min.time(), tzinfo=timezone.utc),
        ),
    )
    _post_task(
        authorized_client,
        _create_task_payload(
            title="Read brief",
            priority="low",
            description="Important research",
        ),
    )

    response, payload = _get_tasks(
        authorized_client,
        "?per_page=2&sort_by=title&sort_order=asc&priority=high",
    )

    assert response.status_code == HTTPStatus.OK
    assert payload["filters_applied"]["priority"] == "high"
    assert payload["pagination"]["per_page"] == 2
    assert [task["title"] for task in payload["tasks"]] == ["Plan sprint"]


def test_task_search_and_category_filter(authorized_client: AuthorizedClient):
    """Search and category filters narrow results."""
    # Apply combined search and category filters to isolate a single task
    category = _create_category(authorized_client, "Inbox")
    _post_task(
        authorized_client,
        _create_task_payload(
            title="File invoices",
            description="Monthly invoices",
            category_id=category["id"],
        ),
    )
    _post_task(
        authorized_client,
        _create_task_payload(
            title="Review budget",
            description="Quarterly budget review",
        ),
    )

    response, payload = _get_tasks(
        authorized_client,
        f"?search=invoice&category_id={category['id']}",
    )

    assert response.status_code == HTTPStatus.OK
    titles = [task["title"] for task in payload["tasks"]]
    assert titles == ["File invoices"]


def test_get_overdue_tasks(authorized_client: AuthorizedClient):
    """Overdue listing returns tasks past due date that are incomplete."""
    # Seed past/future tasks (one completed) and ensure only the overdue pending task is returned
    past_due = datetime.now(timezone.utc) - timedelta(days=2)
    future_due = datetime.now(timezone.utc) + timedelta(days=2)

    payload = _create_task_payload(
        title="Past due task",
        due_date=past_due,
    )
    response, _ = _post_task(authorized_client, payload)
    assert response.status_code == HTTPStatus.CREATED

    # Completed tasks should not appear
    response, created = _post_task(
        authorized_client,
        _create_task_payload(title="Complete soon", due_date=past_due),
    )
    task_id = created["task"]["id"]
    authorized_client.client.patch(
        f"/api/tasks/{task_id}/complete",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    # Non-overdue task
    _post_task(
        authorized_client,
        _create_task_payload(title="Future task", due_date=future_due),
    )

    overdue_response = authorized_client.client.get(
        "/api/tasks/overdue?per_page=5",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert overdue_response.status_code == HTTPStatus.OK
    overdue_tasks = overdue_response.get_json()["overdue_tasks"]
    titles = [task["title"] for task in overdue_tasks]

    assert titles == ["Past due task"]


@pytest.mark.parametrize("task_id", [999, 0])
def test_get_task_not_found(authorized_client: AuthorizedClient, task_id: int):
    """Fetching a missing task returns 404."""
    # Query an ID that does not belong to the current user to ensure 404 is returned
    response = authorized_client.client.get(
        f"/api/tasks/{task_id}",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_get_tasks_status_and_due_filters(authorized_client: AuthorizedClient):
    """GET /api/tasks supports status and due date filtering."""
    # Combine status, category, and due-date filters to confirm query param handling end-to-end
    category_response, category_payload = post_json(
        authorized_client,
        "/api/categories",
        {"name": "Filtered"},
    )
    assert category_response.status_code == HTTPStatus.CREATED
    category_id = category_payload["category"]["id"]

    today = datetime.now(timezone.utc)

    # Pending task due tomorrow
    _post_task(
        authorized_client,
        _create_task_payload(
            title="Tomorrow",
            category_id=category_id,
            due_date=today + timedelta(days=1),
        ),
    )

    # Completed task due yesterday
    response, payload = _post_task(
        authorized_client,
        _create_task_payload(
            title="Yesterday",
            category_id=category_id,
            due_date=today - timedelta(days=1),
        ),
    )
    task_id = payload["task"]["id"]
    authorized_client.client.patch(
        f"/api/tasks/{task_id}/complete",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    # Completed filter
    response, payload = _get_tasks(
        authorized_client,
        f"?status=completed&category_id={category_id}&per_page=5",
    )
    assert response.status_code == HTTPStatus.OK
    titles = {task["title"] for task in payload["tasks"]}
    assert titles == {"Yesterday"}

    # Due date range includes only pending future task
    due_after = (today - timedelta(days=0)).isoformat()
    due_before = (today + timedelta(days=2)).isoformat()
    response, payload = _get_tasks(
        authorized_client,
        f"?due_after={due_after}&due_before={due_before}&per_page=5",
    )
    assert response.status_code == HTTPStatus.OK
    titles = {task["title"] for task in payload["tasks"]}
    assert "Tomorrow" in titles

def test_delete_task_not_found(authorized_client: AuthorizedClient):
    """Deleting a missing task returns 404."""
    response = authorized_client.client.delete(
        "/api/tasks/99999",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_task_invalid_category(authorized_client: AuthorizedClient):
    """Creating with an unknown category returns 400."""
    response, body = _post_task(
        authorized_client,
        _create_task_payload(category_id=999999),
    )
    body = assert_error_response(response, HTTPStatus.BAD_REQUEST, "Validation failed")
    assert any("Category not found" in msg for msg in body["details"])
