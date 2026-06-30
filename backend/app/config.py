import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    # Para SQLite (archivo en la carpeta backend)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///smartfill.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Configuración de WhatsApp (si la tienes)
    WA_API_URL = os.getenv('WA_API_URL', 'http://localhost:2785')
    WA_API_KEY = os.getenv('WA_API_KEY', '')