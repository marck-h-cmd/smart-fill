import time
import traceback
from collections import defaultdict
from flask import Blueprint, request, jsonify, current_app
from app.services.whatsapp_service import WhatsAppService
from app.services.ai_service import AIService, build_db_context
from app.services import context_service
from app.extensions import db
from app.models.base import Configuracion
from app.models.database_connection import DatabaseConnection
from app.services.fragmentation_service import get_top_fragmented
from app.services.recommendation_service import recommend_for_table, recommend_top_critical
from app.services.optimization_service import execute_optimization
from app.services.history_service import get_history

_recent_events = defaultdict(float)
DEDUP_WINDOW = 30.0

bp = Blueprint('whatsapp', __name__, url_prefix='/api/whatsapp')
wsp_service = WhatsAppService()
ai_service = AIService()

def _format_estado(conn):
    tables = get_top_fragmented(conn, 5)
    lines = []
    lines.append(f"📊 *ESTADO DE FRAGMENTACIÓN*")
    lines.append(f"Base de datos: {conn.database}\n")
    for t in tables:
        action_emoji = "🛑" if t['suggested_action'] == 'REBUILD' else "⚠️" if t['suggested_action'] == 'REORGANIZE' else "✅"
        lines.append(
            f"{action_emoji} *{t['table_name']}*\n"
            f"   Fragmentación: {t['fragmentation_percent']}%\n"
            f"   Acción: {t['suggested_action']}\n"
        )
    lines.append("💡 *Sugerencia:* Ejecuta /optimizar [nombre_tabla] para mejorar el rendimiento.")
    lines.append("🌐 Para acceder al dashboard web usa /dashboard")
    return "\n".join(lines)

def _format_recomendar(conn, table_name=None):
    if table_name:
        rec = recommend_for_table(conn, table_name)
        if not rec:
            return f"❌ Tabla *{table_name}* no encontrada en la base de datos activa."
        lines = [
            f"📋 *Recomendación para {rec['table_name']}*",
            f"",
            f"   📊 Fragmentación: {rec['fragmentation_percent']}%",
            f"   🔧 FillFactor actual: {rec['current_fillfactor']}",
            f"   💡 FillFactor sugerido: *{rec['suggested_fillfactor']}*",
            f"   🎯 Acción: {rec['action']}",
            f"   📈 Ratio actualizaciones: {rec.get('update_ratio', 0)*100:.1f}%",
            f"",
            f"📝 {rec['reasoning']}",
            f"",
            f"💡 Ejecuta */optimizar {rec['table_name']}* para aplicar."
        ]
        return "\n".join(lines)
    else:
        recs = recommend_top_critical(conn, 5)
        if not recs:
            return "✅ No se encontraron tablas con fragmentación crítica."
        lines = [
            f"📋 *TOP {len(recs)} TABLAS CRÍTICAS - RECOMENDACIONES*",
            f"Base de datos: {conn.database}\n"
        ]
        for r in recs:
            lines.append(
                f"🔹 *{r['table_name']}*\n"
                f"   Fragmentación: {r['fragmentation_percent']}%\n"
                f"   FF actual: {r['current_fillfactor']} → *{r['suggested_fillfactor']}*\n"
                f"   Acción: {r['action']}\n"
            )
        lines.append("💡 Usa /optimizar [tabla] para ejecutar la optimización.")
        return "\n".join(lines)

def _format_optimizar(conn, table_name):
    result = execute_optimization(conn, table_name)
    if result['success']:
        emoji = "✅" if result.get('action') == 'OK' else "🛠️"
        lines = [
            f"{emoji} *Resultado de optimización*",
            f"   Tabla: {table_name}",
            f"   Acción: {result.get('action', 'N/A')}",
            f"   Mensaje: {result.get('message', 'OK')}",
        ]
        if result.get('fillfactor_applied'):
            lines.append(f"   FillFactor aplicado: {result['fillfactor_applied']}")
        lines.append(f"   Script ejecutado:\n   `{result.get('script', '')}`")
        return "\n".join(lines)
    else:
        return f"❌ *Error de optimización*\n{result.get('message', result.get('error', 'Error desconocido'))}"

