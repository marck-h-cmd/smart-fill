from flask import Blueprint, jsonify, g
from app.utils.db_connector import get_db_connection

bp = Blueprint('dashboard', __name__, url_prefix='/api')

@bp.route('/status', methods=['GET'])
def status():
    return jsonify({"message": "SmartFill Backend funcionando correctamente"})

@bp.route('/test-db', methods=['GET'])
def test_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()
        return jsonify({"version": version[0]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500