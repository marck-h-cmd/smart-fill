from app.extensions import db
from app.models.base import TablaMetricas
from sqlalchemy import func, and_
from datetime import datetime, timedelta


def get_trends(days_back=30):
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    recent = TablaMetricas.query.filter(
        TablaMetricas.ultima_actualizacion >= cutoff
    ).order_by(TablaMetricas.ultima_actualizacion.desc()).all()

    if not recent:
        return {"status": "success", "data": [], "message": "No hay datos históricos suficientes"}

    table_groups = {}
    for r in recent:
        key = r.nombre_tabla
        if key not in table_groups:
            table_groups[key] = []
        table_groups[key].append(r)

    trends = []
    for table_name, records in table_groups.items():
        records.sort(key=lambda x: x.ultima_actualizacion)
        if len(records) < 2:
            trends.append({
                "table_name": table_name,
                "current_frag": records[-1].fragmentacion_porcentaje,
                "previous_frag": records[-1].fragmentacion_porcentaje,
                "change": 0,
                "trend": "stable",
                "records_count": 1
            })
            continue

        current = records[-1].fragmentacion_porcentaje
        previous = records[0].fragmentacion_porcentaje
        change = round(current - previous, 2)

        if change > 5:
            trend = "worsening"
        elif change < -5:
            trend = "improving"
        else:
            trend = "stable"

        history = [{
            "fragmentation_percent": r.fragmentacion_porcentaje,
            "total_rows": r.total_filas,
            "date": r.ultima_actualizacion.isoformat()
        } for r in records]

        trends.append({
            "table_name": table_name,
            "current_frag": current,
            "previous_frag": previous,
            "change": change,
            "trend": trend,
            "records_count": len(records),
            "history": history
        })

    trends.sort(key=lambda x: abs(x['change']), reverse=True)
    return {"status": "success", "data": trends}


def get_table_history_detail(table_name, limit=20):
    records = TablaMetricas.query.filter_by(
        nombre_tabla=table_name
    ).order_by(TablaMetricas.ultima_actualizacion.desc()).limit(limit).all()

    return [{
        "fragmentation_percent": r.fragmentacion_porcentaje,
        "total_rows": r.total_filas,
        "fillfactor": r.fillfactor_actual,
        "date": r.ultima_actualizacion.isoformat()
    } for r in records]
