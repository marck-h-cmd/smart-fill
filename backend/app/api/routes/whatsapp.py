import traceback
from flask import Blueprint, request, jsonify
from app.services.whatsapp_service import WhatsAppService
from app.services.ai_service import AIService
from app.models.base import Configuracion
from app.models.database_connection import DatabaseConnection
from app.services.fragmentation_service import get_top_fragmented
from app.services.recommendation_service import recommend_for_table, recommend_top_critical
from app.services.optimization_service import execute_optimization
from app.services.history_service import get_history

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
    lines = [
        "🔔 *CONFIGURACIÓN DE ALERTAS*",
        f"",
        f"   📊 Umbral fragmentación crítica: {umbral.valor if umbral else '30'}%",
        f"   🕐 Horario de mantenimiento: {horario.valor if horario else '02:00'}",
        f"",
        f"*Comandos disponibles:*",
        f"   /alertas set umbral <valor>   - Cambiar umbral crítico",
        f"   /alertas set horario <HH:MM>   - Cambiar horario mantenimiento",
    ]
    return "\n".join(lines)

def _handle_command(text, active_bot_session, chat_id):
    text = text.strip()
    parts = text.split()
    command = parts[0].lower()
    args = parts[1:] if len(parts) > 1 else []

    conn = DatabaseConnection.query.filter_by(is_active=True).first()
    if not conn:
        wsp_service.send_message(active_bot_session, chat_id,
            "⚠️ No hay una base de datos activa. Configura una desde el dashboard web o usa /alertas para ver opciones.")
        return

    if command == '/estado':
        try:
            response = _format_estado(conn)
        except Exception as e:
            response = f"❌ Error al consultar fragmentación: {str(e)}"
        wsp_service.send_message(active_bot_session, chat_id, response)

    elif command == '/recomendar':
        table_name = args[0] if args else None
        try:
            response = _format_recomendar(conn, table_name)
        except Exception as e:
            response = f"❌ Error al generar recomendación: {str(e)}"
        wsp_service.send_message(active_bot_session, chat_id, response)

    elif command == '/optimizar':
        if not args:
            wsp_service.send_message(active_bot_session, chat_id,
                "⚠️ Debes especificar un nombre de tabla. Ejemplo: /optimizar Ventas")
            return
        table_name = args[0]
        try:
            response = _format_optimizar(conn, table_name)
        except Exception as e:
            response = f"❌ Error al ejecutar optimización: {str(e)}"
        wsp_service.send_message(active_bot_session, chat_id, response)

    elif command == '/historial':
        table_name = args[0] if args else None
        try:
            response = _format_historial(table_name)
        except Exception as e:
            response = f"❌ Error al consultar historial: {str(e)}"
        wsp_service.send_message(active_bot_session, chat_id, response)

    elif command == '/alertas':
        response = _format_alertas()
        wsp_service.send_message(active_bot_session, chat_id, response)

    else:
        wsp_service.send_message(active_bot_session, chat_id,
            f"⚠️ Comando no reconocido: {command}\n"
            f"Comandos disponibles: /estado, /recomendar, /optimizar, /historial, /alertas")

@bp.route('/send', methods=['PsessionOST'])
def send_message():
    data = request.json
    phone = data.get('phone')
    text = data.get('text')
    session_name = data.get('session')

    if not phone or not text or not session_name:
        return jsonify({"error": "Faltan los campos 'phone', 'text' o 'session'"}), 400

    chat_id = f"{phone}@c.us" if not phone.endswith('@c.us') else phone
    response = wsp_service.send_message(session_name, chat_id, text)

    if response is not None:
        return jsonify({"status": "success", "message": "Mensaje despachado a OpenWA", "data": response})
    else:
        return jsonify({"error": "Error de comunicación con OpenWA"}), 500

@bp.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    print("\n" + "="*50)
    print(f"[WEBHOOK INCOMING] Payload raw:\n{data}")

    try:
        event_type = data.get('event')
        msg_data = data.get('data', {})
        session_id = data.get('sessionId') or data.get('session')

        print(f"[WEBHOOK DEBUG] Evento: '{event_type}' | SessionId: '{session_id}'")

        if event_type == 'message.received':
            if msg_data.get('fromMe'):
                print("[WEBHOOK DEBUG] Ignorado: fromMe=true")
                return jsonify({"status": "ignored", "reason": "fromMe"}), 200

            texto_recibido = msg_data.get('body', '') or msg_data.get('text', '')
            chat_id = msg_data.get('from') or msg_data.get('chatId')

            print(f"[WEBHOOK DEBUG] De: '{chat_id}' | Texto: '{texto_recibido}'")

            if not texto_recibido or not chat_id:
                print("[WEBHOOK DEBUG] Ignorado: sin texto o chat_id")
                return jsonify({"status": "ignored", "reason": "empty"}), 200

            bot_session_conf = Configuracion.query.filter_by(clave='bot_session').first()
            active_bot_session = bot_session_conf.valor if bot_session_conf else None

            print(f"[WEBHOOK DEBUG] Sesión DB: '{active_bot_session}' | Sesión evento: '{session_id}'")

            if not active_bot_session or session_id != active_bot_session:
                print("[WEBHOOK DEBUG] Ignorado: sesión no coincide con la configurada para el bot")
                return jsonify({"status": "ignored", "reason": "session mismatch"}), 200

            # Detectar si es un comando "/"
            if texto_recibido.strip().startswith('/'):
                print(f"[WEBHOOK DEBUG] Comando detectado: {texto_recibido}")
                _handle_command(texto_recibido, active_bot_session, chat_id)
            else:
                print("[WEBHOOK DEBUG] Mensaje libre, llamando al LLM...")
                respuesta_ia = ai_service.generate_response(texto_recibido)
                print(f"[WEBHOOK DEBUG] IA respondió: {respuesta_ia[:80]}...")
                wsp_service.send_message(active_bot_session, chat_id, respuesta_ia)

            print("[WEBHOOK DEBUG] Listo.")

        else:
            print(f"[WEBHOOK DEBUG] Evento ignorado: '{event_type}'")

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
    return jsonify({"status": "success", "data": sessions})
