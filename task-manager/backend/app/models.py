from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    tasks = db.relationship(
        'Task',
        backref='user',
        lazy=True,
        cascade='all, delete-orphan',
    )
    categories = db.relationship(
        'Category',
        backref='user',
        lazy=True,
        cascade='all, delete-orphan',
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<User {self.email}>'


class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), nullable=True)  # Hex color code like #FF5733
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    tasks = db.relationship('Task', backref='category', lazy=True)

    # Unique constraint: user can't have duplicate category names
    __table_args__ = (db.UniqueConstraint('user_id', 'name', name='unique_user_category'),)

    def to_dict(self):
        # Check if the object is bound to a session to avoid DetachedInstanceError
        task_count = 0
        if inspect(self).session is not None:
            task_count = len(self.tasks) if self.tasks else 0

        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat(),
            'task_count': task_count,
        }

    def __repr__(self):
        return f'<Category {self.name}>'


class Task(db.Model):
    __tablename__ = 'tasks'

    PRIORITY_CHOICES = ['low', 'medium', 'high']

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True, index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    priority = db.Column(
        db.Enum(*PRIORITY_CHOICES, name='priority_enum'),
        default='medium',
        nullable=False,
    )
    due_date = db.Column(db.Date, nullable=True, index=True)
    is_completed = db.Column(db.Boolean, default=False, nullable=False, index=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def mark_completed(self):
        self.is_completed = True
        self.completed_at = datetime.now(timezone.utc)

    def mark_incomplete(self):
        self.is_completed = False
        self.completed_at = None

    @property
    def is_overdue(self):
        if not self.due_date or self.is_completed:
            return False
        return self.due_date < datetime.now(timezone.utc).date()

    def to_dict(self):
        # Check if the object is bound to a session to avoid DetachedInstanceError
        category_name = None
        if inspect(self).session is not None:
            category_name = self.category.name if self.category else None

        return {
            'id': self.id,
            'user_id': self.user_id,
            'category_id': self.category_id,
            'category_name': category_name,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'is_completed': self.is_completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_overdue': self.is_overdue,
        }

    def __repr__(self):
        return f'<Task {self.title}>'


def init_db(app):
    db.init_app(app)

    with app.app_context():
        db.create_all()
