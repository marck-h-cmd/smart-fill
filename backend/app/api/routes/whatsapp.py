from flask import Blueprint, request, jsonify
from app.services.whatsapp_service import WhatsAppService

bp = Blueprint('whatsapp', __name__, url_prefix='/api/whatsapp')
wsp_service = WhatsAppService()

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

@bp.route('/webhook', methods=['POST'])
def webhook():
    """
    Este endpoint recibirá los eventos de OpenWA.
    Fase 1: Implementaremos un Ping-Pong básico.
    """
    data = request.json
    
    # Extraer el evento (dependiendo de cómo envíe el webhook OpenWA, usualmente 'event' y 'payload')
    event_type = data.get('event')
    payload = data.get('payload', {})
    
    # Si es un mensaje nuevo recibido
    if event_type == 'message.any' or event_type == 'message':
        # En WA_SESSIONS, el cuerpo suele estar en 'body' o 'text'
        texto_recibido = payload.get('body', '')
        if not texto_recibido:
             texto_recibido = payload.get('text', '')
             
        chat_id = payload.get('from') or payload.get('chatId')
        
        # Lógica de Ping-Pong
        if texto_recibido.strip().lower() == 'ping' and chat_id:
            # En la vida real, sacaríamos la sesión del webhook event o usaríamos una configurada.
            print(f"[Webhook] Recibido 'ping' de {chat_id}, respondiendo 'pong'")
            wsp_service.send_message("default", chat_id, "pong 🤖 (Respuesta automática de SmartFill)")
            
    return jsonify({"status": "received"}), 200

@bp.route('/sessions', methods=['GET'])
def list_sessions():
    sessions = wsp_service.get_sessions()
    return jsonify({"status": "success", "data": sessions})
