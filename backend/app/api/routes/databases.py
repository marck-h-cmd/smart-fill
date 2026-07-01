from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.database_connection import DatabaseConnection
from app.services.database_service import encrypt_password, test_connection
from app.services.fragmentation_service import get_top_fragmented, get_all_fragmented, get_dashboard_stats

bp = Blueprint('databases', __name__, url_prefix='/api/databases')

@bp.route('', methods=['GET'])
def list_databases():
    conns = DatabaseConnection.query.order_by(DatabaseConnection.name).all()
    return jsonify({
        'status': 'success',
        'data': [c.to_dict() for c in conns]
    })

@bp.route('/<int:db_id>', methods=['GET'])
def get_database(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)
    return jsonify({'status': 'success', 'data': conn.to_dict()})

@bp.route('', methods=['POST'])
def create_database():
    data = request.json
    required = ['name', 'host', 'database', 'username', 'password']
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Campos requeridos faltantes: {", ".join(missing)}'}), 400

    existing = DatabaseConnection.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': f'Ya existe una conexión con el nombre "{data["name"]}"'}), 409

    encrypted_pw = encrypt_password(data['password'])

    conn = DatabaseConnection(
        name=data['name'],
        host=data['host'],
        port=data.get('port', 1433),
        database=data['database'],
        username=data['username'],
        password_encrypted=encrypted_pw,
        driver=data.get('driver', 'ODBC Driver 17 for SQL Server'),
        is_active=False
    )
    db.session.add(conn)
    db.session.commit()

    return jsonify({'status': 'success', 'data': conn.to_dict()}), 201

@bp.route('/<int:db_id>', methods=['PUT'])
def update_database(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)
    data = request.json

    if 'name' in data:
        existing = DatabaseConnection.query.filter(
            DatabaseConnection.name == data['name'],
            DatabaseConnection.id != db_id
        ).first()
        if existing:
            return jsonify({'error': f'Ya existe otra conexión con el nombre "{data["name"]}"'}), 409
        conn.name = data['name']
    if 'host' in data:
        conn.host = data['host']
    if 'port' in data:
        conn.port = data['port']
    if 'database' in data:
        conn.database = data['database']
    if 'username' in data:
        conn.username = data['username']
    if 'password' in data and data['password']:
        conn.password_encrypted = encrypt_password(data['password'])
    if 'driver' in data:
        conn.driver = data['driver']

    db.session.commit()
    return jsonify({'status': 'success', 'data': conn.to_dict()})

@bp.route('/<int:db_id>', methods=['DELETE'])
def delete_database(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)
    db.session.delete(conn)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Conexión eliminada'})

@bp.route('/<int:db_id>/test', methods=['POST'])
def test_database(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)
    success, message = test_connection(conn)
    return jsonify({
        'status': 'success' if success else 'error',
        'connected': success,
        'message': message
    })

@bp.route('/active', methods=['GET'])
def get_active():
    conn = DatabaseConnection.query.filter_by(is_active=True).first()
    if not conn:
        return jsonify({'status': 'success', 'data': None, 'message': 'No hay base de datos activa'})
    return jsonify({'status': 'success', 'data': conn.to_dict()})

@bp.route('/<int:db_id>/activate', methods=['POST'])
def activate_database(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)

    DatabaseConnection.query.filter(
        DatabaseConnection.is_active == True,
        DatabaseConnection.id != db_id
    ).update({'is_active': False})

    conn.is_active = True
    db.session.commit()
    return jsonify({'status': 'success', 'data': conn.to_dict(), 'message': f'Base de datos "{conn.name}" activada'})

@bp.route('/<int:db_id>/stats', methods=['POST'])
def db_stats(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)
    try:
        stats = get_dashboard_stats(conn)
        return jsonify({'status': 'success', 'data': stats})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:db_id>/fragmentation', methods=['POST'])
def db_fragmentation(db_id):
    conn = DatabaseConnection.query.get_or_404(db_id)
    try:
        data = get_all_fragmented(conn)
        return jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