def _format_historial(table_name=None):
    records = get_history(table_name, limit=10)
    if not records:
        return "📭 No hay historial de métricas registradas."
    lines = [
        "📜 *HISTORIAL DE MÉTRICAS*",
        f"{'Tabla':<20} {'Fragmentación':<15} {'Filas':<12} {'Última Actualización':<25}",
        "-" * 72
    ]
    for r in records:
        lines.append(
            f"{r['nombre_tabla'][:18]:<20} {str(r['fragmentacion_porcentaje'])+'%':<15} "
            f"{str(r['total_filas']):<12} {r['ultima_actualizacion'][:19]:<25}"
        )
    return "\n".join(lines)

def _format_alertas():
    from app.models.base import Configuracion
    umbral = Configuracion.query.filter_by(clave='umbral_fragmentacion_critico').first()
    horario = Configuracion.query.filter_by(clave='horario_mantenimiento').first()
    alert_umbral = Configuracion.query.filter_by(clave='alert_umbral').first()
    lines = [
        "🔔 *CONFIGURACIÓN DE ALERTAS*",
        f"",
        f"   📊 Umbral fragmentación crítica: {umbral.valor if umbral else '30'}%",
        f"   🚨 Umbral de alerta: {alert_umbral.valor if alert_umbral else '30'}%",
        f"   🕐 Horario de mantenimiento: {horario.valor if horario else '02:00'}",
        f"",
        f"*Comandos disponibles:*",
        f"   /alertas set umbral <valor>   - Cambiar umbral crítico",
        f"   /alertas set horario <HH:MM>   - Cambiar horario mantenimiento",
    ]
    return "\n".join(lines)

def _format_alertar(conn):
    from app.services.monitoring_service import run_full_check
    from app.models.base import Configuracion
    alert_umbral_conf = Configuracion.query.filter_by(clave='alert_umbral').first()
    alert_umbral = float(alert_umbral_conf.valor) if alert_umbral_conf else 30.0
    result = run_full_check(conn, alert_umbral)
    if result.get('status') != 'success':
        return f"❌ Error ejecutando chequeo: {result.get('message')}"
    lines = [f"🔍 *CHEQUEO COMPLETO — {conn.database}*", ""]
    for alert in result.get('alerts', []):
        emoji = "🔴" if alert['severity'] == 'critical' else "🟡"
        lines.append(f"{emoji} {alert['message']}")
    if not result.get('alerts'):
        lines.append("✅ Sin alertas. Todo en orden.")
    if result['fragmentation'].get('status') == 'success':
        lines.append("")
        lines.append(f"📊 Índices: {result['fragmentation']['total_indexes']} total, {result['fragmentation']['critical_count']} críticos, {result['fragmentation']['moderate_count']} moderados")
    if result['space'].get('status') == 'success':
        lines.append(f"💾 Espacio: {result['space']['used_percent']}% usado ({result['space']['free_mb']} MB libres)")
    lines.append("")
    lines.append("Responde con /estado para ver el detalle de fragmentación.")
    return "\n".join(lines)

def _format_indices(conn):
    from app.services.monitoring_service import check_unused_indexes, check_missing_indexes
    unused = check_unused_indexes(conn)
    missing = check_missing_indexes(conn)
    
    lines = ["📊 *SALUD DE ÍNDICES*", ""]
    
    if unused.get('status') == 'success':
        lines.append(f"⚠️ *Índices Inútiles:* {unused.get('count', 0)}")
        for idx in unused.get('indexes', [])[:3]:
            lines.append(f"  • {idx['index_name']} (Tabla: {idx['table_name']}) - {idx['writes']} escrituras")
        if unused.get('count', 0) > 3:
            lines.append("  ... y otros más. (Ver dashboard para detalles)")
    else:
        lines.append("❌ Error obteniendo índices inútiles.")
        
    lines.append("")
    
    if missing.get('status') == 'success':
        lines.append(f"💡 *Índices Faltantes Sugeridos:* {missing.get('count', 0)}")
        for idx in missing.get('indexes', [])[:3]:
            lines.append(f"  • Tabla: {idx['table_name']}")
            lines.append(f"    Impacto: {int(idx['avg_user_impact'])}% | Búsquedas: {idx['user_seeks'] + idx['user_scans']}")
            lines.append(f"    👉 Para crearlo: /crear_indice {idx['group_handle']}")
    else:
        lines.append("❌ Error obteniendo índices faltantes.")
        
    lines.append("")
    lines.append("🌐 Para más detalles en la consola web usa /dashboard")
    return "\n".join(lines)

