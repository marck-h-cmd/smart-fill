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
    alert_umbral = int(alert_umbral_conf.valor) if alert_umbral_conf else 30
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

def _format_comandos():
    lines = [
        "📋 *COMANDOS DISPONIBLES*",
        "",
        "   /estado        - Muestra el estado de fragmentación de índices",
        "   /recomendar    - Sugiere FillFactor óptimo para tablas fragmentadas",
        "   /recomendar <tabla> - Recomendación específica para una tabla",
        "   /optimizar <tabla> - Ejecuta REBUILD/REORGANIZE sobre una tabla",
        "   /historial     - Últimas métricas de fragmentación registradas",
        "   /historial <tabla> - Historial de una tabla específica",
        "   /alertas       - Muestra y configura umbrales y horarios",
        "   /alertar       - Ejecuta chequeo completo de alertas manual",
        "",
        "💡 *Tip:* También puedes mencionarme con @" + "BotSmartfill seguido de tu consulta.",
        "   Ej: @BotSmartfill ¿qué tabla tiene más fragmentación?"
    ]
    return "\n".join(lines)


def _send_reply(session_id, chat_id, text):
    try:
        wsp_service.send_message(session_id, chat_id, text)
    except Exception as e:
        print(f"❌ Error enviando respuesta por WhatsApp: {e}")

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

    if command == '/estado':
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
            _send_reply(active_bot_session, chat_id,
                "⚠️ Debes especificar un nombre de tabla. Ejemplo: /optimizar Ventas")
            return
        table_name = args[0]
        try:
            response = _format_optimizar(conn, table_name)
        except Exception as e:
            response = f"❌ Error al ejecutar optimización: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "optimization", f"/optimizar {table_name}: {response[:200]}")

    elif command == '/historial':
        table_name = args[0] if args else None
        try:
            response = _format_historial(table_name)
        except Exception as e:
            response = f"❌ Error al consultar historial: {str(e)}"
        _send_reply(active_bot_session, chat_id, response)
        context_service.add_event(chat_id, "command_result", f"/historial {table_name or ''}")

    elif command == '/alertas':
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

    else:
        _send_reply(active_bot_session, chat_id,
            f"⚠️ Comando no reconocido: {command}\n"
            f"Comandos disponibles: /estado, /recomendar, /optimizar, /historial, /alertas, /alertar")

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

            elif bot_alias in texto:
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
    sessions = wsp_service.get_sessions()
    if isinstance(sessions, dict):
        data = sessions.get('data', sessions)
    else:
        data = sessions
    return jsonify({"status": "success", "data": data})

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
