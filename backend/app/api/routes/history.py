from flask import Blueprint, jsonify, request
from app.services.history_service import get_history
from app.models.base import TablaMetricas

bp = Blueprint('history', __name__, url_prefix='/api/history')

@bp.route('', methods=['GET'])
def list_history():
    index_name = request.args.get('index')
    limit = request.args.get('limit', 200, type=int)
    data = get_history(index_name=index_name, limit=limit)
    return jsonify({"status": "success", "data": data})

@bp.route('/tables', methods=['GET'])
def get_tables():
    # Retorna la lista única de nombres de índices de los cuales hay historial
    query = TablaMetricas.query.with_entities(TablaMetricas.index_name).distinct().filter(TablaMetricas.index_name != None)
    indexes = [row.index_name for row in query.all() if row.index_name]
    return jsonify({"status": "success", "data": indexes})
