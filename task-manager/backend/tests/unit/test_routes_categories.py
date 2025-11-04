"""Unit tests for app.routes.categories handlers."""

from types import SimpleNamespace
from unittest.mock import MagicMock, ANY

from sqlalchemy.exc import SQLAlchemyError

from app.routes import categories as categories_routes


def _jsonify_stub():
    """Return a fake jsonify capturing payload."""

    def _jsonify(payload):
        return SimpleNamespace(json=payload)

    return _jsonify


def _request_args_stub(**mapping):
    """Minimal dict-like object with Flask-style get method."""

    class ArgsStub(dict):
        """Dict wrapper mimicking Flask's MultiDict get semantics."""

        def get(self, key, default=None):
            return super().get(key, default)

    return ArgsStub(mapping)


def _category_model_stub(query):
    """Expose query attribute and minimal columns for Category model."""
    return SimpleNamespace(
        query=query,
        name=MagicMock(),
        color=MagicMock(),
    )


def _task_model_stub(query):
    """Expose query attribute for Task model."""
    return SimpleNamespace(query=query)


def test_get_categories_success(monkeypatch):
    """GET /categories returns serialized categories."""
    cat_stub = SimpleNamespace(to_dict=lambda: {"id": 1})
    query_mock = MagicMock()
    query_mock.filter_by.return_value.order_by.return_value.all.return_value = [cat_stub]

    # Patch Category model and jsonify so handler can run purely in unit context.
    category_stub = _category_model_stub(query_mock)
    monkeypatch.setattr(categories_routes, "Category", category_stub)
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_categories.__wrapped__(current_user)

    query_mock.filter_by.assert_called_with(user_id=current_user.id)
    assert status == 200
    assert response.json["categories"] == [{"id": 1}]


def test_get_categories_failure(monkeypatch):
    """GET /categories returns 500 when query fails."""
    query_mock = MagicMock()
    query_mock.filter_by.side_effect = SQLAlchemyError("db error")

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_categories.__wrapped__(current_user)

    assert status == 500
    assert response.json["error"] == "Failed to get categories"


def test_create_category_success(monkeypatch):
    """POST /categories creates a category."""
    payload = {"name": "Work", "color": "#FFFFFF"}
    category_instance = SimpleNamespace(to_dict=lambda: {"id": 5})

    session_mock = MagicMock()
    monkeypatch.setattr(
        categories_routes,
        "load_json_payload",
        MagicMock(return_value=(payload, None)),
    )
    monkeypatch.setattr(
        categories_routes,
        "validate_category_data",
        MagicMock(return_value=[]),
    )
    monkeypatch.setattr(categories_routes, "Category", MagicMock(return_value=category_instance))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "db", SimpleNamespace(session=session_mock))
    commit_helper = MagicMock(return_value=None)
    monkeypatch.setattr(categories_routes, "commit_with_handling", commit_helper)
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.create_category.__wrapped__(current_user)

    session_mock.add.assert_called_once_with(category_instance)
    commit_helper.assert_called_once_with(session_mock, ANY, "Failed to create category")
    assert status == 201
    assert response.json["category"] == {"id": 5}


def test_create_category_validation_error(monkeypatch):
    """POST /categories returns 400 when validation fails."""
    monkeypatch.setattr(
        categories_routes,
        "load_json_payload",
        MagicMock(return_value=({"name": ""}, None)),
    )
    monkeypatch.setattr(
        categories_routes,
        "validate_category_data",
        MagicMock(return_value=["bad"]),
    )
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.create_category.__wrapped__(current_user)

    assert status == 400
    assert response.json["details"] == ["bad"]


def test_get_category_found(monkeypatch):
    """GET /categories/<id> returns category details."""
    cat_stub = SimpleNamespace(to_dict=lambda: {"id": 4})
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = cat_stub

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_category.__wrapped__(current_user, category_id=4)

    assert status == 200
    assert response.json["category"] == {"id": 4}


def test_get_category_not_found(monkeypatch):
    """GET /categories/<id> returns 404 when missing."""
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = None

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_category.__wrapped__(current_user, category_id=9)

    assert status == 404
    assert response.json["error"] == "Category not found"


def test_get_category_failure(monkeypatch):
    """GET /categories/<id> returns 500 when query fails."""
    query_mock = MagicMock()
    query_mock.filter_by.side_effect = SQLAlchemyError("db error")

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_category.__wrapped__(current_user, category_id=2)

    assert status == 500
    assert response.json["error"] == "Failed to get category"


