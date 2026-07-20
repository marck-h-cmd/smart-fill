from sqlalchemy import text
from app.services.database_service import get_engine_from_conn

FRAGMENTATION_QUERY = text("""
SELECT TOP 5
    OBJECT_NAME(ips.object_id) AS table_name,
    ips.avg_fragmentation_in_percent AS fragmentation_percent,
    ps.row_count AS total_rows,
    CASE
        WHEN ips.avg_fragmentation_in_percent >= 30 THEN 'REBUILD'
        WHEN ips.avg_fragmentation_in_percent >= 10 THEN 'REORGANIZE'
        ELSE 'OK'
    END AS suggested_action,
    i.fill_factor AS current_fillfactor,   -- <-- join con sys.indexes
    ips.index_type_desc AS index_type,
    ips.index_depth AS index_depth
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

FRAGMENTATION_ALL_QUERY = text("""
SELECT
    OBJECT_NAME(ips.object_id) AS table_name,
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

FRAGMENTATION_TABLE_QUERY = text("""
SELECT
    OBJECT_NAME(ips.object_id) AS table_name,
    ips.avg_fragmentation_in_percent AS fragmentation_percent,
    ps.row_count AS total_rows,
    i.fill_factor AS current_fillfactor,
    ips.index_type_desc AS index_type,
    ips.index_depth AS index_depth,
    ips.page_count AS total_pages,
    ips.record_count AS record_count,
    ips.forwarded_record_count AS forwarded_records,
    ips.compressed_page_count AS compressed_pages
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
  AND OBJECT_NAME(ips.object_id) = :table_name
ORDER BY ips.avg_fragmentation_in_percent DESC
""")

def get_top_fragmented(conn, limit=5):
    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            result = c.execute(FRAGMENTATION_ALL_QUERY)
            rows = []
            for row in result:
                rows.append({
                    'table_name': row.table_name,
                    'fragmentation_percent': round(float(row.fragmentation_percent), 2),
                    'total_rows': row.total_rows,
                    'suggested_action': row.suggested_action,
                    'current_fillfactor': row.current_fillfactor,
                })
            return rows[:limit]
    finally:
        engine.dispose()

def get_all_fragmented(conn):
    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            result = c.execute(FRAGMENTATION_ALL_QUERY)
            rows = []
            for row in result:
                rows.append({
                    'table_name': row.table_name,
                    'fragmentation_percent': round(float(row.fragmentation_percent), 2),
                    'total_rows': row.total_rows,
                    'suggested_action': row.suggested_action,
                    'current_fillfactor': row.current_fillfactor,
                })
            return rows
    finally:
        engine.dispose()

def get_table_fragmentation(conn, table_name):
    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            result = c.execute(FRAGMENTATION_TABLE_QUERY, {'table_name': table_name})
            rows = []
            for row in result:
                rows.append({
                    'table_name': row.table_name,
                    'fragmentation_percent': round(float(row.fragmentation_percent), 2),
                    'total_rows': row.total_rows,
                    'current_fillfactor': row.current_fillfactor,
                    'index_type': row.index_type,
                    'index_depth': row.index_depth,
                    'total_pages': row.total_pages,
                    'record_count': row.record_count,
                    'forwarded_records': row.forwarded_records,
                    'compressed_pages': row.compressed_pages,
                })
            return rows
    finally:
        engine.dispose()

def get_dashboard_stats(conn):
    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            result = c.execute(text("""
                SELECT
                    COUNT(*) AS total_indexes,
                    AVG(ips.avg_fragmentation_in_percent) AS avg_fragmentation,
                    SUM(CASE WHEN ips.avg_fragmentation_in_percent >= 30 THEN 1 ELSE 0 END) AS critical_count,
                    SUM(CASE WHEN ips.avg_fragmentation_in_percent >= 10 AND ips.avg_fragmentation_in_percent < 30 THEN 1 ELSE 0 END) AS moderate_count,
                    SUM(CASE WHEN ips.avg_fragmentation_in_percent < 10 THEN 1 ELSE 0 END) AS healthy_count
                FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
                WHERE ips.index_id > 0
                  AND ips.alloc_unit_type_desc = 'IN_ROW_DATA'
                  AND OBJECTPROPERTY(ips.object_id, 'IsUserTable') = 1
            """))
            row = result.fetchone()
            return {
                'total_indexes': row.total_indexes,
                'avg_fragmentation': round(float(row.avg_fragmentation), 2) if row.avg_fragmentation else 0,
                'critical_count': row.critical_count,
                'moderate_count': row.moderate_count,
                'healthy_count': row.healthy_count,
            }
    finally:
        engine.dispose()

ALL_USER_TABLES_QUERY = text("""
SELECT
    t.name AS table_name,
    SUM(p.rows) AS total_rows
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id
WHERE t.is_ms_shipped = 0
  AND t.name NOT LIKE 'sys%'
  AND t.name NOT LIKE 'MS%'
GROUP BY t.name, t.object_id
ORDER BY t.name
""")

def get_all_user_tables(conn):
    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            result = c.execute(ALL_USER_TABLES_QUERY)
            return [dict(r._mapping) for r in result]
    finally:
        engine.dispose()