def _format_espacio(conn):
    from app.services.monitoring_service import check_database_space
    space = check_database_space(conn)
    if space.get('status') != 'success':
        return f"❌ Error obteniendo información de espacio: {space.get('message')}"
    
    lines = [
        "💾 *REPORTE DE ESPACIO*",
        f"Base de datos: {conn.database}",
        "",
        f"   📦 Tamaño Total: {space['total_size_mb']} MB",
        f"   📈 Espacio Usado: {space['total_used_mb']} MB ({space['used_percent']}%)",
        f"   🆓 Espacio Libre: {space['free_mb']} MB",
        f"   ⚙️ Autogrow activado: {'Sí' if space['has_autogrow'] else 'No'}",
        f"   🛑 Tamaño Máximo: {space['max_size_mb']} MB"
    ]
    return "\n".join(lines)

def _format_conexiones(conn):
    from app.services.monitoring_service import check_connections
    conn_data = check_connections(conn)
    if conn_data.get('status') != 'success':
        return f"❌ Error obteniendo conexiones: {conn_data.get('message')}"
    
    lines = [
        "🔌 *CONEXIONES ACTIVAS*",
        f"Total de conexiones de usuario: {conn_data['total']}",
        ""
    ]
    for row in conn_data.get('connections', []):
        status_emoji = "🟢" if row['status'] == 'running' else "💤" if row['status'] == 'sleeping' else "🟡"
        lines.append(f"   {status_emoji} {row['status'].capitalize()}: {row['count']}")
        
    return "\n".join(lines)

def _format_crear_indice(conn, group_handle):
    from app.services.monitoring_service import create_missing_index
    res = create_missing_index(conn, group_handle)
    if res.get('status') == 'success':
        return f"✅ *Índice creado exitosamente*\nSe ejecutó el script recomendado para el grupo {group_handle}."
    else:
        return f"❌ *Error creando índice*\n{res.get('message')}"

def _format_optimizar_all(conn):
    from app.services.optimization_service import execute_all_optimizations
    res = execute_all_optimizations(conn)
    if res.get('success'):
        lines = [
            f"✅ *Optimización Masiva Completada*",
            f"Tablas optimizadas: {res.get('count', 0)}",
            ""
        ]
        for detail in res.get('details', [])[:5]:
            lines.append(f"  • {detail.get('message')}")
        if res.get('count', 0) > 5:
            lines.append(f"  ... y {res.get('count', 0) - 5} más.")
        return "\n".join(lines)
    else:
        return f"❌ Error en optimización masiva: {res.get('message', 'Desconocido')}"

def _format_optimizar_indices(conn):
    from app.services.monitoring_service import execute_index_optimization
    res = execute_index_optimization(conn)
    if res.get('status') == 'success':
        dropped = res.get('dropped', [])
        created = res.get('created', [])
        errors = res.get('errors', [])
        
        lines = ["🛠️ *OPTIMIZACIÓN ESTRUCTURAL DE ÍNDICES*"]
        lines.append(f"Base de datos: {conn.database}\n")
        
        if dropped:
            lines.append("🗑️ *Índices inútiles eliminados:*")
            for d in dropped:
                lines.append(f"  • {d}")
        else:
            lines.append("✨ No se encontraron índices inútiles para eliminar.")
            
        lines.append("")
        
        if created:
            lines.append("⚡ *Índices faltantes creados:*")
            for c in created:
                lines.append(f"  • {c}")
        else:
            lines.append("✨ No se encontraron índices faltantes para crear.")
            
        if errors:
            lines.append("")
            lines.append("⚠️ *Errores durante la ejecución:*")
            for err in errors:
                lines.append(f"  • {err}")
                
        return "\n".join(lines)
    else:
        return f"❌ *Error al optimizar estructura:* {res.get('message', 'Desconocido')}"

