from app.extensions import db
from datetime import datetime

class TablaMetricas(db.Model):
    __tablename__ = 'tabla_metricas'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre_tabla = db.Column(db.String(100), nullable=False, unique=True)
    fragmentacion_porcentaje = db.Column(db.Float, nullable=False)
    fillfactor_actual = db.Column(db.Integer, nullable=False)
    total_filas = db.Column(db.Integer, nullable=False)
    ultima_actualizacion = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'nombre_tabla': self.nombre_tabla,
            'fragmentacion_porcentaje': self.fragmentacion_porcentaje,
            'fillfactor_actual': self.fillfactor_actual,
            'total_filas': self.total_filas,
            'ultima_actualizacion': self.ultima_actualizacion.isoformat()
        }

class Configuracion(db.Model):
    __tablename__ = 'configuracion'
    
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(50), nullable=False, unique=True)
    valor = db.Column(db.String(255), nullable=False)
