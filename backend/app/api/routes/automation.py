from flask import Blueprint, jsonify, request
from app.services.scheduler_service import get_scheduler_status, reschedule_job
from app.models.base import Configuracion
from app.extensions import db

bp = Blueprint('automation', __name__, url_prefix='/api/automation')

@bp.route('/status', methods=['GET'])
def get_status():
    configs = Configuracion.query.filter(
        Configuracion.clave.in_(['analysis_interval', 'alert_umbral', 'auto_optimize'])
    ).all()
    config_dict = {c.clave: c.valor for c in configs}
    return jsonify({"status": "success", "data": config_dict})

@bp.route('/config', methods=['POST'])
def update_config():
    data = request.json
    try:
        keys_to_save = ['analysis_interval', 'alert_umbral', 'auto_optimize']
        
        for clave in keys_to_save:
            if clave in data:
                conf = Configuracion.query.filter_by(clave=clave).first()
                if not conf:
                    conf = Configuracion(clave=clave, valor=str(data[clave]))
                    db.session.add(conf)
                else:
                    conf.valor = str(data[clave])
                
                # Reschedule job if analysis interval changed
                if clave == 'analysis_interval':
                    # The interval from frontend is in minutes, so we multiply by 60
                    reschedule_job('smartfill_analysis', int(data[clave]) * 60)
            
        db.session.commit()
        return jsonify({"status": "success", "message": "Configuración de automatización actualizada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
