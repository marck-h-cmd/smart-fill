import os
import logging
import warnings
from app.models.base import Configuracion
from app.services.fragmentation_service import get_dashboard_stats, get_top_fragmented, get_all_user_tables

warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
logging.getLogger('LiteLLM').setLevel(logging.ERROR)

try:
    from litellm import completion
except ImportError:
    completion = None
    print("ERROR: litellm no está instalado. Ejecuta: pip install litellm")

class AIService:
    def __init__(self):
        self.system_prompt = """Eres SmartFill, un asistente experto en bases de datos SQL Server. 
Tu rol principal es ayudar a los DBAs a monitorear la fragmentación de índices, 
sugerir el FillFactor ideal y alertar sobre métricas críticas.
Responde de manera profesional, concisa y usando terminología técnica adecuada."""

    def generate_response(self, user_message: str, db_context: str = "", chat_context: str = "", commands_info: str = "") -> str:
        # Obtener configuracion actual desde la base de datos
        modelo_conf = Configuracion.query.filter_by(clave='ai_model').first()
        api_key_conf = Configuracion.query.filter_by(clave='ai_api_key').first()
        
        if not modelo_conf or not api_key_conf or not modelo_conf.valor or not api_key_conf.valor:
            return "⚠️ El chatbot no está configurado. Por favor, configura el modelo y la API Key en el dashboard."

        if completion is None:
            return "❌ Error de configuración: el módulo de IA (litellm) no está instalado. Contacta al administrador."
            
        model_name = modelo_conf.valor
        api_key = api_key_conf.valor

        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        if db_context:
            messages.append({"role": "system", "content": f"Contexto de la base de datos actual:\n{db_context}"})
        if chat_context:
            messages.append({"role": "system", "content": f"Historial de actividad reciente en este chat:\n{chat_context}"})
        if commands_info:
            messages.append({"role": "system", "content": f"Comandos disponibles que el usuario puede ejecutar:\n{commands_info}"})
            
        messages.append({"role": "user", "content": user_message})

        try:
            response = completion(
                model=model_name,
                messages=messages,
                api_key=api_key
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generando respuesta de IA: {e}")
            return f"❌ Ocurrió un error con el modelo de IA: {str(e)}"


def build_db_context(conn):
    lines = []
    lines.append(f"Base de datos: {conn.database}")

    try:
        stats = get_dashboard_stats(conn)
        lines.append(f"Índices monitoreados: {stats['total_indexes']}")
        lines.append(f"Fragmentación promedio: {stats['avg_fragmentation']}%")
        lines.append(f"Críticos (>=30%): {stats['critical_count']}")
        lines.append(f"Moderados (10-30%): {stats['moderate_count']}")
        lines.append(f"Saludables (<10%): {stats['healthy_count']}")
    except Exception:
        lines.append("(No se pudieron obtener estadísticas de fragmentación)")

    try:
        tables = get_all_user_tables(conn)
        table_count = len(tables)
        lines.append(f"")
        lines.append(f"Tablas de usuario ({table_count}):")
        for t in tables:
            lines.append(f"  - {t['table_name']} ({t['total_rows']} filas)")
    except Exception:
        lines.append("(No se pudieron listar las tablas)")

    try:
        top = get_top_fragmented(conn, limit=10)
        if top:
            lines.append(f"")
            lines.append("Top tablas más fragmentadas:")
            for t in top:
                lines.append(
                    f"  - {t['table_name']}: {t['fragmentation_percent']}% "
                    f"({t['suggested_action']}), {t['total_rows']} filas"
                )
    except Exception:
        pass

    return "\n".join(lines)
