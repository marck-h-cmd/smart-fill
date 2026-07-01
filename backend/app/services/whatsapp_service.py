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
            raise Exception("WA_API_KEY no configurada")

        if not chat_id.endswith('@c.us') and not chat_id.endswith('@lid'):
            chat_id = f"{chat_id}@c.us"

        url = f"{self.api_url}/api/sessions/{session_id}/messages/send-text"
        payload = {"chatId": chat_id, "text": text}

        try:
            response = requests.post(url, json=payload, headers=self.headers, timeout=15)
            response.raise_for_status()
            print(f"✅ Mensaje enviado a {chat_id} vía '{session_id}'")
            return response.json()
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            body = e.response.text if e.response is not None else ''
            detail = f"OpenWA respondió HTTP {status}: {body}"
            print(f"❌ {detail}")
            raise Exception(detail)
        except requests.exceptions.ConnectionError:
            msg = f"No se pudo conectar con OpenWA en {self.api_url}"
            print(f"❌ {msg}")
            raise Exception(msg)
        except requests.exceptions.Timeout:
            msg = "Timeout al enviar mensaje a OpenWA"
            print(f"❌ {msg}")
            raise Exception(msg)
        except requests.exceptions.RequestException as e:
            print(f"❌ Error enviando mensaje: {e}")
            raise Exception(str(e))

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
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            body = e.response.text if e.response is not None else ''
            print(f"❌ Error creando sesión (HTTP {status}): {body}")
            if status == 409:
                print(f"   ↳ La sesión '{name}' ya existe. Buscándola...")
                existing = self._find_existing_session(name)
                if existing:
                    return existing
            return None
        except requests.exceptions.RequestException as e:
            print(f"❌ Error de conexión creando sesión: {e}")
            return None

    def _find_existing_session(self, name):
        sessions_data = self.get_sessions()
        if isinstance(sessions_data, dict):
            items = sessions_data.get('data', [])
        elif isinstance(sessions_data, list):
            items = sessions_data
        else:
            items = []
        for s in items:
            if s.get('name') == name or s.get('id') == name:
                print(f"   ↳ Sesión existente encontrada: {s.get('id', s.get('name'))}")
                return s
        print(f"   ↳ No se encontró sesión existente con nombre '{name}'")
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

    def register_webhook(self, session_id, webhook_url, secret=None):
        if not webhook_url:
            print("❌ WA_WEBHOOK_URL no configurada")
            return None
        url = f"{self.api_url}/api/sessions/{session_id}/webhooks"
        payload = {
            "url": webhook_url,
            "events": ["message.received", "session.status"]
        }
        if secret:
            payload["secret"] = secret
        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            print(f"✅ Webhook registrado para sesión '{session_id}' → {webhook_url}")
            return response.json()
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            body = e.response.text if e.response is not None else ''
            print(f"❌ Error registrando webhook (HTTP {status}): {body}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"❌ Error de conexión registrando webhook: {e}")
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