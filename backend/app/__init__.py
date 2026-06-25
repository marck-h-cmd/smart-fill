from flask import Flask
from flask_cors import CORS
from app.extensions import db

def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    CORS(app)
    
    # Inicializar base de datos con SQLAlchemy
    db.init_app(app)

    # Registro de blueprints
    from .api.routes import dashboard, whatsapp
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(whatsapp.bp)

    return app