from flask import Blueprint, jsonify, request
from app.models.base import TablaMetricas, Configuracion
from app.extensions import db
from app.services.history_service import get_history

bp = Blueprint('dashboard', __name__, url_prefix='/api')

@bp.route('/status', methods=['GET'])
def status():
    return jsonify({"message": "SmartFill Backend funcionando correctamente"})

@bp.route('/test-db', methods=['GET'])
def test_db():
    try:
        tablas = TablaMetricas.query.all()
        return jsonify({
            "status": "success",
            "message": f"Conectado a SQLite exitosamente. Hay {len(tablas)} tablas registradas.",
            "data": [t.to_dict() for t in tablas]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/history', methods=['GET'])
def history_list():
    table_name = request.args.get('table')
    limit = request.args.get('limit', 50, type=int)
    records = get_history(table_name, limit)
    return jsonify({"status": "success", "data": records})

@bp.route('/history/tables', methods=['GET'])
def history_tables():
    tables = TablaMetricas.query.with_entities(TablaMetricas.nombre_tabla).distinct().all()
    return jsonify({"status": "success", "data": [t[0] for t in tables]})

@bp.route('/reports', methods=['GET'])
def generate_report():
    from app.services.history_service import get_history
    records = get_history(limit=100)
    if not records:
        return jsonify({"status": "error", "message": "No hay datos históricos para generar reporte"}), 404

    total_tables = len(records)
    avg_frag = sum(r['fragmentacion_porcentaje'] for r in records) / total_tables if total_tables > 0 else 0
    critical = [r for r in records if r['fragmentacion_porcentaje'] >= 30]
    healthy = [r for r in records if r['fragmentacion_porcentaje'] < 10]

    report = {
        "generated_at": __import__('datetime').datetime.utcnow().isoformat(),
        "summary": {
            "total_tables_analyzed": total_tables,
            "average_fragmentation": round(avg_frag, 2),
            "critical_tables": len(critical),
            "healthy_tables": len(healthy),
        },
        "critical_tables": critical[:10],
        "details": records
    }
    return jsonify({"status": "success", "data": report})

@bp.route('/maintenance', methods=['GET'])
def get_maintenance_config():
    configs = Configuracion.query.filter(
        Configuracion.clave.in_(['maintenance_enabled', 'maintenance_horario', 'maintenance_umbral'])
    ).all()
    config_dict = {c.clave: c.valor for c in configs}
    return jsonify({"status": "success", "data": config_dict})

@bp.route('/maintenance', methods=['POST'])
def save_maintenance_config():
    data = request.json
    for key in ['maintenance_enabled', 'maintenance_horario', 'maintenance_umbral']:
        if key in data:
            conf = Configuracion.query.filter_by(clave=key).first()
            if conf:
                conf.valor = str(data[key])
            else:
                conf = Configuracion(clave=key, valor=str(data[key]))
                db.session.add(conf)
    try:
        db.session.commit()
        return jsonify({"status": "success", "message": "Configuración de mantenimiento guardada."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/automation/status', methods=['GET'])
def automation_status():
    configs = Configuracion.query.filter(
        Configuracion.clave.in_(['analysis_interval', 'alert_umbral', 'auto_optimize'])
    ).all()
    config_dict = {c.clave: c.valor for c in configs}
    return jsonify({"status": "success", "data": config_dict})

@bp.route('/automation/config', methods=['POST'])
def save_automation_config():
    data = request.json
    for key in ['analysis_interval', 'alert_umbral', 'auto_optimize']:
        if key in data:
            conf = Configuracion.query.filter_by(clave=key).first()
            if conf:
                conf.valor = str(data[key])
            else:
                conf = Configuracion(clave=key, valor=str(data[key]))
                db.session.add(conf)
    try:
        db.session.commit()
        return jsonify({"status": "success", "message": "Configuración de automatización guardada."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500