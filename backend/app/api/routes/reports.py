from flask import Blueprint, jsonify
from app.services.report_service import generate_health_report

bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@bp.route('', methods=['GET'])
def get_report():
    report = generate_health_report()
    if report.get('status') == 'success':
        return jsonify(report), 200
    else:
        return jsonify(report), 500
