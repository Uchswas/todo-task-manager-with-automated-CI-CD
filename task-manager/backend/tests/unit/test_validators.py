"""Unit tests for app.utils.validators helpers."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.utils import validators as validator_utils


def test_validate_task_data_success(monkeypatch):
    """All optional fields omitted; task validates cleanly."""
    mock_category = MagicMock()
    # Mock Category.query.filter_by(...).first() to confirm ownership check passes.
    mock_category.filter_by.return_value.first.return_value = SimpleNamespace(id=1)
    monkeypatch.setattr(validator_utils, "Category", SimpleNamespace(query=mock_category))

    errors = validator_utils.validate_task_data(
        {
            "title": "Task Title",
            "category_id": "1",
        },
        user_id=1,
    )

    assert not errors


def test_validate_task_data_invalid(monkeypatch):
    """Invalid task payload accumulates errors."""
    mock_category = MagicMock()
    # Simulate category lookup failing so the validator reports an invalid ID.
    mock_category.filter_by.return_value.first.return_value = None
    monkeypatch.setattr(validator_utils, "Category", SimpleNamespace(query=mock_category))

    errors = validator_utils.validate_task_data(
        {
            "title": "",
            "description": "x" * 6000,
            "priority": "urgent",
            "due_date": "not-a-date",
            "category_id": "abc",
        },
        user_id=1,
    )

    assert "Title is required" in errors
    assert "Description must be less than 5000 characters" in errors
    assert "Priority must be low, medium, or high" in errors
    assert "Invalid due date format. Use ISO format (YYYY-MM-DD)" in errors
    assert "Invalid category ID" in errors


def test_validate_category_data_success(monkeypatch):
    """Category with new name and valid color passes."""
    name_attr = MagicMock()
    name_attr.ilike.return_value = "name_ilike"

    filter_chain = MagicMock()
    filter_chain.first.return_value = None  # Represents "no duplicate found"

    query_mock = MagicMock()
    query_mock.filter_by.return_value.filter.return_value = filter_chain

    category_stub = SimpleNamespace(query=query_mock, name=name_attr)
    # monkeypatch replaces the Category model reference inside validator_utils.
    monkeypatch.setattr(validator_utils, "Category", category_stub)

    errors = validator_utils.validate_category_data(
        {
            "name": "Work",
            "color": "#AABBCC",
        },
        user_id=1,
    )

    assert not errors


def test_validate_category_data_failures(monkeypatch):
    """Category payload with issues returns error messages."""
    name_attr = MagicMock()
    name_attr.ilike.return_value = "name_ilike"

    filter_chain = MagicMock()
    filter_chain.first.return_value = True

    query_mock = MagicMock()
    query_mock.filter_by.return_value.filter.return_value = filter_chain

    category_stub = SimpleNamespace(query=query_mock, name=name_attr)
    # Inject stubbed Category so validation sees existing duplicate name.
    monkeypatch.setattr(validator_utils, "Category", category_stub)

    errors = validator_utils.validate_category_data(
        {
            "name": " " * 2,
            "color": "not-a-color",
        },
        user_id=1,
    )

    assert "Category name is required" in errors
    assert "Color must be a valid hex color code (e.g., #FF5733)" in errors


def test_validate_category_data_duplicate_name(monkeypatch):
    """Duplicate category names for the same user are rejected."""
    name_attr = MagicMock()
    name_attr.ilike.return_value = "name_ilike"

    filter_chain = MagicMock()
    filter_chain.first.return_value = True

    query_mock = MagicMock()
    query_mock.filter_by.return_value.filter.return_value = filter_chain

    category_stub = SimpleNamespace(query=query_mock, name=name_attr)
    # The monkeypatched Category now yields a duplicate record on lookup.
    monkeypatch.setattr(validator_utils, "Category", category_stub)

    errors = validator_utils.validate_category_data(
        {
            "name": "Work",
            "color": "#AABBCC",
        },
        user_id=1,
    )

    assert "Category name already exists" in errors


def test_validate_pagination_params_clamps():
    """Pagination parameters are normalized to allowed ranges."""
    page, per_page = validator_utils.validate_pagination_params({"page": "-3", "per_page": "500"})
    assert page == 1
    assert per_page == 100


@pytest.mark.parametrize(
    "args, expected",
    [
        (
            {"status": "completed", "priority": "high", "category_id": "3"},
            {
                "is_completed": True,
                "priority": "high",
                "category_id": 3,
                "sort_by": "created_at",
                "sort_order": "desc",
            },
        ),
        (
            {"due_before": "2024-01-01", "due_after": "2023-12-01", "search": "test"},
            {
                "due_before": datetime(2024, 1, 1).date(),
                "due_after": datetime(2023, 12, 1).date(),
                "search": "test",
                "sort_by": "created_at",
                "sort_order": "desc",
            },
        ),
    ],
)
def test_validate_task_filters_valid(args, expected):
    """Valid query string parameters are parsed correctly."""
    result = validator_utils.validate_task_filters(args)
    for key, value in expected.items():
        assert result[key] == value


def test_validate_task_filters_invalid_values():
    """Invalid filter values are ignored."""
    result = validator_utils.validate_task_filters(
        {
            "status": "unknown",
            "priority": "invalid",
            "category_id": "bad",
            "due_before": "bad-date",
            "due_after": "bad-date",
            "sort_by": "random",
            "sort_order": "up",
            "search": "  ",
        }
    )

    assert result["sort_by"] == "created_at"
    assert result["sort_order"] == "desc"
    assert "is_completed" not in result
    assert "priority" not in result
    assert "category_id" not in result
    assert "due_before" not in result
    assert "due_after" not in result
    assert "search" not in result
