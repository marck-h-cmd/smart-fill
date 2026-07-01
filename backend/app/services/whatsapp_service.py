import os
import requests

class WhatsAppService:
    def __init__(self, api_url=None, api_key=None):
        self.api_url = api_url or os.getenv('WA_API_URL', 'http://localhost:2785')
        self.api_key = api_key or os.getenv('WA_API_KEY', '')
        self.headers = {
            "X-API-Key": self.api_key,   # <--- Cambio crítico
            "Content-Type": "application/json"
        }

    def send_message(self, session_id: str, chat_id: str, text: str):
        if not self.api_key:
            print("❌ WA_API_KEY no configurada")
            return None

        # Asegura el formato del chat_id
        if not chat_id.endswith('@c.us') and not chat_id.endswith('@lid'):
            chat_id = f"{chat_id}@c.us"

        # URL correcta (la que usa el dashboard)
        url = f"{self.api_url}/api/sessions/{session_id}/messages/send-text"
        payload = {
            "chatId": chat_id,
            "text": text
        }

        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            print("✅ Mensaje enviado correctamente")
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error enviando mensaje: {e}")
            if hasattr(e, 'response') and e.response:
                print(f"   Respuesta: {e.response.text}")
            return None

    def get_sessions(self):
        url = f"{self.api_url}/api/sessions"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error obteniendo sesiones: {e}")
            return []

    def create_session(self, name):
        url = f"{self.api_url}/api/sessions"
        try:
            response = requests.post(url, json={"name": name}, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error creando sesión: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Respuesta: {e.response.text}")
            return None

    def start_session(self, session_id):
        url = f"{self.api_url}/api/sessions/{session_id}/start"
        try:
            response = requests.post(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error iniciando sesión: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Respuesta: {e.response.text}")
            return None

    def get_qr(self, session_id):
        url = f"{self.api_url}/api/sessions/{session_id}/qr"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error obteniendo QR: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Respuesta: {e.response.text}")
            return None

    def delete_session(self, session_id):
        url = f"{self.api_url}/api/sessions/{session_id}"
        try:
            response = requests.delete(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error eliminando sesión: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Respuesta: {e.response.text}")
            return None