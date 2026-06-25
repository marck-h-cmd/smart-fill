from flask import Blueprint, request, jsonify
from app.services.whatsapp_service import WhatsAppService
from app.services.ai_service import AIService
from app.models.base import Configuracion

bp = Blueprint('whatsapp', __name__, url_prefix='/api/whatsapp')
wsp_service = WhatsAppService()
ai_service = AIService()

@bp.route('/send', methods=['POST'])
def send_message():
    data = request.json
    phone = data.get('phone')
    text = data.get('text')
    session_name = data.get('session')
    
    if not phone or not text or not session_name:
        return jsonify({"error": "Faltan los campos 'phone', 'text' o 'session'"}), 400
        
    # OpenWA requiere que el chat_id termine en @c.us para contactos normales
    chat_id = f"{phone}@c.us" if not phone.endswith('@c.us') else phone
    
    # Llamamos a nuestro servicio de WhatsApp
    response = wsp_service.send_message(session_name, chat_id, text)
    
    if response is not None:
        return jsonify({"status": "success", "message": "Mensaje despachado a OpenWA", "data": response})
    else:
        return jsonify({"error": "Error de comunicación con OpenWA"}), 500

import traceback

@bp.route('/webhook', methods=['POST'])
def webhook():
    """
    Recibe eventos de OpenWA según la estructura real de la API:
    {
      "event": "message.received",
      "sessionId": "sess_abc123",
      "data": { "body": "...", "from": "...", "fromMe": false, ... }
    }
    """
    data = request.json
    print("\n" + "="*50)
    print(f"[WEBHOOK INCOMING] Payload raw:\n{data}")

    try:
        event_type = data.get('event')
        # La doc dice que los datos van en 'data', NO en 'payload'
        msg_data = data.get('data', {})
        session_id = data.get('sessionId') or data.get('session')

        print(f"[WEBHOOK DEBUG] Evento: '{event_type}' | SessionId: '{session_id}'")

        # Sólo procesamos mensajes entrantes (event = message.received según la doc)
        if event_type == 'message.received':
            # Ignorar mensajes propios para evitar bucles
            if msg_data.get('fromMe'):
                print("[WEBHOOK DEBUG] Ignorado: fromMe=true")
                return jsonify({"status": "ignored", "reason": "fromMe"}), 200

            texto_recibido = msg_data.get('body', '') or msg_data.get('text', '')
            chat_id = msg_data.get('from') or msg_data.get('chatId')

            print(f"[WEBHOOK DEBUG] De: '{chat_id}' | Texto: '{texto_recibido}'")

            if not texto_recibido or not chat_id:
                print("[WEBHOOK DEBUG] Ignorado: sin texto o chat_id")
                return jsonify({"status": "ignored", "reason": "empty"}), 200

            # Verificar que esta sesión es la configurada como bot
            bot_session_conf = Configuracion.query.filter_by(clave='bot_session').first()
            active_bot_session = bot_session_conf.valor if bot_session_conf else None

            print(f"[WEBHOOK DEBUG] Sesión DB: '{active_bot_session}' | Sesión evento: '{session_id}'")

            if not active_bot_session or session_id != active_bot_session:
                print("[WEBHOOK DEBUG] Ignorado: sesión no coincide con la configurada para el bot")
                return jsonify({"status": "ignored", "reason": "session mismatch"}), 200

            print("[WEBHOOK DEBUG] ✅ Todo OK. Llamando al LLM...")
            respuesta_ia = ai_service.generate_response(texto_recibido)
            print(f"[WEBHOOK DEBUG] 🤖 IA respondió: {respuesta_ia[:80]}...")

            print("[WEBHOOK DEBUG] 🚀 Enviando respuesta vía OpenWA...")
            wsp_service.send_message(active_bot_session, chat_id, respuesta_ia)
            print("[WEBHOOK DEBUG] ✔️ Listo.")

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
