"""Integration tests for category management endpoints."""

from __future__ import annotations

from http import HTTPStatus
from uuid import uuid4
from app.models import Category, db
from tests.integration.conftest import AuthorizedClient
from tests.integration.helpers import assert_error_response, get_json, post_json


def _create_category(client: AuthorizedClient, name: str | None = None, color: str | None = None):
    payload = {
        "name": name or f"Category {uuid4().hex[:6]}",
    }
    if color is not None:
        payload["color"] = color

    return post_json(client, "/api/categories", payload)


def _create_task(client: AuthorizedClient, title: str, category_id: int | None = None):
    payload = {
        "title": title,
    }
    if category_id is not None:
        payload["category_id"] = category_id

    return post_json(client, "/api/tasks", payload)


def test_list_categories_returns_defaults(authorized_client: AuthorizedClient):
    """GET /api/categories returns default categories after registration."""
    # Every new account is seeded with defaults; verify the endpoint exposes them
    response, payload = get_json(authorized_client, "/api/categories")

    assert response.status_code == HTTPStatus.OK
    names = {category["name"] for category in payload["categories"]}

    assert {"Work", "Personal", "Shopping", "Health"}.issubset(names)


def test_create_update_delete_category(authorized_client: AuthorizedClient, flask_app):
    """Full lifecycle for category creation, update, and deletion."""
    # Walk through create -> update -> delete and confirm final DB state is empty
    response, payload = _create_category(authorized_client, name="Planning")

    assert response.status_code == HTTPStatus.CREATED
    category_id = payload["category"]["id"]

    update_response = authorized_client.client.put(
        f"/api/categories/{category_id}",
        json={"name": "Strategic Planning", "color": "#123456"},
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert update_response.status_code == HTTPStatus.OK
    updated = update_response.get_json()["category"]
    assert updated["name"] == "Strategic Planning"
    assert updated["color"] == "#123456"

    delete_response = authorized_client.client.delete(
        f"/api/categories/{category_id}",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert delete_response.status_code == HTTPStatus.OK

    with flask_app.app_context():
        assert db.session.get(Category, category_id) is None


def test_duplicate_name_error(authorized_client: AuthorizedClient):
    """Creating a category with an existing name returns 400."""
    # Attempting to reuse a category name for the same user should be rejected by the API
    response, _ = _create_category(authorized_client, name="Work")

    assert response.status_code == HTTPStatus.BAD_REQUEST
    payload = response.get_json()
    assert payload["error"] == "Validation failed"
    assert "Category name already exists" in payload["details"]


def test_create_category_invalid_color(authorized_client: AuthorizedClient):
    """Invalid color payload returns 400."""
    # Supply a non-hex color string and ensure validation feedback includes color guidance
    response, payload = post_json(
        authorized_client,
        "/api/categories",
        {"name": "Invalid", "color": "not-a-color"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert payload["error"] == "Validation failed"
    assert any("Color" in msg for msg in payload["details"])


def test_delete_category_blocked_when_tasks_exist(authorized_client: AuthorizedClient):
    """Deleting a category with tasks should yield a 400 response."""
    # Attach a task to a category to confirm the guard preventing accidental data loss
    response, payload = _create_category(authorized_client, name="Assignments")
    assert response.status_code == HTTPStatus.CREATED
    category_id = payload["category"]["id"]

    task_response, _ = _create_task(
        authorized_client,
        title="Finish report",
        category_id=category_id,
    )
    assert task_response.status_code == HTTPStatus.CREATED

    delete_response = authorized_client.client.delete(
        f"/api/categories/{category_id}",
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    assert delete_response.status_code == HTTPStatus.BAD_REQUEST
    error = delete_response.get_json()
    assert error["error"] == "Cannot delete category with existing tasks"


def test_get_category_tasks_supports_pagination(authorized_client: AuthorizedClient):
    """Category task listing respects pagination, sorting, and filters."""
    # Seed several tasks and confirm the first page respects sort order and pagination metadata
    response, payload = _create_category(authorized_client, name="Reading List")
    assert response.status_code == HTTPStatus.CREATED
    category_id = payload["category"]["id"]

    titles = ["Article A", "Article B", "Article C"]
    for title in titles:
        task_response, _ = _create_task(
            authorized_client,
            title=title,
            category_id=category_id,
        )
        assert task_response.status_code == HTTPStatus.CREATED

    listing, payload = get_json(
        authorized_client,
        f"/api/categories/{category_id}/tasks?per_page=2&sort_by=title&sort_order=asc",
    )

    assert listing.status_code == HTTPStatus.OK
    task_titles = [task["title"] for task in payload["tasks"]]

    assert task_titles == ["Article A", "Article B"]
    assert payload["pagination"]["has_next"] is True



def test_update_category_no_data(authorized_client: AuthorizedClient):
    """Updating a category with no payload returns 400."""
    # Sending an empty JSON body should trigger the "no data" guard clause
    _, payload = _create_category(authorized_client, name="Empty Update")
    category_id = payload["category"]["id"]

    update = authorized_client.client.put(
        f"/api/categories/{category_id}",
        json={},
        headers=authorized_client.headers,
        follow_redirects=False,
    )

    body = assert_error_response(update, HTTPStatus.BAD_REQUEST, "No data provided")
    assert "details" not in body

def test_get_category_not_found(authorized_client: AuthorizedClient):
    """Requesting a missing category returns 404."""
    response = authorized_client.client.get(
        "/api/categories/99999",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_delete_category_not_found(authorized_client: AuthorizedClient):
    """Deleting a missing category returns 404."""
    response = authorized_client.client.delete(
        "/api/categories/99999",
        headers=authorized_client.headers,
        follow_redirects=False,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND
