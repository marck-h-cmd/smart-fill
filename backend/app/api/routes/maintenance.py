from flask import Blueprint, jsonify, request
from app.models.base import Configuracion
from app.extensions import db

bp = Blueprint('maintenance', __name__, url_prefix='/api/maintenance')

@bp.route('', methods=['GET'])
def get_maintenance_config():
    keys = ['maintenance_enabled', 'maintenance_horario', 'maintenance_umbral']
    data = {}
    for key in keys:
        conf = Configuracion.query.filter_by(clave=key).first()
        if conf:
            if conf.valor.lower() in ('true', 'false'):
                data[key] = conf.valor.lower() == 'true'
            else:
                data[key] = conf.valor
    return jsonify({"status": "success", "data": data})

@bp.route('', methods=['POST'])
def save_maintenance_config():
    data = request.json or {}
    
    # Manejar acción manual de prueba de optimización
    if data.get('action') == 'optimize':
        from app.models.database_connection import DatabaseConnection
        from app.services.optimization_service import execute_optimization, execute_all_optimizations
        
        conn = DatabaseConnection.query.filter_by(is_active=True).first()
        if not conn:
            return jsonify({"status": "error", "message": "No hay una base de datos activa configurada"}), 400
            
        table_name = data.get('table_name')
        try:
            if table_name:
                res = execute_optimization(conn, table_name)
            else:
                res = execute_all_optimizations(conn)
            return jsonify({"status": "success", "data": res, "message": res.get('message', 'Optimización completada.')})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    try:
        keys = ['maintenance_enabled', 'maintenance_horario', 'maintenance_umbral']
        for key in keys:
            if key in data:
                val = str(data[key])
                conf = Configuracion.query.filter_by(clave=key).first()
                if not conf:
                    conf = Configuracion(clave=key, valor=val)
                    db.session.add(conf)
                else:
                    conf.valor = val
        db.session.commit()
        return jsonify({"status": "success", "message": "Configuración de mantenimiento actualizada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
