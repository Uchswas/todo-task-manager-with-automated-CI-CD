from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from app.config import config
from app.models import db, init_db

__all__ = ('create_app', 'db')


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    CORS(app, origins=app.config['CORS_ORIGINS'])
    JWTManager(app)

    # Initialize database
    init_db(app)

    # Register blueprints
    from app.routes.auth import auth_bp 
    from app.routes.tasks import tasks_bp 
    from app.routes.categories import categories_bp 
    from app.routes.stats import stats_bp 
    from app.routes.health import health_bp 

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(categories_bp, url_prefix='/api/categories')
    app.register_blueprint(stats_bp, url_prefix='/api/stats')
    app.register_blueprint(health_bp)

    return app
