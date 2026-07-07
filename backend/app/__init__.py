import atexit
from flask import Flask
from flask_cors import CORS
from app.extensions import db
from app.services.scheduler_service import start_scheduler, stop_scheduler

def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    CORS(app)

    db.init_app(app)

    from .api.routes import dashboard, whatsapp, config_routes, databases
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(whatsapp.bp)
    app.register_blueprint(config_routes.bp)
    app.register_blueprint(databases.bp)

    with app.app_context():
        start_scheduler()

    atexit.register(stop_scheduler)

    return app
