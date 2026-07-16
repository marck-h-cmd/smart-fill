from flask import Blueprint, jsonify
from app.models.database_connection import DatabaseConnection
from app.services.monitoring_service import check_unused_indexes, check_missing_indexes

bp = Blueprint('monitoring', __name__, url_prefix='/api/monitoring')

@bp.route('/<int:db_id>/indexes/unused', methods=['GET'])
def get_unused_indexes(db_id):
    db_conn = DatabaseConnection.query.get_or_404(db_id)
    result = check_unused_indexes(db_conn)
    if result['status'] == 'success':
        return jsonify(result), 200
    else:
        return jsonify({'error': result['message']}), 500

@bp.route('/<int:db_id>/indexes/missing', methods=['GET'])
def get_missing_indexes(db_id):
    db_conn = DatabaseConnection.query.get_or_404(db_id)
    result = check_missing_indexes(db_conn)
    if result['status'] == 'success':
        return jsonify(result), 200
    else:
        return jsonify({'error': result['message']}), 500
