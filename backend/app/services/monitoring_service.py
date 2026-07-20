from sqlalchemy import text
from app.services.database_service import get_engine_from_conn

FRAGMENTATION_CHECK_QUERY = text("""
SELECT
    OBJECT_NAME(ips.object_id) AS table_name,
    i.name AS index_name,
    ips.avg_fragmentation_in_percent AS fragmentation_percent,
    ps.row_count AS total_rows,
    CASE
        WHEN ips.avg_fragmentation_in_percent >= 30 THEN 'REBUILD'
        WHEN ips.avg_fragmentation_in_percent >= 10 THEN 'REORGANIZE'
        ELSE 'OK'
    END AS suggested_action,
    i.fill_factor AS current_fillfactor
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
JOIN (
    SELECT object_id, SUM(row_count) AS row_count
    FROM sys.dm_db_partition_stats
    WHERE index_id <= 1
    GROUP BY object_id
) ps ON ips.object_id = ps.object_id
WHERE ips.avg_fragmentation_in_percent > 0
  AND ips.index_id > 0
  AND ips.alloc_unit_type_desc = 'IN_ROW_DATA'
  AND OBJECTPROPERTY(ips.object_id, 'IsUserTable') = 1
ORDER BY ips.avg_fragmentation_in_percent DESC
""")

DB_SPACE_QUERY = text("""
SELECT
    name,
    type_desc,
    size/128.0 AS total_size_mb,
    CAST(FILEPROPERTY(name, 'SpaceUsed') AS INT)/128.0 AS used_size_mb,
    size/128.0 - CAST(FILEPROPERTY(name, 'SpaceUsed') AS INT)/128.0 AS free_size_mb,
    CASE
        WHEN max_size = -1 THEN -1
        ELSE max_size/128.0
    END AS max_size_mb
FROM sys.database_files
""")