def _format_dashboard():
    from app.models.base import Configuracion
    frontend_url_conf = Configuracion.query.filter_by(clave='frontend_url').first()
    frontend_url = frontend_url_conf.valor if frontend_url_conf else 'http://localhost:5173'
    
    lines = [
        "🌐 *DASHBOARD WEB*",
        "",
        f"Accede a la consola de administración aquí:",
        f"👉 {frontend_url}"
    ]
    return "\n".join(lines)


def _format_comandos():
    lines = [
        "📋 *COMANDOS DISPONIBLES*",
        "",
        "0. /help (o /ayuda)",
        "   → Muestra esta lista completa de comandos con explicaciones",
        "",
        "1. /estado",
        "   → Muestra el estado actual de fragmentación de todos los índices monitoreados",
        "",
        "2. /recomendar",
        "   → Analiza tablas fragmentadas y sugiere el FillFactor óptimo para mejorar rendimiento",
        "",
        "3. /recomendar <nombre_tabla>",
        "   → Analiza una tabla específica y recomienda FillFactor ideal",
        "",
        "4. /optimizar",
        "   → Ejecuta REBUILD o REORGANIZE automáticamente en todas las tablas críticas (>=30% fragmentación)",
        "",
        "5. /optimizar <nombre_tabla>",
        "   → Ejecuta REBUILD/REORGANIZE sobre una tabla específica",
        "",
        "6. /historial",
        "   → Muestra las últimas métricas de fragmentación registradas en el sistema",
        "",
        "7. /alertas",
        "   → Muestra umbrales configurados y permite ajustar alertas automáticas",
        "",
        "8. /alertar",
        "   → Ejecuta un chequeo manual completo de alertas y envía notificaciones si hay problemas",
        "",
        "9. /indices",
        "   → Resumen de índices inútiles (sin uso) y faltantes sugeridos",
        "",
        "10. /crear_indice <id>",
        "   → Crea un índice faltante sugerido por el análisis",
        "",
        "11. /optimizar_indices (o /limpiar_indices)",
        "   → Elimina índices inútiles y crea todos los índices faltantes de forma automática",
        "",
        "12. /espacio",
        "   → Reporte detallado de uso de espacio en disco de la base de datos",
        "",
        "13. /conexiones",
        "   → Muestra las conexiones activas a la base de datos por estado",
        "",
        "14. /dashboard",
        "   → Obtiene la URL de acceso a la consola web SmartFill",
        "",
        "💡 *Para consultas libres:* Mencióname con @BotSmartfill seguido de tu pregunta.",
        "   Ejemplo: @BotSmartfill ¿qué tabla tiene más fragmentación?"
    ]
    return "\n".join(lines)



def _send_reply(session_id, chat_id, text):
    try:
        # WhatsApp tiene límite de ~4096 caracteres por mensaje
        MAX_LEN = 4000
        if len(text) > MAX_LEN:
            text = text[:MAX_LEN] + "\n\n... (mensaje truncado por límite de WhatsApp)"
        wsp_service.send_message(session_id, chat_id, text)
    except Exception as e:
        print(f"❌ Error enviando respuesta por WhatsApp: {e}")
        # Intentar enviar mensaje de error corto al usuario
        try:
            wsp_service.send_message(session_id, chat_id, "⚠️ Ocurrió un error enviando la respuesta completa. Intenta con una consulta más corta.")
        except:
            pass

#======================= COMANDOS =======================
def _handle_command(text, active_bot_session, chat_id):
    text = text.strip()
    parts = text.split()
    command = parts[0].lower()
    args = parts[1:] if len(parts) > 1 else []

    context_service.add_event(chat_id, "command", text)

    conn = DatabaseConnection.query.filter_by(is_active=True).first()
    if not conn:
        _send_reply(active_bot_session, chat_id,
            "⚠️ No hay una base de datos activa. Configura una desde el dashboard web o usa /alertas para ver opciones.")
        return

    if command == '/help' or command == '/ayuda':
        response = _format_comandos()
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/help consultado")

    elif command == '/estado':
        try:
            response = _format_estado(conn)
        except Exception as e:
            response = f"❌ Error al consultar fragmentación: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", f"/estado: {len(response)} caracteres")

    elif command == '/recomendar':
        table_name = args[0] if args else None
        try:
            response = _format_recomendar(conn, table_name)
        except Exception as e:
            response = f"❌ Error al generar recomendación: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", f"/recomendar {table_name or 'todas'}")

    elif command == '/optimizar':
        if not args:
            try:
                response = _format_optimizar_all(conn)
            except Exception as e:
                response = f"❌ Error al ejecutar optimización masiva: {str(e)}"
            _send_reply(active_bot_session, chat_id, response)
            context_service.add_event(chat_id, "optimization", f"/optimizar masivo: {response[:200]}")
        else:
            table_name = args[0]
            try:
                response = _format_optimizar(conn, table_name)
            except Exception as e:
                response = f"❌ Error al ejecutar optimización: {str(e)}"
            _send_reply(active_bot_session, chat_id, response)
            context_service.add_event(chat_id, "optimization", f"/optimizar {table_name}: {response[:200]}")

    elif command == '/indices_salud' or command == '/indices':
        try:
            response = _format_indices(conn)
        except Exception as e:
            response = f"❌ Error al consultar índices: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/indices consultado")

    elif command == '/crear_indice':
        if not args:
            _send_reply(active_bot_session, chat_id, "⚠️ Debes especificar el ID (group_handle) del índice a crear. Ejemplo: /crear_indice 12345")
            return
        group_handle = args[0]
        try:
            response = _format_crear_indice(conn, group_handle)
        except Exception as e:
            response = f"❌ Error al crear índice: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", f"/crear_indice {group_handle}")

    elif command == '/optimizar_indices' or command == '/limpiar_indices':
        try:
            response = _format_optimizar_indices(conn)
        except Exception as e:
            response = f"❌ Error al optimizar estructura de índices: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/optimizar_indices ejecutado")


    elif command == '/espacio':
        try:
            response = _format_espacio(conn)
        except Exception as e:
            response = f"❌ Error al consultar espacio: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/espacio consultado")

    elif command == '/conexiones':
        try:
            response = _format_conexiones(conn)
        except Exception as e:
            response = f"❌ Error al consultar conexiones: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/conexiones consultado")

    elif command == '/historial':
        table_name = args[0] if args else None
        try:
            response = _format_historial(table_name)
        except Exception as e:
            response = f"❌ Error al consultar historial: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", f"/historial {table_name or ''}")

    elif command == '/alertas':
        if args and args[0].lower() == 'set' and len(args) >= 3:
            from app.models.base import Configuracion
            from app.extensions import db
            if args[1].lower() == 'umbral':
                try:
                    val = float(args[2])
                    conf = Configuracion.query.filter_by(clave='alert_umbral').first()
                    if not conf:
                        conf = Configuracion(clave='alert_umbral', valor=str(val))
                        db.session.add(conf)
                    else:
                        conf.valor = str(val)
                    db.session.commit()
                    response = f"✅ Umbral de alerta actualizado a {val}%"
                except:
                    response = "❌ Valor de umbral inválido. Usa un número, ej: /alertas set umbral 25"
            elif args[1].lower() == 'horario':
                val = args[2]
                conf = Configuracion.query.filter_by(clave='horario_mantenimiento').first()
                if not conf:
                    conf = Configuracion(clave='horario_mantenimiento', valor=val)
                    db.session.add(conf)
                else:
                    conf.valor = val
                db.session.commit()
                response = f"✅ Horario de mantenimiento actualizado a {val}"
            else:
                response = "⚠️ Uso incorrecto. Ej: /alertas set umbral 25 o /alertas set horario 02:00"
            _send_reply(active_bot_session, chat_id, response)
            context_service.add_event(chat_id, "command_result", "/alertas set ejecutado")
        else:
            response = _format_alertas()
            _send_reply(active_bot_session, chat_id, response)
            context_service.add_event(chat_id, "command_result", "/alertas consultado")

    elif command == '/alertar':
        try:
            response = _format_alertar(conn)
        except Exception as e:
            response = f"❌ Error ejecutando chequeo de alertas: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/alertar ejecutado")

    elif command == '/dashboard':
        response = _format_dashboard()
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", "/dashboard consultado")

    else:
        _send_reply(active_bot_session, chat_id,
            f"⚠️ Comando no reconocido: {command}\n"
            f"Escribe /help para ver la lista completa de comandos con sus descripciones.")


