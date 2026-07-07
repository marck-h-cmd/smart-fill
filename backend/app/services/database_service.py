from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
import os
import base64
import hashlib
from urllib.parse import quote_plus

_KEY_CACHE = None

def _get_fernet():
    global _KEY_CACHE
    if _KEY_CACHE:
        return _KEY_CACHE
    secret = os.getenv('SECRET_KEY', 'dev-secret-key-default')
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    _KEY_CACHE = Fernet(key)
    return _KEY_CACHE

def encrypt_password(password: str) -> str:
    f = _get_fernet()
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted: str) -> str:
    f = _get_fernet()
    return f.decrypt(encrypted.encode()).decode()

def build_connection_string(host, port, database, username, password, driver):
    encoded_user = quote_plus(username)
    encoded_pass = quote_plus(password)
    encoded_driver = quote_plus(driver)
    return (
        f"mssql+pyodbc://{encoded_user}:{encoded_pass}@{host}:{port}/{database}"
        f"?driver={encoded_driver}&TrustServerCertificate=yes"
    )

def get_engine_from_conn(conn):
    password = decrypt_password(conn.password_encrypted)
    conn_str = build_connection_string(
        conn.host, conn.port, conn.database,
        conn.username, password, conn.driver
    )
    engine = create_engine(conn_str, poolclass=NullPool)
    return engine

def _friendly_error(err_str, host, port, database):
    lines = []
    lines.append("No se pudo conectar a SQL Server.")
    lines.append("")

    if '10061' in err_str:
        lines.append(f"No se pudo conectar a {host}:{port} — el servidor rechazó la conexión.")
        lines.append("")
        lines.append("Causas posibles:")
        lines.append("  • El servicio 'SQL Server (MSSQLSERVER)' no está iniciado")
        lines.append(f"  • El puerto {port} está bloqueado por el firewall")
        lines.append("  • SQL Server no acepta conexiones remotas")
        lines.append("  • La instancia no está escuchando en ese puerto")
        lines.append("")
        is_local = host.lower() in ('localhost', '127.0.0.1', '::1', '.')
        if is_local:
            lines.append("⚠️  DETECTAMOS QUE TCP/IP PODRÍA ESTAR DESHABILITADO EN TU SQL SERVER")
            lines.append("")
            lines.append("Esto es muy común en instalaciones locales. Solución rápida:")
            lines.append("")
            lines.append("[Opción 1 - PowerShell como Administrador]")
            lines.append("  Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\MSSQL16.MSSQLSERVER\\MSSQLServer\\SuperSocketNetLib\\Tcp' -Name Enabled -Value 1")
            lines.append("  Restart-Service MSSQLSERVER")
            lines.append("")
            lines.append("[Opción 2 - Interfaz gráfica]")
            lines.append("  1. Win+R → SQLServerManager16.msc")
            lines.append("  2. Protocolos de MSSQLSERVER → TCP/IP → Habilitar")
            lines.append("  3. Servicios de SQL Server → MSSQLSERVER → Reiniciar")
            lines.append("")
        lines.append("Soluciones adicionales:")
        lines.append("  1. Abre 'Services.msc' y verifica que SQL Server esté 'Running'")
        lines.append(f"  2. Agrega regla en Firewall de Windows para puerto {port}")
        lines.append("  3. Si usas instancia nombrada (ej: 'localhost\\\\SQLEXPRESS'),")
        lines.append("     verifica el puerto dinámico en el Log de SQL Server")
    elif '11001' in err_str or 'No se encontr' in err_str or 'not found' in err_str.lower():
        lines.append(f"No se encontró el servidor '{host}' en la red.")
        lines.append("")
        lines.append("Causas posibles:")
        lines.append("  • El nombre del servidor o IP es incorrecto")
        lines.append("  • El servidor no está encendido o no es accesible")
        lines.append("")
        lines.append("Soluciones:")
        lines.append(f"  • Verifica el nombre/IP con: ping {host}")
        lines.append("  • Si es 'localhost', SQL Server debe estar instalado localmente")
        lines.append("  • Si es IP remota, verifica conectividad de red")
    elif '18456' in err_str:
        lines.append(f"Error de autenticación al conectar a la BD '{database}'.")
        lines.append("")
        lines.append("Causas posibles:")
        lines.append("  • Usuario o contraseña incorrectos")
        lines.append("  • El usuario no tiene permisos sobre esta base de datos")
        lines.append("")
        lines.append("Soluciones:")
        lines.append("  • Verifica las credenciales en el formulario")
        lines.append("  • SQL Server debe estar en modo 'Autenticación Mixta'")
    elif '4060' in err_str or 'Cannot open database' in err_str:
        lines.append(f"La base de datos '{database}' no existe en el servidor.")
        lines.append("")
        lines.append("Solución: Verifica que el nombre de la BD esté correcto.")
    elif 'timeout' in err_str.lower() or '10060' in err_str:
        lines.append(f"La conexión con {host}:{port} expiró por timeout.")
        lines.append("")
        lines.append("Causas posibles:")
        lines.append(f"  • El puerto {port} no está abierto en el servidor remoto")
        lines.append("  • Firewall bloqueando la conexión")
        lines.append("  • Problema de red o enrutamiento")
        lines.append("")
        lines.append(f"Solución: Verifica con: Test-NetConnection {host} -Port {port}")
    elif 'driver' in err_str.lower() and ('not found' in err_str.lower() or 'no encontrado' in err_str):
        lines.append("El controlador ODBC no está instalado en esta máquina.")
        lines.append("")
        lines.append("Solución: Descarga e instala 'ODBC Driver 17 for SQL Server' desde Microsoft")
    else:
        lines.append(f"Error inesperado al conectar con {host}:{port}/{database}.")
        lines.append("")
        lines.append("Revisa que todos los campos sean correctos e intenta de nuevo.")
        lines.append("")
        lines.append(f"Detalle técnico: {err_str[:300]}")

    return "\n".join(lines)


def get_available_databases(host, port, username, password, driver):
    try:
        conn_str = build_connection_string(host, port, 'master', username, password, driver)
        engine = create_engine(conn_str, poolclass=NullPool)
        with engine.connect() as c:
            result = c.execute(text(
                "SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name"
            ))
            databases = [row[0] for row in result]
        engine.dispose()
        return True, databases
    except Exception as e:
        error_msg = _friendly_error(str(e), host, port, 'master')
        return False, error_msg


def test_raw_connection(host, port, username, password, driver):
    try:
        conn_str = build_connection_string(host, port, 'master', username, password, driver)
        engine = create_engine(conn_str, poolclass=NullPool)
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        engine.dispose()
        return True, "Conexión exitosa"
    except Exception as e:
        err_str = str(e)
        error_msg = _friendly_error(err_str, host, port, 'master')
        return False, error_msg


def test_connection(conn):
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        engine.dispose()
        return True, "Conexión exitosa"
    except Exception as e:
        err_str = str(e)
        error_msg = _friendly_error(err_str, conn.host, conn.port, conn.database)
        return False, error_msg
