import os
from litellm import completion

class AIService:
    def __init__(self):
        # litellm automáticamente usará las variables de entorno de cada proveedor
        # (ej. GEMINI_API_KEY, OPENAI_API_KEY)
        # Vamos a definir un modelo por defecto (ej. gemini-1.5-pro o gpt-4o)
        self.default_model = "gemini/gemini-1.5-pro" 
        
        self.system_prompt = """Eres SmartFill, un asistente experto en bases de datos SQL Server. 
Tu rol principal es ayudar a los DBAs a monitorear la fragmentación de índices, 
sugerir el FillFactor ideal y alertar sobre métricas críticas.
Responde de manera profesional, concisa y usando terminología técnica adecuada."""

    def generate_response(self, user_message: str, context: str = "") -> str:
        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        if context:
            messages.append({"role": "system", "content": f"Contexto de la base de datos actual:\n{context}"})
            
        messages.append({"role": "user", "content": user_message})

        try:
            response = completion(
                model=self.default_model,
                messages=messages
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generando respuesta de IA: {e}")
            return "Ocurrió un error al procesar tu solicitud."