@bp.route('/send', methods=['POST'])
def send_message():
    data = request.json
    phone = data.get('phone')
    text = data.get('text')

    if not phone or not text:
        return jsonify({"error": "Faltan los campos 'phone' o 'text'"}), 400

    bot_session_conf = Configuracion.query.filter_by(clave='bot_session').first()
    if not bot_session_conf or not bot_session_conf.valor:
        return jsonify({"error": "No hay una sesión de bot activa configurada"}), 400

    session_id = bot_session_conf.valor
    phone = phone.lstrip('+')
    chat_id = f"{phone}@c.us" if not (phone.endswith('@c.us') or phone.endswith('@g.us') or phone.endswith('@lid')) else phone
    try:
        response = wsp_service.send_message(session_id, chat_id, text)
        return jsonify({"status": "success", "message": "Mensaje despachado a OpenWA", "data": response})
    except Exception as e:
        print(f"❌ Error en send_message route: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/chat-test', methods=['POST'])
def chat_test():
    from flask import Response, stream_with_context
    from app.services.ai_service import _build_db_context_fast, _get_cached_db_context
    data = request.json
    user_text = data.get('text', '').strip()
    if not user_text:
        return jsonify({"error": "Texto vacío"}), 400

    conn = DatabaseConnection.query.filter_by(is_active=True).first()
    db_str = _get_cached_db_context(conn.id, lambda: _build_db_context_fast(conn)) if conn else ""
    chat_str = context_service.get_context("TEST_GUI")
    context_service.add_event("TEST_GUI", "message", user_text)

    if user_text.startswith('/'):
        # Intercept commands to run them via _handle_command and capture output
        import app.api.routes.whatsapp as wa
        original_send = wa._send_reply
        response_container = []
        def mock_send(session_id, cid, text):
            response_container.append(text)
        wa._send_reply = mock_send
        try:
            wa._handle_command(user_text, 'mock_session', "TEST_GUI")
        finally:
            wa._send_reply = original_send

        res_text = response_container[0] if response_container else "⚠️ Comando procesado pero sin respuesta."
        context_service.add_event("TEST_GUI", "ai_response", res_text[:300])
        
        def generate_command():
            yield f"data: {res_text.replace(chr(10), '\\n')}\n\n"
            yield "data: __END__\n\n"
            
        return Response(
            stream_with_context(generate_command()),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )

    def generate():
        full_response = []
        for chunk in ai_service.generate_response_stream(user_text, db_context=db_str, chat_context=chat_str):
            full_response.append(chunk)
            yield chunk
        response_text = "".join(
            c.replace("data: ", "").replace("\\n", "\n").strip()
            for c in full_response
            if c.startswith("data: ") and "__END__" not in c and "__TOOL__" not in c
        )
        context_service.add_event("TEST_GUI", "ai_response", response_text[:300])

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

@bp.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    print("\n" + "="*50)
    print(f"[WEBHOOK INCOMING] Payload raw:\n{data}")

    try:
        event_type = data.get('event', '')
        msg_data = data.get('data', {})
        session_id = data.get('sessionId') or data.get('session')

        print(f"[WEBHOOK DEBUG] Evento: '{event_type}' | SessionId: '{session_id}'")

        is_message_event = event_type == 'message.received'
        is_session_event = event_type.startswith('session.')

        if is_message_event:
            if msg_data.get('fromMe'):
                print("[WEBHOOK DEBUG] Ignorado: fromMe=true (mensaje enviado por el bot)")
                return jsonify({"status": "ignored", "reason": "fromMe"}), 200

            texto_recibido = msg_data.get('body', '') or msg_data.get('text', '') or msg_data.get('caption', '')
            chat_id = msg_data.get('from') or msg_data.get('chatId') or msg_data.get('remoteJid')

            print(f"[WEBHOOK DEBUG] De: '{chat_id}' | Texto: '{texto_recibido}' | Tipo: '{event_type}'")

            if not texto_recibido or not chat_id:
                print("[WEBHOOK DEBUG] Ignorado: sin texto o chat_id")
                return jsonify({"status": "ignored", "reason": "empty"}), 200

            msg_id = msg_data.get('id') or data.get('idempotencyKey') or f"{chat_id}:{texto_recibido}"
            body_key = f"body:{chat_id}:{texto_recibido}"
            now = time.time()
            if (now - _recent_events.get(msg_id, 0) < DEDUP_WINDOW or
                now - _recent_events.get(body_key, 0) < DEDUP_WINDOW):
                print(f"[WEBHOOK DEBUG] Ignorado: duplicado (msg_id o mismo texto en {DEDUP_WINDOW}s)")
                return jsonify({"status": "ignored", "reason": "duplicate"}), 200
            _recent_events[msg_id] = now
            _recent_events[body_key] = now
            if len(_recent_events) > 500:
                cutoff = now - (DEDUP_WINDOW * 2)
                for k in list(_recent_events.keys()):
                    if _recent_events[k] < cutoff:
                        del _recent_events[k]

            bot_session_conf = Configuracion.query.filter_by(clave='bot_session').first()
            active_bot_session = bot_session_conf.valor if bot_session_conf else None

            print(f"[WEBHOOK DEBUG] Sesión DB: '{active_bot_session}' | Sesión evento: '{session_id}'")

            if not active_bot_session or session_id != active_bot_session:
                print("[WEBHOOK DEBUG] Ignorado: sesión no coincide con la configurada para el bot")
                return jsonify({"status": "ignored", "reason": "session mismatch"}), 200

            allowed_conf = Configuracion.query.filter_by(clave='allowed_chat').first()
            admin_chat = allowed_conf.valor if allowed_conf else None
            if not admin_chat:
                fallback = Configuracion.query.filter_by(clave='admin_phone').first()
                admin_chat = fallback.valor if fallback else None
            if admin_chat and chat_id != admin_chat:
                print(f"[WEBHOOK DEBUG] Ignorado: chat '{chat_id}' no es el autorizado ('{admin_chat}')")
                return jsonify({"status": "ignored", "reason": "chat not authorized"}), 200

            texto = texto_recibido.strip()

            alias_conf = Configuracion.query.filter_by(clave='bot_alias').first()
            bot_alias = (alias_conf.valor or '@BotSmartfill').strip()

            context_service.add_event(chat_id, "message", texto)

            if texto.startswith('/'):
                print(f"[WEBHOOK DEBUG] Comando detectado: {texto}")
                _handle_command(texto, active_bot_session, chat_id)

            elif bot_alias.lower() in texto.lower():
                print(f"[WEBHOOK DEBUG] Alias '{bot_alias}' detectado, llamando al LLM...")
                conn = DatabaseConnection.query.filter_by(is_active=True).first()
                db_str = build_db_context(conn) if conn else ""
                chat_str = context_service.get_context(chat_id)
                commands_str = _format_comandos()
                user_msg = texto.replace(bot_alias, '').strip()
                if not user_msg:
                    user_msg = "Hola, ¿en qué puedes ayudarme?"
                respuesta_ia = ai_service.generate_response(user_msg, db_context=db_str, chat_context=chat_str, commands_info=commands_str)
                respuesta_ia = f"🤖 SmartFill:\n{respuesta_ia}"
                context_service.add_event(chat_id, "ai_query", user_msg)
                context_service.add_event(chat_id, "ai_response", respuesta_ia[:300])
                print(f"[WEBHOOK DEBUG] IA respondió: {respuesta_ia[:80]}...")
                _send_reply(active_bot_session, chat_id, respuesta_ia)

            else:
                print(f"[WEBHOOK DEBUG] Ignorado: no contiene alias ni comando. Solo se guarda en contexto.")

            print("[WEBHOOK DEBUG] Listo.")

        elif is_session_event:
            print(f"[WEBHOOK DEBUG] Evento de sesión ignorado (solo log): {event_type}")

        else:
            print(f"[WEBHOOK DEBUG] Evento desconocido ignorado: '{event_type}'")

        print("="*50 + "\n")
        return jsonify({"status": "received"}), 200

    except Exception as e:
        print(f"[WEBHOOK ERROR] {str(e)}")
        traceback.print_exc()
        print("="*50 + "\n")
        return jsonify({"error": str(e)}), 500

@bp.route('/sessions', methods=['GET'])
def list_sessions():
    try:
        sessions = wsp_service.get_sessions()
        if isinstance(sessions, dict):
            data = sessions.get('data', sessions)
        else:
            data = sessions
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        print(f"⚠️ OpenWA apagado (ignorando error): {str(e)[:100]}")
        return jsonify({"status": "success", "data": []})

@bp.route('/sessions', methods=['POST'])
def create_session():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "El campo 'name' es requerido"}), 400
    result = wsp_service.create_session(name)
    if result:
        session_data = result.get('data', result) if isinstance(result, dict) else result
        return jsonify({"status": "success", "data": session_data})
    return jsonify({"error": "Error creando sesión en OpenWA. Verifica que OpenWA esté corriendo y que el nombre no esté duplicado."}), 500

