import os
import re
import logging
import warnings

# Suprimir warnings de HuggingFace (litellm intenta descargar tokenizadores)
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
os.environ.setdefault('HF_DATASETS_OFFLINE', '1')
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
os.environ.setdefault('LITELLM_TELEMETRY', 'false')

from app.models.base import Configuracion
from app.services.fragmentation_service import get_dashboard_stats, get_top_fragmented, get_all_user_tables

warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
logging.getLogger('LiteLLM').setLevel(logging.ERROR)
logging.getLogger('huggingface_hub').setLevel(logging.ERROR)

try:
    from litellm import completion
except ImportError:
    completion = None
    print("ERROR: litellm no está instalado. Ejecuta: pip install litellm")

import json
import time
from sqlalchemy import text
from app.services.database_service import get_engine_from_conn
from app.models.database_connection import DatabaseConnection

# --- CACHE de contexto de DB ---
_db_context_cache = {}
DB_CONTEXT_TTL = 300  # 5 minutos

def _get_cached_db_context(conn_id: int, builder_fn):
    """Retorna el contexto cacheado o lo regenera si expiró."""
    cached = _db_context_cache.get(conn_id)
    if cached and (time.time() - cached['ts']) < DB_CONTEXT_TTL:
        return cached['value']
    value = builder_fn()
    _db_context_cache[conn_id] = {'ts': time.time(), 'value': value}
    return value

