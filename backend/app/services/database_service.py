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

def test_connection(conn):
    try:
        engine = get_engine_from_conn(conn)
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        engine.dispose()
        return True, "Conexión exitosa"
    except Exception as e:
        return False, str(e)