@bp.route('/sessions/<session_id>/start', methods=['POST'])
def start_session(session_id):
    result = wsp_service.start_session(session_id)
    if result:
        return jsonify({"status": "success", "data": result})
    return jsonify({"error": "Error iniciando sesión en OpenWA"}), 500

@bp.route('/sessions/<session_id>/qr', methods=['GET'])
def get_qr(session_id):
    result = wsp_service.get_qr(session_id)
    if result:
        return jsonify({"status": "success", "data": result})
    return jsonify({"error": "Error obteniendo QR de OpenWA"}), 500

@bp.route('/chats', methods=['GET'])
def list_chats():
    session_id = request.args.get('session_id')
    if not session_id:
        conf = Configuracion.query.filter_by(clave='bot_session').first()
        session_id = conf.valor if conf else None
    if not session_id:
        return jsonify({"status": "success", "data": []})
    chats = wsp_service.get_chats(session_id)
    return jsonify({"status": "success", "data": chats})

@bp.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    result = wsp_service.delete_session(session_id)
    if result is not None:
        return jsonify({"status": "success", "data": result})
    return jsonify({"error": "Error eliminando sesión en OpenWA"}), 500

@bp.route('/sessions/<session_id>/activate', methods=['POST'])
def activate_session(session_id):
    conf = Configuracion.query.filter_by(clave='bot_session').first()
    if conf:
        conf.valor = session_id
    else:
        conf = Configuracion(clave='bot_session', valor=session_id)
        db.session.add(conf)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

    webhook_url = current_app.config.get('WA_WEBHOOK_URL', '')
    if webhook_url:
        wsp_service.register_webhook(session_id, webhook_url)
    else:
        print("⚠️ WA_WEBHOOK_URL no configurada — webhook no registrado en OpenWA")

    start_result = wsp_service.start_session(session_id)
    if start_result:
        print(f"✅ Sesión '{session_id}' iniciada en OpenWA")
    else:
        print(f"⚠️ No se pudo iniciar la sesión '{session_id}' en OpenWA (posiblemente ya activa)")

    return jsonify({"status": "success", "message": f"Sesión {session_id} activada como bot_session"})