def check_fragmentation(conn, umbral=30):
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            result = c.execute(FRAGMENTATION_CHECK_QUERY)
            rows = [dict(r._mapping) for r in result]
        engine.dispose()
        critical = [r for r in rows if r['fragmentation_percent'] >= umbral]
        moderate = [r for r in rows if umbral > r['fragmentation_percent'] >= 10]
        return {
            "status": "success",
            "total_indexes": len(rows),
            "critical_count": len(critical),
            "moderate_count": len(moderate),
            "healthy_count": len(rows) - len(critical) - len(moderate),
            "critical": critical,
            "moderate": moderate,
            "all": rows
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_database_space(conn):
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            result = c.execute(DB_SPACE_QUERY)
            files = [dict(r._mapping) for r in result]
        engine.dispose()
        total_used = sum(f['used_size_mb'] for f in files if f['used_size_mb'])
        total_size = sum(f['total_size_mb'] for f in files if f['total_size_mb'])
        total_max = sum(f['max_size_mb'] for f in files if f['max_size_mb'] and f['max_size_mb'] > 0)
        unlimited = any(f['max_size_mb'] == -1 for f in files)
        used_percent = round((total_used / total_size) * 100, 2) if total_size > 0 else 0
        return {
            "status": "success",
            "files": files,
            "total_used_mb": round(total_used, 2),
            "total_size_mb": round(total_size, 2),
            "used_percent": used_percent,
            "free_mb": round(total_size - total_used, 2),
            "has_autogrow": unlimited,
            "max_size_mb": round(total_max, 2) if not unlimited else "Sin límite"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def run_full_check(conn, alert_umbral=30):
    frag_result = check_fragmentation(conn, alert_umbral)
    space_result = check_database_space(conn)
    alerts = []
    if frag_result.get('status') == 'success':
        if frag_result['critical_count'] > 0:
            alerts.append({
                "type": "fragmentation",
                "severity": "critical",
                "message": f"{frag_result['critical_count']} índice(s) con fragmentación ≥{alert_umbral}%",
                "count": frag_result['critical_count'],
                "items": frag_result['critical']
            })
        if frag_result['moderate_count'] > 0:
            alerts.append({
                "type": "fragmentation",
                "severity": "moderate",
                "message": f"{frag_result['moderate_count']} índice(s) con fragmentación entre 10% y {alert_umbral}%",
                "count": frag_result['moderate_count'],
                "items": frag_result['moderate']
            })
    if space_result.get('status') == 'success':
        if space_result['used_percent'] >= 90:
            alerts.append({
                "type": "space",
                "severity": "critical",
                "message": f"Espacio usado al {space_result['used_percent']}% — {space_result['free_mb']} MB libres",
                "used_percent": space_result['used_percent'],
                "free_mb": space_result['free_mb']
            })
        elif space_result['used_percent'] >= 75:
            alerts.append({
                "type": "space",
                "severity": "warning",
                "message": f"Espacio usado al {space_result['used_percent']}% — {space_result['free_mb']} MB libres",
                "used_percent": space_result['used_percent'],
                "free_mb": space_result['free_mb']
            })
    return {
        "status": "success",
        "database": conn.database,
        "timestamp": __import__('datetime').datetime.utcnow().isoformat(),
        "has_alerts": len(alerts) > 0,
        "alert_count": len(alerts),
        "alerts": alerts,
        "fragmentation": frag_result,
        "space": space_result
    }

UNUSED_INDEX_QUERY = text("""
SELECT
    OBJECT_NAME(s.object_id) AS table_name,
    i.name AS index_name,
    s.user_updates AS writes,
    s.user_seeks + s.user_scans + s.user_lookups AS reads,
    'DROP INDEX ' + i.name + ' ON ' + OBJECT_NAME(s.object_id) AS drop_script
FROM sys.dm_db_index_usage_stats s
JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
WHERE OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
  AND s.database_id = DB_ID()
  AND i.type_desc = 'NONCLUSTERED'
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND s.user_seeks = 0
  AND s.user_scans = 0
  AND s.user_lookups = 0
  AND s.user_updates > 0
ORDER BY s.user_updates DESC
""")

MISSING_INDEX_QUERY = text("""
SELECT
    migs.group_handle,
    migs.unique_compiles,
    migs.user_seeks,
    migs.user_scans,
    migs.avg_total_user_cost,
    migs.avg_user_impact,
    mid.statement AS table_name,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns,
    'CREATE INDEX IX_Auto_Missing_' + CAST(migs.group_handle AS VARCHAR(10)) + 
    ' ON ' + mid.statement + 
    ' (' + ISNULL(mid.equality_columns, '') + 
    CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL THEN ', ' ELSE '' END +
    ISNULL(mid.inequality_columns, '') + ')' +
    ISNULL(' INCLUDE (' + mid.included_columns + ')', '') AS create_script
FROM sys.dm_db_missing_index_group_stats migs
JOIN sys.dm_db_missing_index_groups mig ON migs.group_handle = mig.index_group_handle
JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
WHERE migs.avg_user_impact > 50
ORDER BY migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans) DESC
""")


def check_unused_indexes(conn):
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            result = c.execute(UNUSED_INDEX_QUERY)
            rows = [dict(r._mapping) for r in result]
        engine.dispose()
        return {
            "status": "success",
            "count": len(rows),
            "indexes": rows
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_missing_indexes(conn):
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            result = c.execute(MISSING_INDEX_QUERY)
            rows = [dict(r._mapping) for r in result]
        engine.dispose()
        return {
            "status": "success",
            "count": len(rows),
            "indexes": rows
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def create_missing_index(conn, group_handle):
    try:
        engine = get_engine_from_conn(conn)
        script = None
        # Buscar el script de creacion para ese group_handle
        with engine.connect() as c:
            result = c.execute(MISSING_INDEX_QUERY)
            for r in result:
                if str(r._mapping["group_handle"]) == str(group_handle):
                    script = r._mapping["create_script"]
                    break
            
            if not script:
                return {"status": "error", "message": f"No se encontró recomendación para el ID {group_handle}"}
            
            # Ejecutar script
            trans = c.begin()
            try:
                c.execute(text(script))
                trans.commit()
                return {"status": "success", "message": f"Índice creado exitosamente", "script": script}
            except Exception as e:
                trans.rollback()
                return {"status": "error", "message": f"Error ejecutando script: {str(e)}", "script": script}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        engine.dispose()

def check_connections(conn):
    try:
        engine = get_engine_from_conn(conn)
        query = text("""
            SELECT status, COUNT(*) as count 
            FROM sys.dm_exec_sessions 
            WHERE database_id = DB_ID() AND is_user_process = 1
            GROUP BY status
        """)
        with engine.connect() as c:
            result = c.execute(query)
            rows = [{"status": r._mapping["status"], "count": r._mapping["count"]} for r in result]
        engine.dispose()
        return {
            "status": "success",
            "connections": rows,
            "total": sum(r["count"] for r in rows)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
