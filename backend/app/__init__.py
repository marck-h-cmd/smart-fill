from flask import Flask
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app)  # Permitir peticiones desde el frontend

    # Registrar rutas básicas
    from .api.routes import dashboard
    app.register_blueprint(dashboard.bp)

    return app