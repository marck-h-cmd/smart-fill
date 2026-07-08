import os
from app import create_app
from app.extensions import db
from app.models.base import TablaMetricas, Configuracion

app = create_app()

def reset_and_seed_db():
    with app.app_context():
        # Crear tablas
        db.create_all()
        
        # Limpiar datos anteriores si existen
        db.session.query(TablaMetricas).delete()
        db.session.query(Configuracion).delete()
        
        # Seed Configuracion
        conf1 = Configuracion(clave='umbral_fragmentacion_critico', valor='30.0')
        conf2 = Configuracion(clave='horario_mantenimiento', valor='02:00')
        db.session.add_all([conf1, conf2])

        # Seed Tablas Mockeadas
        t1 = TablaMetricas(nombre_tabla='Ventas', fragmentacion_porcentaje=45.5, fillfactor_actual=100, total_filas=1500000)
        t2 = TablaMetricas(nombre_tabla='Usuarios', fragmentacion_porcentaje=5.2, fillfactor_actual=90, total_filas=50000)
        t3 = TablaMetricas(nombre_tabla='Logs', fragmentacion_porcentaje=80.1, fillfactor_actual=100, total_filas=5000000)
        t4 = TablaMetricas(nombre_tabla='Productos', fragmentacion_porcentaje=15.0, fillfactor_actual=85, total_filas=2500)
        
        db.session.add_all([t1, t2, t3, t4])
        db.session.commit()
        
        print("Base de datos SQLite inicializada y poblada con éxito.")

if __name__ == '__main__':
    reset_and_seed_db()
