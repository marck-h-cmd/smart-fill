from sqlalchemy import text
from app.services.database_service import get_engine_from_conn

UPDATE_STATS_QUERY = text("""
SELECT
    OBJECT_NAME(s.object_id) AS table_name,
    COALESCE(SUM(s.modification_counter), 0) AS total_modifications,
    COALESCE(SUM(ps.row_count), 0) AS total_rows
FROM sys.dm_db_stats_properties(OBJECT_ID(:table_name), NULL) s
CROSS APPLY (
    SELECT SUM(row_count) AS row_count
    FROM sys.dm_db_partition_stats
    WHERE object_id = OBJECT_ID(:table_name)
      AND index_id <= 1
) ps
WHERE s.object_id = OBJECT_ID(:table_name)
GROUP BY s.object_id
""")

def calculate_fill_factor(fragmentation_percent, update_frequency_ratio):
    base_ff = 90
    if fragmentation_percent >= 50:
        base_ff = 70
    elif fragmentation_percent >= 30:
        base_ff = 75
    elif fragmentation_percent >= 15:
        base_ff = 80
    elif fragmentation_percent >= 5:
        base_ff = 85

    if update_frequency_ratio > 0.3:
        base_ff = max(base_ff - 10, 70)
    elif update_frequency_ratio > 0.1:
        base_ff = max(base_ff - 5, 70)

    suggested_ff = min(max(base_ff, 70), 90)

    if fragmentation_percent >= 30:
        action = "REBUILD"
    elif fragmentation_percent >= 10:
        action = "REORGANIZE"
    else:
        action = "OK"

    return {
        'suggested_fillfactor': suggested_ff,
        'action': action,
        'reasoning': _get_reasoning(fragmentation_percent, update_frequency_ratio, suggested_ff, action)
    }

def _get_reasoning(frag, updates, suggested_ff, action):
    parts = []
    if frag >= 30:
        parts.append(f"Fragmentación alta ({frag}%): se recomienda {action}")
    elif frag >= 10:
        parts.append(f"Fragmentación moderada ({frag}%): se recomienda {action}")
    else:
        parts.append(f"Fragmentación baja ({frag}%): {action}, no requiere intervención")

    if updates > 0.3:
        parts.append("Alta frecuencia de actualizaciones (>30%): se redujo el FillFactor para dejar espacio para crecimiento")
    elif updates > 0.1:
        parts.append("Frecuencia de actualizaciones moderada (10-30%): se ajustó ligeramente el FillFactor")

    parts.append(f"FillFactor sugerido: {suggested_ff} (balance entre rendimiento de lectura/escritura)")
    return ". ".join(parts)

def recommend_for_table(conn, table_name):
    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            frag_result = c.execute(text("""
                SELECT TOP 1
                    ips.avg_fragmentation_in_percent AS fragmentation_percent,
                    ips.fill_factor AS current_fillfactor
                FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
                WHERE ips.index_id > 0
                  AND ips.alloc_unit_type_desc = 'IN_ROW_DATA'
                  AND OBJECTPROPERTY(ips.object_id, 'IsUserTable') = 1
                  AND OBJECT_NAME(ips.object_id) = :table_name
                ORDER BY ips.avg_fragmentation_in_percent DESC
            """), {'table_name': table_name})
            frag_row = frag_result.fetchone()
            if not frag_row:
                return None

            fragmentation = round(float(frag_row.fragmentation_percent), 2)
            current_ff = frag_row.current_fillfactor

            update_result = c.execute(UPDATE_STATS_QUERY, {'table_name': table_name})
            update_row = update_result.fetchone()

            total_mods = update_row.total_modifications if update_row else 0
            total_rows = update_row.total_rows if update_row else 0
            update_ratio = min(total_mods / max(total_rows, 1), 1.0)

            recommendation = calculate_fill_factor(fragmentation, update_ratio)
            recommendation['table_name'] = table_name
            recommendation['current_fillfactor'] = current_ff
            recommendation['fragmentation_percent'] = fragmentation
            recommendation['update_ratio'] = round(update_ratio, 4)

            return recommendation
    finally:
        engine.dispose()

def recommend_top_critical(conn, limit=5):
    from app.services.fragmentation_service import get_top_fragmented
    tables = get_top_fragmented(conn, limit)
    results = []
    for t in tables:
        rec = recommend_for_table(conn, t['table_name'])
        if rec:
            results.append(rec)
    return results
