"""Unit tests for model helper behaviour."""

from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import Task, User


def test_user_password_helpers():
    """User password hashing and verification helpers work as expected."""
    user = User(email="test@example.com", name="Tester")

    user.set_password("Password123")

    assert user.password_hash != "Password123"
    assert user.check_password("Password123")
    assert not user.check_password("WrongPassword")


def test_user_to_dict_formats_datetime():
    """User.to_dict produces ISO formatted timestamp."""

    created = datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    user = User(email="test@example.com", name="Tester", created_at=created)

    payload = user.to_dict()

    assert payload["created_at"] == created.isoformat()
    assert payload["email"] == "test@example.com"
    assert payload["name"] == "Tester"


@pytest.mark.parametrize(
    ("due_date", "is_completed", "expected"),
    [
        (date.today(), False, False),
        (date.today(), True, False),
        (date.today() + timedelta(days=1), False, False),
        (date.today() - timedelta(days=1), False, True),
    ],
)
def test_task_is_overdue(due_date, is_completed, expected):
    """Task.is_overdue reflects due date and completion status."""
    task = Task(user_id=1, title="Test Task", due_date=due_date, is_completed=is_completed)

    assert task.is_overdue is expected


def test_task_is_overdue_without_due_date():
    """Tasks without due dates are not overdue."""
    task = Task(user_id=1, title="No Due Date")

    assert task.is_overdue is False


def test_task_mark_completed_and_incomplete():
    """Completion helpers toggle state and timestamps."""
    task = Task(user_id=1, title="Task")

    before_mark = datetime.now(timezone.utc)
    task.mark_completed()
    after_mark = datetime.now(timezone.utc)

    assert task.is_completed is True
    assert task.completed_at is not None
    assert before_mark <= task.completed_at <= after_mark

    task.mark_incomplete()
    assert task.is_completed is False
    assert task.completed_at is None
