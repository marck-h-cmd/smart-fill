from flask import Blueprint, request, jsonify
from app.models.base import Configuracion
from app.extensions import db

bp = Blueprint('config', __name__, url_prefix='/api/config')

@bp.route('', methods=['GET'])
def get_config():
    configs = Configuracion.query.all()
    config_dict = {c.clave: c.valor for c in configs}
    return jsonify({"status": "success", "data": config_dict})

@bp.route('', methods=['POST'])
def save_config():
    data = request.json
    for key, value in data.items():
        conf = Configuracion.query.filter_by(clave=key).first()
        if conf:
            conf.valor = value
        else:
            conf = Configuracion(clave=key, valor=value)
            db.session.add(conf)
    
    try:
        db.session.commit()
        return jsonify({"status": "success", "message": "Configuración guardada."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
