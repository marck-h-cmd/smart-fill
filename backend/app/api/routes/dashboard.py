from flask import Blueprint, jsonify

bp = Blueprint('dashboard', __name__, url_prefix='/api')

@bp.route('/status', methods=['GET'])
def status():
    return jsonify({"message": "SmartFill Backend funcionando correctamente"})

@bp.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Bienvenido a SmartFill API"})