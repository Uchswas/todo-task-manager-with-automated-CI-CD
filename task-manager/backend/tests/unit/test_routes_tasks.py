"""Unit tests for app.routes.tasks handlers."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, ANY
from sqlalchemy.exc import SQLAlchemyError

from app.routes import tasks as tasks_routes


def _request_args_stub(**mapping):
    """Create a mapping with get method that mimics Flask request.args."""

    class ArgsStub(dict):
        """Minimal mapping supporting Flask-style get with default."""
        def get(self, key, default=None):
            return super().get(key, default)

    return ArgsStub(mapping)


def _json_stub(data):
    """Return an object with get_json method returning provided data."""
    return SimpleNamespace(get_json=lambda: data)


def _jsonify_stub():
    """Return a fake jsonify that records payload in a simple namespace."""

    def _jsonify(payload):
        return SimpleNamespace(json=payload)

    return _jsonify


class ColumnStub:
    """Lightweight substitute for SQLAlchemy column expressions."""

    def __init__(self, name):
        self.name = name

    def __eq__(self, other):
        return (self.name, "==", other)

    def __le__(self, other):
        return (self.name, "<=", other)

    def __ge__(self, other):
        return (self.name, ">=", other)

    def __lt__(self, other):
        return (self.name, "<", other)

    def is_(self, other):
        """Return tuple describing is_ comparison for mocking."""
        return (self.name, "is", other)

    def ilike(self, pattern):
        """Return tuple describing ilike call for mocking."""
        return (self.name, "ilike", pattern)

    def asc(self):
        """Return tuple describing ascending ordering for mocking."""
        return (self.name, "asc")


def _task_model_stub(query):
    """Create a Task substitute exposing query and column attributes."""
    return SimpleNamespace(
        query=query,
        is_completed=ColumnStub("is_completed"),
        priority=ColumnStub("priority"),
        category_id=ColumnStub("category_id"),
        due_date=ColumnStub("due_date"),
        title=ColumnStub("title"),
        description=ColumnStub("description"),
        created_at=ColumnStub("created_at"),
        updated_at=ColumnStub("updated_at"),
        user_id=ColumnStub("user_id"),
    )


def test_get_tasks_success(monkeypatch):
    """GET /tasks returns serialized tasks with pagination info."""
    request_args = _request_args_stub(page="1", per_page="10")
    validate_pagination = MagicMock(return_value=(1, 10))
    validate_filters = MagicMock(return_value={"sort_by": "created_at", "sort_order": "desc"})

    task_obj = SimpleNamespace(to_dict=lambda: {"id": 1})
    pagination_stub = SimpleNamespace(
        items=[task_obj],
        total=1,
        pages=1,
        has_next=False,
        has_prev=False,
    )
    query_stub = MagicMock()
    query_stub.filter_by.return_value = query_stub
    query_stub.filter.return_value = query_stub
    query_stub.order_by.return_value = query_stub
    query_stub.paginate.return_value = pagination_stub

    # Patch request/validation helpers so we drive only the handler logic.
    monkeypatch.setattr(tasks_routes, "request", SimpleNamespace(args=request_args))
    monkeypatch.setattr(tasks_routes, "validate_pagination_params", validate_pagination)
    monkeypatch.setattr(tasks_routes, "validate_task_filters", validate_filters)
    monkeypatch.setattr(tasks_routes, "Task", _task_model_stub(query_stub))
    monkeypatch.setattr(tasks_routes, "desc", lambda col: ("desc", col), raising=False)
    monkeypatch.setattr(tasks_routes, "asc", lambda col: ("asc", col), raising=False)
    monkeypatch.setattr(tasks_routes, "or_", lambda *clauses: ("or", clauses), raising=False)
    meta_stub = {"page": 1}
    monkeypatch.setattr(
        tasks_routes,
        "paginate_sorted_query",
        MagicMock(return_value=pagination_stub),
    )
    monkeypatch.setattr(
        tasks_routes,
        "build_pagination_metadata",
        MagicMock(return_value=meta_stub),
    )
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.get_tasks.__wrapped__(current_user)

    validate_pagination.assert_called_once()
    validate_filters.assert_called_once()
    query_stub.filter_by.assert_called_with(user_id=current_user.id)

    assert status == 200
    assert response.json["tasks"] == [{"id": 1}]
    assert response.json["pagination"] == meta_stub


def test_get_tasks_failure(monkeypatch):
    """GET /tasks returns error when an exception is raised."""
    request_args = _request_args_stub()
    # Force the query to raise SQLAlchemyError to trigger failure path.
    monkeypatch.setattr(tasks_routes, "request", SimpleNamespace(args=request_args))
    monkeypatch.setattr(tasks_routes, "validate_pagination_params", MagicMock(return_value=(1, 10)))
    query_stub = MagicMock()
    query_stub.filter_by.side_effect = SQLAlchemyError("db error")
    monkeypatch.setattr(tasks_routes, "Task", _task_model_stub(query_stub))
    monkeypatch.setattr(tasks_routes, "desc", lambda col: ("desc", col), raising=False)
    monkeypatch.setattr(tasks_routes, "asc", lambda col: ("asc", col), raising=False)
    monkeypatch.setattr(tasks_routes, "or_", lambda *clauses: ("or", clauses), raising=False)
    monkeypatch.setattr(tasks_routes, "paginate_sorted_query", MagicMock())
    monkeypatch.setattr(tasks_routes, "build_pagination_metadata", MagicMock())
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.get_tasks.__wrapped__(current_user)

    assert status == 500
    assert response.json["error"] == "Failed to get tasks"


def test_create_task_success(monkeypatch):
    """POST /tasks creates a task and returns payload."""
    payload = {
        "title": "Task",
        "description": "Some text",
        "priority": "low",
        "due_date": datetime.now().isoformat(),
        "category_id": "2",
    }
    task_instance = SimpleNamespace(to_dict=lambda: {"id": 10})

    validate_task_data = MagicMock(return_value=[])
    session_mock = MagicMock()
    # Pretend JSON body parsing and commit helpers succeed without touching real DB.
    monkeypatch.setattr(tasks_routes, "load_json_payload", MagicMock(return_value=(payload, None)))
    monkeypatch.setattr(tasks_routes, "validate_task_data", validate_task_data)
    task_factory = MagicMock(return_value=task_instance)
    monkeypatch.setattr(tasks_routes, "Task", task_factory)
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(tasks_routes, "db", SimpleNamespace(session=session_mock))
    commit_helper = MagicMock(return_value=None)  # Commit helper returns success sentinel.
    monkeypatch.setattr(tasks_routes, "commit_with_handling", commit_helper)
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.create_task.__wrapped__(current_user)

    validate_task_data.assert_called_once()
    session_mock.add.assert_called_once_with(task_instance)
    commit_helper.assert_called_once_with(
        session_mock,
        ANY,
        "Failed to create task",
    )
    assert status == 201
    assert response.json["task"] == {"id": 10}


def test_create_task_validation_error(monkeypatch):
    """POST /tasks returns 400 when validation fails."""
    validate_task_data = MagicMock(return_value=["error"])
    # Deliver invalid payload via load_json_payload stub.
    monkeypatch.setattr(
        tasks_routes,
        "load_json_payload",
        MagicMock(return_value=({"title": ""}, None)),
    )
    monkeypatch.setattr(tasks_routes, "validate_task_data", validate_task_data)
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.create_task.__wrapped__(current_user)

    assert status == 400
    assert response.json["details"] == ["error"]


def test_get_task_found(monkeypatch):
    """GET /tasks/<id> returns the requested task."""
    task_instance = SimpleNamespace(to_dict=lambda: {"id": 5})
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = task_instance

    # Fake the ORM lookup to avoid database dependency.
    monkeypatch.setattr(tasks_routes, "Task", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.get_task.__wrapped__(current_user, task_id=5)

    assert status == 200
    assert response.json["task"] == {"id": 5}


def test_get_task_not_found(monkeypatch):
    """GET /tasks/<id> returns 404 when task missing."""
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = None
    monkeypatch.setattr(tasks_routes, "Task", SimpleNamespace(query=query_mock))
    # Emulate 404 branch where task lookup returns nothing.
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.get_task.__wrapped__(current_user, task_id=99)

    assert status == 404
    assert response.json["error"] == "Task not found"


def test_get_task_database_error(monkeypatch):
    """GET /tasks/<id> returns 500 on database error."""
    query_mock = MagicMock()
    query_mock.filter_by.side_effect = SQLAlchemyError("db boom")
    # Force ORM call to raise SQLAlchemyError so handler returns 500.
    monkeypatch.setattr(tasks_routes, "Task", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.get_task.__wrapped__(current_user, task_id=1)

    assert status == 500
    assert response.json["error"] == "Failed to get task"


def test_update_task_success(monkeypatch):
    """PUT /tasks/<id> updates fields and saves."""
    task_instance = MagicMock()
    task_instance.to_dict.return_value = {"id": 7}
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = task_instance

    payload = {
        "title": "Updated",
        "description": "New desc",
        "priority": "high",
        "due_date": "",
    }

    # Stub JSON parsing, validation, and commit flow to isolate handler logic.
    monkeypatch.setattr(tasks_routes, "Task", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(
        tasks_routes,
        "load_json_payload",
        MagicMock(return_value=(payload, None)),
    )
    monkeypatch.setattr(
        tasks_routes,
        "_validate_and_apply_task_update",
        MagicMock(return_value=(None, None)),
    )
    finalize_helper = MagicMock(return_value=None)  # Simulate commit + response finalization.
    monkeypatch.setattr(tasks_routes, "finalize_commit_response", finalize_helper)
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    session_mock = MagicMock()
    monkeypatch.setattr(tasks_routes, "db", SimpleNamespace(session=session_mock))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.update_task.__wrapped__(current_user, task_id=7)

    finalize_helper.assert_called_once_with(
        None,
        session_mock,
        ANY,
        "Failed to update task",
    )
    assert status == 200
    assert response.json["task"] == {"id": 7}


def test_update_task_not_found(monkeypatch):
    """PUT /tasks/<id> returns 404 when task absent."""
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = None
    monkeypatch.setattr(tasks_routes, "Task", SimpleNamespace(query=query_mock))
    # No payload is needed because handler exits before parsing JSON.
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    # Provide a logger stub so commit helper logging path works without app context.
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.update_task.__wrapped__(current_user, task_id=7)

    assert status == 404
    assert response.json["error"] == "Task not found"


def test_delete_task_success(monkeypatch):
    """DELETE /tasks/<id> removes task and returns confirmation."""
    task_instance = MagicMock()
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = task_instance

    session_mock = MagicMock()
    # Replace commit helper so delete path executes without real DB.
    monkeypatch.setattr(tasks_routes, "db", SimpleNamespace(session=session_mock))
    monkeypatch.setattr(
        tasks_routes,
        "Task",
        SimpleNamespace(query=query_mock),
    )  # Avoid real ORM call.
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    commit_helper = MagicMock(return_value=None)
    monkeypatch.setattr(tasks_routes, "commit_with_handling", commit_helper)
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.delete_task.__wrapped__(current_user, task_id=11)

    session_mock.delete.assert_called_once_with(task_instance)
    commit_helper.assert_called_once_with(session_mock, ANY, "Failed to delete task")
    assert status == 200
    assert response.json["message"] == "Task deleted successfully"


def test_toggle_task_completion(monkeypatch):
    """PATCH /tasks/<id>/complete toggles completion state."""
    task_instance = MagicMock()
    task_instance.to_dict.return_value = {"id": 3}
    task_instance.is_completed = False

    def mark_completed():
        task_instance.is_completed = True

    def mark_incomplete():
        task_instance.is_completed = False

    task_instance.mark_completed.side_effect = mark_completed
    task_instance.mark_incomplete.side_effect = mark_incomplete

    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = task_instance
    monkeypatch.setattr(
        tasks_routes,
        "Task",
        SimpleNamespace(query=query_mock),
    )  # Avoid real ORM call.

    session_mock = MagicMock()
    monkeypatch.setattr(
        tasks_routes,
        "db",
        SimpleNamespace(session=session_mock),
    )  # Fake db.session usage.
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    commit_helper = MagicMock(return_value=None)
    monkeypatch.setattr(tasks_routes, "commit_with_handling", commit_helper)
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.toggle_task_completion.__wrapped__(current_user, task_id=3)

    commit_helper.assert_called_once_with(session_mock, ANY, "Failed to toggle task completion")
    task_instance.mark_completed.assert_called_once()
    assert status == 200
    assert response.json["task"] == {"id": 3}


def test_toggle_task_completion_not_found(monkeypatch):
    """PATCH /tasks/<id>/complete returns 404 when task does not exist."""
    query_mock = MagicMock()
    query_mock.filter_by.return_value.first.return_value = None
    # Simulate missing task by returning None from query.
    monkeypatch.setattr(tasks_routes, "Task", SimpleNamespace(query=query_mock))
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.toggle_task_completion.__wrapped__(current_user, task_id=3)

    assert status == 404
    assert response.json["error"] == "Task not found"


def test_get_overdue_tasks_success(monkeypatch):
    """GET /tasks/overdue returns overdue tasks list."""
    request_args = _request_args_stub(page="1", per_page="5")
    paginate_stub = SimpleNamespace(
        items=[SimpleNamespace(to_dict=lambda: {"id": 2})],
        total=1,
        pages=1,
        has_next=False,
        has_prev=False,
    )

    query_mock = MagicMock()
    query_mock.filter.return_value = query_mock
    query_mock.order_by.return_value = query_mock
    query_mock.paginate.return_value = paginate_stub

    # Stub ORM helpers and datetime so the overdue query can run deterministically.
    monkeypatch.setattr(tasks_routes, "request", SimpleNamespace(args=request_args))
    monkeypatch.setattr(tasks_routes, "validate_pagination_params", MagicMock(return_value=(1, 5)))
    monkeypatch.setattr(tasks_routes, "Task", _task_model_stub(query_mock))
    monkeypatch.setattr(tasks_routes, "and_", lambda *conds: ("and", conds), raising=False)
    monkeypatch.setattr(tasks_routes, "desc", lambda col: ("desc", col), raising=False)
    monkeypatch.setattr(tasks_routes, "asc", lambda col: ("asc", col), raising=False)
    fixed_now = datetime(2024, 1, 10, 12, 0, 0)
    monkeypatch.setattr(tasks_routes, "datetime", SimpleNamespace(now=lambda: fixed_now))
    monkeypatch.setattr(tasks_routes, "jsonify", _jsonify_stub())
    monkeypatch.setattr(tasks_routes, "current_app", SimpleNamespace(logger=MagicMock()))

    current_user = SimpleNamespace(id=1)
    response, status = tasks_routes.get_overdue_tasks.__wrapped__(current_user)

    assert status == 200
    assert response.json["overdue_tasks"] == [{"id": 2}]
