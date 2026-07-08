from app import create_app
from app.extensions import db
from app.models.database_connection import DatabaseConnection
from app.services.database_service import encrypt_password

app = create_app()
with app.app_context():
    conn = DatabaseConnection(
        name='MiSQLServer',
        host='localhost',
        port=1433,
        database='Northwind',
        username='smartfill_user',
        password_encrypted=encrypt_password('TuContraseñaFuerte'),
        driver='ODBC Driver 17 for SQL Server',
        is_active=True
    )
    db.session.add(conn)
    db.session.commit()
    print(f"✅ Conexión creada con ID {conn.id} y activada")