def test_update_category_success(monkeypatch):
    """PUT /categories/<id> updates category successfully."""
    cat_stub = SimpleNamespace(to_dict=lambda: {"id": 7})
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = cat_stub

    payload = {"name": "Updated"}

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(
        categories_routes,
        "load_json_payload",
        MagicMock(return_value=(payload, None)),
    )
    monkeypatch.setattr(
        categories_routes,
        "_apply_category_updates",
        MagicMock(return_value=(None, None)),
    )
    finalize_helper = MagicMock(return_value=None)
    monkeypatch.setattr(categories_routes, "finalize_commit_response", finalize_helper)
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))
    monkeypatch.setattr(categories_routes, "db", SimpleNamespace(session=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.update_category.__wrapped__(current_user, category_id=7)

    finalize_helper.assert_called_once_with(
        None,
        categories_routes.db.session,
        ANY,
        "Failed to update category",
    )
    assert status == 200
    assert response.json["category"] == {"id": 7}


def test_update_category_not_found(monkeypatch):
    """PUT /categories/<id> returns 404 when category missing."""
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = None

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.update_category.__wrapped__(current_user, category_id=99)

    assert status == 404
    assert response.json["error"] == "Category not found"


def test_update_category_failure(monkeypatch):
    """PUT /categories/<id> returns 500 on query failure."""
    query_mock = MagicMock()
    query_mock.filter_by.side_effect = SQLAlchemyError("db error")

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.update_category.__wrapped__(current_user, category_id=1)

    assert status == 500
    assert response.json["error"] == "Failed to update category"


def test_delete_category_success(monkeypatch):
    """DELETE /categories/<id> removes category when no tasks."""
    cat_stub = SimpleNamespace()
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = cat_stub
    task_query_mock = MagicMock()
    task_query_mock.filter_by.return_value.count.return_value = 0

    session_mock = MagicMock()
    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "Task", SimpleNamespace(query=task_query_mock))
    monkeypatch.setattr(categories_routes, "db", SimpleNamespace(session=session_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    commit_helper = MagicMock(return_value=None)
    monkeypatch.setattr(categories_routes, "commit_with_handling", commit_helper)
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.delete_category.__wrapped__(current_user, category_id=5)

    session_mock.delete.assert_called_once_with(cat_stub)
    commit_helper.assert_called_once_with(
        categories_routes.db.session,
        ANY,
        "Failed to delete category",
    )
    assert status == 200
    assert response.json["message"] == "Category deleted successfully"


def test_delete_category_with_tasks(monkeypatch):
    """DELETE /categories/<id> rejects deletion when tasks exist."""
    cat_stub = SimpleNamespace()
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = cat_stub
    task_query_mock = MagicMock()
    task_query_mock.filter_by.return_value.count.return_value = 3

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "Task", SimpleNamespace(query=task_query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.delete_category.__wrapped__(current_user, category_id=5)

    assert status == 400
    assert response.json["error"] == "Cannot delete category with existing tasks"


def test_delete_category_not_found(monkeypatch):
    """DELETE /categories/<id> returns 404 when missing."""
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = None

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.delete_category.__wrapped__(current_user, category_id=12)

    assert status == 404
    assert response.json["error"] == "Category not found"


def test_get_category_tasks_success(monkeypatch):
    """GET /categories/<id>/tasks returns tasks with pagination."""
    cat_stub = SimpleNamespace(to_dict=lambda: {"id": 8})
    category_query = MagicMock()
    category_query.filter_by.return_value.first.return_value = cat_stub

    task_stub = SimpleNamespace(to_dict=lambda: {"id": 2})
    pagination_stub = SimpleNamespace(items=[task_stub])
    task_query = MagicMock()
    task_query.filter_by.return_value = task_query
    task_query.order_by.return_value = task_query
    monkeypatch.setattr(
        categories_routes,
        "paginate_sorted_query",
        MagicMock(return_value=pagination_stub),
    )

    category_stub = _category_model_stub(category_query)
    task_stub_model = SimpleNamespace(
        query=task_query,
        created_at=MagicMock(),
        due_date=MagicMock(),
        priority=MagicMock(),
        title=MagicMock(),
        updated_at=MagicMock(),
    )
    monkeypatch.setattr(categories_routes, "Category", category_stub)
    monkeypatch.setattr(categories_routes, "Task", task_stub_model)
    monkeypatch.setattr(
        categories_routes,
        "request",
        SimpleNamespace(args=_request_args_stub(sort_by="title", sort_order="asc")),
    )
    monkeypatch.setattr(
        categories_routes,
        "validate_pagination_params",
        MagicMock(return_value=(1, 20)),
    )
    monkeypatch.setattr(
        categories_routes,
        "build_pagination_metadata",
        MagicMock(return_value={"page": 1}),
    )
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_category_tasks.__wrapped__(current_user, category_id=8)

    assert status == 200
    assert response.json["category"] == {"id": 8}
    assert response.json["tasks"] == [{"id": 2}]


def test_get_category_tasks_category_missing(monkeypatch):
    """GET /categories/<id>/tasks returns 404 if category not owned."""
    category_query = MagicMock()
    category_query.filter_by.return_value.first.return_value = None

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=category_query))
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "request", SimpleNamespace(args=_request_args_stub()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_category_tasks.__wrapped__(current_user, category_id=8)

    assert status == 404
    assert response.json["error"] == "Category not found"


def test_get_category_tasks_failure(monkeypatch):
    """GET /categories/<id>/tasks returns 500 on query error."""
    cat_stub = SimpleNamespace(to_dict=lambda: {"id": 3})
    category_query = MagicMock()
    category_query.filter_by.return_value.first.return_value = cat_stub
    task_query = MagicMock()
    task_query.filter_by.side_effect = SQLAlchemyError("fail")

    monkeypatch.setattr(categories_routes, "Category", SimpleNamespace(query=category_query))
    monkeypatch.setattr(categories_routes, "Task", SimpleNamespace(query=task_query))
    monkeypatch.setattr(
        categories_routes,
        "request",
        SimpleNamespace(args=_request_args_stub()),
    )
    monkeypatch.setattr(
        categories_routes,
        "validate_pagination_params",
        MagicMock(return_value=(1, 20)),
    )
    monkeypatch.setattr(categories_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(categories_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = categories_routes.get_category_tasks.__wrapped__(current_user, category_id=3)

    assert status == 500
    assert response.json["error"] == "Failed to get category tasks"
