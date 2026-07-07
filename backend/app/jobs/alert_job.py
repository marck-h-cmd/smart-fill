from app.services.monitoring_service import run_full_check
from app.services.whatsapp_service import WhatsAppService
from app.models.database_connection import DatabaseConnection
from app.models.base import Configuracion
from app.extensions import db

wsp_service = WhatsAppService()


def run_alert_check():
    with db.app.app_context():
        conn = DatabaseConnection.query.filter_by(is_active=True).first()
        if not conn:
            print("[alert_job] No hay base de datos activa")
            return

        alert_umbral_conf = Configuracion.query.filter_by(clave='alert_umbral').first()
        alert_umbral = int(alert_umbral_conf.valor) if alert_umbral_conf else 30

        result = run_full_check(conn, alert_umbral)
        if result.get('status') != 'success':
            print(f"[alert_job] Error ejecutando chequeo: {result.get('message')}")
            return

        if not result.get('has_alerts'):
            print("[alert_job] Sin alertas, omitiendo notificación")
            return

        admin_phone_conf = Configuracion.query.filter_by(clave='admin_phone').first()
        if not admin_phone_conf or not admin_phone_conf.valor:
            print("[alert_job] admin_phone no configurado")
            return

        admin_phone = admin_phone_conf.valor
        lines = ["🚨 *ALERTA SMARTFILL*", ""]
        for alert in result['alerts']:
            emoji = "🔴" if alert['severity'] == 'critical' else "🟡"
            lines.append(f"{emoji} {alert['message']}")
        if result['fragmentation'].get('status') == 'success':
            lines.append("")
            lines.append(f"📊 Total índices: {result['fragmentation']['total_indexes']}")
            lines.append(f"🔴 Críticos: {result['fragmentation']['critical_count']}")
            lines.append(f"🟡 Moderados: {result['fragmentation']['moderate_count']}")
            lines.append(f"✅ Saludables: {result['fragmentation']['healthy_count']}")
        if result['space'].get('status') == 'success':
            lines.append("")
            lines.append(f"💾 Espacio usado: {result['space']['used_percent']}%")
            lines.append(f"📀 Libres: {result['space']['free_mb']} MB")
        lines.append("")
        lines.append("Responde con /estado para más detalles.")

        bot_session_conf = Configuracion.query.filter_by(clave='bot_session').first()
        if not bot_session_conf or not bot_session_conf.valor:
            print("[alert_job] No hay bot_session configurada")
            return

        text = "\n".join(lines)
        admin_phone = admin_phone.lstrip('+')
        chat_id = f"{admin_phone}@c.us" if not (admin_phone.endswith('@c.us') or admin_phone.endswith('@g.us') or admin_phone.endswith('@lid')) else admin_phone
        try:
            wsp_service.send_message(bot_session_conf.valor, chat_id, text)
            print(f"[alert_job] Alerta enviada a {admin_phone}")
        except Exception as e:
            print(f"[alert_job] Error enviando alerta: {e}")
