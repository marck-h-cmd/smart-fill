from app.services.history_service import record_metrics
from app.models.database_connection import DatabaseConnection

def run_analysis():
    from app import create_app
    app = create_app()
    with app.app_context():
        conn = DatabaseConnection.query.filter_by(is_active=True).first()
        if not conn:
            print("[analysis_job] No hay base de datos activa")
            return

        try:
            count = record_metrics(conn)
            print(f"[analysis_job] Análisis completado: {count} tablas actualizadas")
        except Exception as e:
            print(f"[analysis_job] Error ejecutando análisis: {e}")
