from flask import Blueprint, jsonify
from app.models.base import TablaMetricas

bp = Blueprint('dashboard', __name__, url_prefix='/api')

@bp.route('/status', methods=['GET'])
def status():
    return jsonify({"message": "SmartFill Backend funcionando correctamente"})

@bp.route('/test-db', methods=['GET'])
def test_db():
    try:
        # Consultamos las tablas de SQLite usando SQLAlchemy para validar
        tablas = TablaMetricas.query.all()
        return jsonify({
            "status": "success",
            "message": f"Conectado a SQLite exitosamente. Hay {len(tablas)} tablas registradas.",
            "data": [t.to_dict() for t in tablas]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500