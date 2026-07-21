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
