import time
from collections import defaultdict

TTL = 1800

class ChatContext:
    def __init__(self):
        self.events = []

    def add(self, event_type, content):
        self.events.append({"ts": time.time(), "type": event_type, "content": content})
        cutoff = time.time() - TTL
        self.events = [e for e in self.events if e["ts"] >= cutoff]

    def get_recent(self, max_minutes=30):
        cutoff = time.time() - max_minutes * 60
        recent = [e for e in self.events if e["ts"] >= cutoff]
        return recent


_contexts = defaultdict(ChatContext)


def add_event(chat_id, event_type, content):
    _contexts[chat_id].add(event_type, content)
    cutoff = time.time() - TTL - 60
    stale = [k for k, v in _contexts.items() if v.events and v.events[-1]["ts"] < cutoff]
    for k in stale:
        del _contexts[k]


def get_context(chat_id, max_minutes=30):
    ctx = _contexts.get(chat_id)
    if not ctx:
        return ""
    events = ctx.get_recent(max_minutes)
    if not events:
        return ""
    lines = ["Historial de interacción en este chat (últimos {} min):".format(max_minutes)]
    for e in events:
        ts = time.strftime("%H:%M", time.localtime(e["ts"]))
        label = {
            "message": "Mensaje",
            "command": "Comando",
            "optimization": "Optimización",
            "ai_query": "Consulta IA",
            "ai_response": "Respuesta IA",
        }.get(e["type"], e["type"])
        lines.append(f"  [{ts}] {label}: {e['content'][:300]}")
    return "\n".join(lines)
