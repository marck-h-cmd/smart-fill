from flask import Flask
from flask_cors import CORS
from app.utils.db_connector import init_db

def create_app():
    app = Flask(__name__)
    CORS(app)
    init_db(app)  # Inicializar conexión

    from .api.routes import dashboard
    app.register_blueprint(dashboard.bp)

    return app