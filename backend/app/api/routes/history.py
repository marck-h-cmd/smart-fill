from flask import Blueprint, jsonify, request
from app.services.history_service import get_history
from app.models.base import TablaMetricas

bp = Blueprint('history', __name__, url_prefix='/api/history')

@bp.route('', methods=['GET'])
def list_history():
    table = request.args.get('table')
    limit = request.args.get('limit', 50, type=int)
    data = get_history(table_name=table, limit=limit)
    return jsonify({"status": "success", "data": data})

@bp.route('/tables', methods=['GET'])
def get_tables():
    # Retorna la lista única de nombres de tablas de las cuales hay historial
    query = TablaMetricas.query.with_entities(TablaMetricas.nombre_tabla).distinct()
    tables = [row.nombre_tabla for row in query.all()]
    return jsonify({"status": "success", "data": tables})
