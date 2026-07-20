from datetime import datetime
from app.models.database_connection import DatabaseConnection
from app.models.base import TablaMetricas
from app.services.monitoring_service import run_full_check
from app.services.fragmentation_service import get_all_fragmented

def generate_health_report():
    conn = DatabaseConnection.query.filter_by(is_active=True).first()
    if not conn:
        return {"status": "error", "message": "No hay base de datos activa configurada"}

    try:
        tables = get_all_fragmented(conn)
        
        total_tables = len(tables)
        avg_frag = sum(t['fragmentation_percent'] for t in tables) / max(total_tables, 1)
        
        critical_tables_list = [t for t in tables if t['fragmentation_percent'] >= 30]
        healthy_tables_count = len([t for t in tables if t['fragmentation_percent'] < 10])

        report_data = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "summary": {
                "total_tables_analyzed": total_tables,
                "average_fragmentation": round(avg_frag, 2),
                "critical_tables": len(critical_tables_list),
                "healthy_tables": healthy_tables_count
            },
            "critical_tables": [
                {
                    "nombre_tabla": t['table_name'],
                    "fragmentacion_porcentaje": round(t['fragmentation_percent'], 2)
                } for t in critical_tables_list
            ]
        }
        
        return {"status": "success", "data": report_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}