class AIService:
    def __init__(self):
        self.system_prompt = """Eres SmartFill, un asistente experto y agente autónomo de bases de datos SQL Server. 
Tu rol principal es ayudar a los DBAs.
Cuando el usuario pregunte sobre comandos, ayuda, o qué puedes hacer, DEBES listar TODOS los comandos disponibles con sus descripciones de forma clara y numerada.
Siempre menciona que pueden escribir /help para ver la lista completa de comandos.
Si el usuario pregunta por un comando específico, explica detalladamente para qué sirve y cómo usarlo.
Responde de manera profesional y concisa."""
        
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "ejecutar_sql_lectura",
                    "description": "Ejecuta una consulta SQL (SELECT) en la base de datos SQL Server activa y retorna los resultados.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "La consulta SQL a ejecutar. Debe ser válida en SQL Server."
                            }
                        },
                        "required": ["query"]
                    }
                }
            }
        ]

    def _ejecutar_sql_lectura(self, query: str) -> str:
        conn = DatabaseConnection.query.filter_by(is_active=True).first()
        if not conn:
            return "Error: No hay una base de datos activa configurada."
        
        try:
            # Solo permitimos lectura por seguridad básica (aunque el DBA sea el único usuario)
            if not query.strip().upper().startswith("SELECT") and not query.strip().upper().startswith("EXEC"):
                return "Error: Por seguridad, esta herramienta solo permite comandos SELECT o EXEC."

            engine = get_engine_from_conn(conn)
            with engine.connect() as c:
                result = c.execute(text(query))
                # Formatear el resultado a una lista de diccionarios
                rows = [dict(row._mapping) for row in result.fetchmany(50)] # Limitamos a 50 filas para no saturar el contexto de la IA
            engine.dispose()
            return json.dumps(rows, default=str)
        except Exception as e:
            return f"Error ejecutando SQL: {str(e)}"

    def _parse_text_tool_call(self, text: str):
        """Parser de fallback: detecta si el modelo imprimio el tool call como texto
        (ej: <function=ejecutar_sql_lectura>{...}</function>) y lo ejecuta.
        Retorna (True, resultado) si detecta y ejecuta, (False, None) si no."""
        # Formato 1: <function=nombre>{json}</function>
        pattern1 = r'<function=ejecutar_sql_lectura>(.*?)</function>'
        # Formato 2: ```json\n{...}\n``` dentro de contexto de tool
        match = re.search(pattern1, text, re.DOTALL)
        if match:
            try:
                args = json.loads(match.group(1).strip())
                query = args.get('query', '')
                if query:
                    print(f"🤖 [fallback parser] IA ejecutando SQL: {query}")
                    resultado = self._ejecutar_sql_lectura(query)
                    return True, resultado
            except Exception as e:
                print(f"Error en fallback parser: {e}")
        return False, None

    def generate_response(self, user_message: str, db_context: str = "", chat_context: str = "", commands_info: str = "") -> str:
        modelo_conf = Configuracion.query.filter_by(clave='ai_model').first()
        api_key_conf = Configuracion.query.filter_by(clave='ai_api_key').first()
        
        if not modelo_conf or not api_key_conf or not modelo_conf.valor or not api_key_conf.valor:
            return "⚠️ El chatbot no está configurado. Por favor, configura el modelo y la API Key en el dashboard."

        if completion is None:
            return "❌ Error de configuración: el módulo de IA (litellm) no está instalado."
            
        model_name = modelo_conf.valor
        api_key = api_key_conf.valor

        messages = self._build_messages(user_message, db_context, chat_context, commands_info)

        try:
            response = completion(model=model_name, messages=messages, api_key=api_key)
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generando respuesta de IA: {e}")
            return f"❌ Ocurrió un error con el modelo de IA: {str(e)}"

    def generate_response_stream(self, user_message: str, db_context: str = "", chat_context: str = ""):
        """Versión streaming del agente. Yield chunks de texto SSE."""
        modelo_conf = Configuracion.query.filter_by(clave='ai_model').first()
        api_key_conf = Configuracion.query.filter_by(clave='ai_api_key').first()

        if not modelo_conf or not api_key_conf or not modelo_conf.valor or not api_key_conf.valor:
            yield "data: ⚠️ El chatbot no está configurado.\n\n"
            return

        if completion is None:
            yield "data: ❌ litellm no está instalado.\n\n"
            return

        model_name = modelo_conf.valor
        api_key = api_key_conf.valor
        messages = self._build_messages(user_message, db_context, chat_context)

        try:
            # Primera llamada SIN stream para poder detectar tool_calls
            response = completion(model=model_name, messages=messages, api_key=api_key, tools=self.tools)
            message = response.choices[0].message

            if hasattr(message, 'tool_calls') and message.tool_calls:
                # Notificar al cliente que estamos ejecutando SQL
                for tool_call in message.tool_calls:
                    if tool_call.function.name == "ejecutar_sql_lectura":
                        args = json.loads(tool_call.function.arguments)
                        query = args.get("query", "")
                        print(f"🤖 IA ejecutando SQL: {query}")
                        yield f"data: __TOOL__: Ejecutando SQL...\n\n"
                        resultado_db = self._ejecutar_sql_lectura(query)
                        messages.append(message)
                        messages.append({"role": "tool", "tool_call_id": tool_call.id, "name": tool_call.function.name, "content": resultado_db})

                # Segunda llamada CON stream para respuesta final en tiempo real
                stream = completion(model=model_name, messages=messages, api_key=api_key, stream=True)
                for chunk in stream:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        # Escape newlines para SSE
                        safe = delta.content.replace("\n", "\\n")
                        yield f"data: {safe}\n\n"
            else:
                content = message.content or ""
                # FALLBACK: detectar si el modelo imprimió el tool call como texto plano
                detected, sql_result = self._parse_text_tool_call(content)
                if detected and sql_result is not None:
                    yield f"data: __TOOL__: Ejecutando SQL...\\n\\n"
                    # Pedir a la IA que interprete el resultado
                    messages.append({"role": "user", "content": f"Resultado de la consulta SQL:\n{sql_result}\n\nResponde al usuario con estos datos de forma clara y concisa."})
                    stream = completion(model=model_name, messages=messages, api_key=api_key, stream=True)
                    for chunk in stream:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            safe = delta.content.replace("\n", "\\n")
                            yield f"data: {safe}\n\n"
                else:
                    # Respuesta directa sin herramienta
                    for i in range(0, len(content), 50):
                        safe = content[i:i+50].replace("\n", "\\n")
                        yield f"data: {safe}\n\n"

            yield "data: __END__\n\n"

        except Exception as e:
            print(f"Error en generate_response_stream: {e}")
            yield f"data: ❌ Error: {str(e)}\n\n"
            yield "data: __END__\n\n"

    def _build_messages(self, user_message: str, db_context: str, chat_context: str, commands_info: str = "") -> list:
        """Construye la lista de mensajes con contexto trimmeado para no inflar el token count."""
        messages = [{"role": "system", "content": self.system_prompt}]
        if db_context:
            messages.append({"role": "system", "content": f"Contexto BD:\n{db_context}"})
        # Limitar el historial de chat a los últimos 1500 caracteres para no saturar el contexto
        if chat_context:
            trimmed = chat_context[-1500:] if len(chat_context) > 1500 else chat_context
            messages.append({"role": "system", "content": f"Actividad reciente:\n{trimmed}"})
        if commands_info:
            messages.append({"role": "system", "content": f"INSTRUCCIÓN: Si el usuario pregunta sobre comandos o ayuda, lista estos comandos:\n{commands_info}"})
        messages.append({"role": "user", "content": user_message})
        return messages


def _build_db_context_fast(conn) -> str:
    """Construye contexto de BD usando solo queries r\u00e1pidas (sin sys.dm_db_index_physical_stats)."""
    lines = [f"Base de datos activa: {conn.database}"]
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            # Query r\u00e1pida: s\u00f3lo sys.tables + sys.partitions, sin DMVs lentas
            result = c.execute(text("""
                SELECT t.name AS table_name, SUM(p.rows) AS total_rows
                FROM sys.tables t
                JOIN sys.partitions p ON t.object_id = p.object_id
                WHERE t.is_ms_shipped = 0 AND p.index_id <= 1
                GROUP BY t.name ORDER BY t.name
            """))
            tables = [dict(r._mapping) for r in result]
        engine.dispose()

        lines.append(f"Tablas de usuario ({len(tables)}):")
        for t in tables:
            lines.append(f"  - {t['table_name']} ({t['total_rows']} filas)")
        lines.append("")
        lines.append("NOTA: Para analizar fragmentaci\u00f3n, usa la herramienta ejecutar_sql_lectura con sys.dm_db_index_physical_stats.")
    except Exception as e:
        lines.append(f"(Error obteniendo tablas: {e})")
    return "\n".join(lines)


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
