from app import create_app
from app.extensions import db
from app.models.base import Configuracion

app = create_app()
with app.app_context():
    session_id = '23af2849-54e7-4a54-826c-a2ef14ba07bd'
    config = Configuracion.query.filter_by(clave='bot_session').first()
    if config:
        config.valor = session_id
        print(f"✅ Actualizado: {config.valor}")
    else:
        config = Configuracion(clave='bot_session', valor=session_id)
        db.session.add(config)
        print(f"✅ Creado: {config.valor}")
    db.session.commit()
    print("✅ Configuración guardada.")