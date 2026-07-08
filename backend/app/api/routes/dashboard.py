from flask import Blueprint, jsonify, request
from app.models.base import TablaMetricas, Configuracion
from app.models.database_connection import DatabaseConnection
from app.extensions import db
from app.services.history_service import get_history
from app.services.monitoring_service import run_full_check
from app.services.whatsapp_service import WhatsAppService

bp = Blueprint('dashboard', __name__, url_prefix='/api')
wsp_service = WhatsAppService()

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


@bp.route('/check-and-alert', methods=['POST'])
def check_and_alert():
    conn = DatabaseConnection.query.filter_by(is_active=True).first()
    if not conn:
        return jsonify({"error": "No hay una base de datos activa configurada"}), 400

    alert_umbral_conf = Configuracion.query.filter_by(clave='alert_umbral').first()
    alert_umbral = int(alert_umbral_conf.valor) if alert_umbral_conf else 30

    result = run_full_check(conn, alert_umbral)
    if result.get('status') != 'success':
        return jsonify({"error": result.get('message', 'Error ejecutando chequeo')}), 500

    if result.get('has_alerts'):
        admin_phone_conf = Configuracion.query.filter_by(clave='admin_phone').first()
        if admin_phone_conf and admin_phone_conf.valor:
            admin_phone = admin_phone_conf.valor
            lines = ["🚨 *ALERTA SMARTFILL*", ""]
            for alert in result['alerts']:
                emoji = "🔴" if alert['severity'] == 'critical' else "🟡"
                lines.append(f"{emoji} {alert['message']}")
            if result['fragmentation'].get('status') == 'success':
                lines.append("")
                lines.append(f"📊 Total índices: {result['fragmentation']['total_indexes']}")
                lines.append(f"🔴 Críticos: {result['fragmentation']['critical_count']}")
                lines.append(f"🟡 Moderados: {result['fragmentation']['moderate_count']}")
                lines.append(f"✅ Saludables: {result['fragmentation']['healthy_count']}")
            if result['space'].get('status') == 'success':
                lines.append("")
                lines.append(f"💾 Espacio usado: {result['space']['used_percent']}%")
                lines.append(f"📀 Libres: {result['space']['free_mb']} MB")
            lines.append("")
            lines.append("Responde con /estado para más detalles.")

            bot_session_conf = Configuracion.query.filter_by(clave='bot_session').first()
            if not bot_session_conf or not bot_session_conf.valor:
                result['alert_skipped'] = "No hay bot_session configurada"
            else:
                text = "\n".join(lines)
                admin_phone = admin_phone.lstrip('+')
                chat_id = f"{admin_phone}@c.us" if not (admin_phone.endswith('@c.us') or admin_phone.endswith('@g.us') or admin_phone.endswith('@lid')) else admin_phone
                try:
                    wsp_service.send_message(bot_session_conf.valor, chat_id, text)
                    result['alert_sent'] = True
                    result['alert_sent_to'] = admin_phone
                except Exception as e:
                    result['alert_sent'] = False
                    result['alert_error'] = str(e)

    return jsonify({"status": "success", "data": result})


@bp.route('/scheduler/status', methods=['GET'])
def scheduler_status():
    from app.services.scheduler_service import get_scheduler_status
    return jsonify({"status": "success", "data": get_scheduler_status()})


@bp.route('/scheduler/reschedule', methods=['POST'])
def scheduler_reschedule():
    data = request.json
    job_id = data.get('job_id')
    interval = data.get('interval_seconds')
    if not job_id or not interval:
        return jsonify({"error": "job_id e interval_seconds son requeridos"}), 400
    from app.services.scheduler_service import reschedule_job
    ok = reschedule_job(job_id, int(interval))
    if not ok:
        return jsonify({"error": "Job no encontrado o scheduler no iniciado"}), 400
    return jsonify({"status": "success", "message": f"Job '{job_id}' reprogramado cada {interval}s"})


@bp.route('/scheduler/run-now', methods=['POST'])
def scheduler_run_now():
    from app.jobs.alert_job import run_alert_check
    from app.jobs.analysis_job import run_analysis
    from app.jobs.maintenance_job import run_maintenance
    data = request.json or {}
    job_type = data.get('job', 'alert')
    import threading
    if job_type == 'alert':
        threading.Thread(target=run_alert_check, daemon=True).start()
    elif job_type == 'analysis':
        threading.Thread(target=run_analysis, daemon=True).start()
    elif job_type == 'maintenance':
        threading.Thread(target=run_maintenance, daemon=True).start()
    else:
        return jsonify({"error": f"Tipo de job desconocido: {job_type}"}), 400
    return jsonify({"status": "success", "message": f"Job '{job_type}' ejecutado en segundo plano"})


@bp.route('/trends', methods=['GET'])
def trends():
    from app.services.trend_service import get_trends
    days = request.args.get('days', 30, type=int)
    result = get_trends(days)
    return jsonify(result)


@bp.route('/trends/<table_name>', methods=['GET'])
def table_trend(table_name):
    from app.services.trend_service import get_table_history_detail
    limit = request.args.get('limit', 20, type=int)
    data = get_table_history_detail(table_name, limit)
    return jsonify({"status": "success", "data": data})