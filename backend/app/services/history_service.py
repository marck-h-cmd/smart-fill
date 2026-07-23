from datetime import datetime
from app.extensions import db
from app.models.base import TablaMetricas
from app.services.fragmentation_service import get_all_fragmented

def record_metrics(conn, db_connection_name=None):
    metrics = get_all_fragmented(conn)
    for m in metrics:
        new_metric = TablaMetricas(
            nombre_tabla=m['table_name'],
            index_name=m.get('index_name', ''),
            fragmentacion_porcentaje=m['fragmentation_percent'],
            fillfactor_actual=m['current_fillfactor'] or 100,
            total_filas=m['total_rows'] or 0,
            ultima_actualizacion=datetime.utcnow()
        )
        db.session.add(new_metric)

    db.session.commit()
    return len(metrics)

def get_history(index_name=None, limit=200):
    query = TablaMetricas.query
    if index_name:
        query = query.filter(TablaMetricas.index_name == index_name)
    query = query.order_by(TablaMetricas.ultima_actualizacion.desc()).limit(limit)
    return [m.to_dict() for m in query.all()]
