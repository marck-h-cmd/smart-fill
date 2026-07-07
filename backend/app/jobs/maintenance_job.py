from sqlalchemy import text
from app.models.database_connection import DatabaseConnection
from app.models.base import Configuracion
from app.extensions import db
from app.services.database_service import get_engine_from_conn


def run_maintenance():
    with db.app.app_context():
        conn = DatabaseConnection.query.filter_by(is_active=True).first()
        if not conn:
            print("[maintenance_job] No hay base de datos activa")
            return

        enabled_conf = Configuracion.query.filter_by(clave='maintenance_enabled').first()
        if not enabled_conf or enabled_conf.valor != 'true':
            print("[maintenance_job] Mantenimiento automático deshabilitado")
            return

        umbral_conf = Configuracion.query.filter_by(clave='maintenance_umbral').first()
        umbral = int(umbral_conf.valor) if umbral_conf else 30

        try:
            engine = get_engine_from_conn(conn)
            with engine.connect() as c:
                result = c.execute(text("""
                    SELECT
                        OBJECT_NAME(ips.object_id) AS table_name,
                        i.name AS index_name,
                        ips.avg_fragmentation_in_percent AS frag_pct,
                        CASE
                            WHEN ips.avg_fragmentation_in_percent >= 30 THEN 'REBUILD'
                            ELSE 'REORGANIZE'
                        END AS action
                    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
                    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
                    WHERE ips.avg_fragmentation_in_percent >= :umbral
                      AND ips.index_id > 0
                      AND ips.alloc_unit_type_desc = 'IN_ROW_DATA'
                      AND OBJECTPROPERTY(ips.object_id, 'IsUserTable') = 1
                """), {'umbral': umbral})
                targets = [dict(r._mapping) for r in result]

            if not targets:
                print("[maintenance_job] No hay índices que requieran mantenimiento")
                engine.dispose()
                return

            with engine.connect() as c:
                for t in targets:
                    sql = text(
                        f"ALTER INDEX [{t['index_name']}] ON [{t['table_name']}] {t['action']}"
                    )
                    txn = c.begin()
                    try:
                        c.execute(sql)
                        txn.commit()
                        print(f"[maintenance_job] {t['action']} [{t['table_name']}].[{t['index_name']}] OK")
                    except Exception as e:
                        txn.rollback()
                        print(f"[maintenance_job] Error en {t['table_name']}.{t['index_name']}: {e}")

            engine.dispose()
            print(f"[maintenance_job] Mantenimiento completado: {len(targets)} índices procesados")
        except Exception as e:
            print(f"[maintenance_job] Error ejecutando mantenimiento: {e}")
