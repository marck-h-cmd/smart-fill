import os
from app.models.base import Configuracion

class AIService:
    def __init__(self):
        self.system_prompt = """Eres SmartFill, un asistente experto en bases de datos SQL Server. 
Tu rol principal es ayudar a los DBAs a monitorear la fragmentación de índices, 
sugerir el FillFactor ideal y alertar sobre métricas críticas.
Responde de manera profesional, concisa y usando terminología técnica adecuada."""

    def generate_response(self, user_message: str, context: str = "") -> str:
        # Obtener configuracion actual desde la base de datos
        modelo_conf = Configuracion.query.filter_by(clave='ai_model').first()
        api_key_conf = Configuracion.query.filter_by(clave='ai_api_key').first()
        
        if not modelo_conf or not api_key_conf or not modelo_conf.valor or not api_key_conf.valor:
            return "⚠️ El chatbot no está configurado. Por favor, configura el modelo y la API Key en el dashboard."
            
        model_name = modelo_conf.valor
        api_key = api_key_conf.valor

        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        if context:
            messages.append({"role": "system", "content": f"Contexto de la base de datos actual:\n{context}"})
            
        messages.append({"role": "user", "content": user_message})

        try:
            from litellm import completion
            response = completion(
                model=model_name,
                messages=messages,
                api_key=api_key
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generando respuesta de IA: {e}")
            return f"❌ Ocurrió un error con el modelo de IA: {str(e)}"
