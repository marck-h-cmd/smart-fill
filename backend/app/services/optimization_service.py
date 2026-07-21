from sqlalchemy import text
from app.services.database_service import get_engine_from_conn
from app.extensions import db
from datetime import datetime

def generate_script(table_name, action, fill_factor=None):
    if action == 'REBUILD':
        ff_clause = f" WITH (FILLFACTOR = {fill_factor})" if fill_factor else ""
        script = f"ALTER INDEX ALL ON [{table_name}] REBUILD{ff_clause};"
    elif action == 'REORGANIZE':
        script = f"ALTER INDEX ALL ON [{table_name}] REORGANIZE;"
    else:
        script = f"-- No se requiere optimización para [{table_name}]"

    return script

def get_optimization_plan(conn, table_name):
    from app.services.recommendation_service import recommend_for_table
    rec = recommend_for_table(conn, table_name)
    if not rec:
        return None

    script = generate_script(table_name, rec['action'], rec.get('suggested_fillfactor'))
    rec['script'] = script
    return rec

def execute_optimization(conn, table_name):
    plan = get_optimization_plan(conn, table_name)
    if not plan:
        return {'success': False, 'error': f'Tabla "{table_name}" no encontrada o sin datos de fragmentación'}

    if plan['action'] == 'OK':
        return {
            'success': True,
            'action': 'OK',
            'message': f"La tabla [{table_name}] no requiere optimización ({plan['fragmentation_percent']}% fragmentación)",
            'script': plan['script']
        }

    engine = get_engine_from_conn(conn)
    try:
        with engine.connect() as c:
            trans = c.begin()
            try:
                c.execute(text(plan['script']))
                trans.commit()
                
                # Update history metrics immediately after successful optimization
                try:
                    from app.models.base import TablaMetricas
                    metric = TablaMetricas.query.filter_by(nombre_tabla=table_name).first()
                    if metric:
                        metric.fragmentacion_porcentaje = 0
                        metric.ultima_actualizacion = datetime.utcnow()
                        db.session.commit()
                except Exception as ex:
                    print(f"Advertencia: No se pudo actualizar el historial para {table_name}: {ex}")

                return {
                    'success': True,
                    'action': plan['action'],
                    'message': f"Optimización completada: {plan['action']} ejecutado en [{table_name}]",
                    'script': plan['script'],
                    'fragmentation_before': plan['fragmentation_percent'],
                    'fillfactor_applied': plan.get('suggested_fillfactor')
                }
            except Exception as e:
                trans.rollback()
                return {
                    'success': False,
                    'action': plan['action'],
                    'error': str(e),
                    'script': plan['script'],
                    'message': f"Error ejecutando optimización en [{table_name}]: {str(e)}"
                }
    finally:
        engine.dispose()

def execute_all_optimizations(conn):
    from app.services.recommendation_service import recommend_top_critical
    # Obtener todas las tablas críticas y moderadas (ej. limit=50 para no hacer demasiadas a la vez)
    recs = recommend_top_critical(conn, limit=50)
    if not recs:
        return {'success': True, 'message': 'No hay tablas que requieran optimización.', 'count': 0, 'details': []}
    
    results = []
    success_count = 0
    
    for r in recs:
        if r['action'] in ['REBUILD', 'REORGANIZE']:
            res = execute_optimization(conn, r['table_name'])
            results.append(res)
            if res.get('success'):
                success_count += 1
                
    return {
        'success': True,
        'message': f'Se optimizaron {success_count} de {len([r for r in recs if r["action"] in ["REBUILD", "REORGANIZE"]])} tablas.',
        'count': success_count,
        'details': results
    }
