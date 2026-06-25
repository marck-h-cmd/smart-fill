import os
import requests

class WhatsAppService:
    def __init__(self):
        self.api_url = os.getenv('OPENWA_API_URL', 'http://localhost:2785/api')
        self.api_key = os.getenv('OPENWA_API_KEY')
        
    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key
        }
        
    def send_message(self, session_name: str, chat_id: str, text: str):
        """
        Envía un mensaje de texto usando OpenWA.
        chat_id usualmente es el numero en formato internacional + '@c.us' (ej: 51999999999@c.us)
        """
        url = f"{self.api_url}/sessions/{session_name}/messages/send-text"
        payload = {
            "chatId": chat_id,
            "text": text
        }
        
        try:
            response = requests.post(url, json=payload, headers=self.get_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error enviando mensaje WhatsApp: {e}")
            return None

    def get_sessions(self):
        """Obtiene la lista de sesiones desde OpenWA"""
        url = f"{self.api_url}/sessions"
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error obteniendo sesiones de WhatsApp: {e}")
            return []
