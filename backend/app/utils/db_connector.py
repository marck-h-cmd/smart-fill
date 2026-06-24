import pyodbc
from flask import current_app, g
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    if 'db' not in g:
        conn_str = os.getenv('DATABASE_URL')
        # Si usas SQLAlchemy, podrías usar create_engine, pero aquí usamos pyodbc directo
        g.db = pyodbc.connect(conn_str)
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    app.teardown_appcontext(close_db)