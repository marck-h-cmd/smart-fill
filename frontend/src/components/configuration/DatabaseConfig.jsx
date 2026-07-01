import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Database, Plus, Edit3, Trash2, CheckCircle, XCircle, Zap } from 'lucide-react';

const API = 'http://localhost:5000/api/databases';

const EMPTY_FORM = {
  name: '', host: '', port: 1433, database: '', username: '', password: '', driver: 'ODBC Driver 17 for SQL Server'
};

export default function DatabaseConfig() {
  const [connections, setConnections] = useState([]);
  const [activeDb, setActiveDb] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [statusMsg, setStatusMsg] = useState('');

  const loadConnections = useCallback(async () => {
    try {
      const res = await axios.get(API);
      setConnections(res.data.data || []);
      const activeRes = await axios.get(`${API}/active`);
      setActiveDb(activeRes.data.data);
    } catch (err) {
      console.error('Error loading connections:', err);
    }
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleSave = async () => {
    setStatusMsg('');
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await axios.put(`${API}/${editingId}`, payload);
        setStatusMsg('Conexión actualizada exitosamente');
      } else {
        await axios.post(API, form);
        setStatusMsg('Conexión creada exitosamente');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      loadConnections();
    } catch (err) {
      setStatusMsg(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleEdit = (conn) => {
    setForm({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: '',
      driver: conn.driver,
    });
    setEditingId(conn.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta conexión permanentemente?')) return;
    try {
      await axios.delete(`${API}/${id}`);
      loadConnections();
    } catch (err) {
      setStatusMsg(`Error al eliminar: ${err.message}`);
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResult({});
    try {
      const res = await axios.post(`${API}/${id}/test`);
      setTestResult({ [id]: res.data.connected });
    } catch {
      setTestResult({ [id]: false });
    }
    setTestingId(null);
  };

  const handleActivate = async (id) => {
    try {
      await axios.post(`${API}/${id}/activate`);
      loadConnections();
    } catch (err) {
      setStatusMsg(`Error al activar: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2">Conexiones a Bases de Datos</h2>
          <p className="text-fgMuted">Gestiona las conexiones a SQL Server para el bot y el dashboard.</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
          className="btn-accent flex items-center gap-2 py-2 px-4 text-sm"
        >
          <Plus size={16} /> Nueva Conexión
        </button>
      </div>

      {activeDb && (
        <div className="panel bg-accent/5 border border-accent/20 p-4 flex items-center gap-3">
          <Zap size={18} className="text-accent" />
          <span className="text-sm font-mono">
            Base de datos activa: <strong className="text-accent">{activeDb.name}</strong> ({activeDb.host}/{activeDb.database})
          </span>
        </div>
      )}

      {statusMsg && (
        <p className={`text-sm font-mono ${statusMsg.includes('Error') ? 'text-red-400' : 'text-accent'}`}>
          {statusMsg}
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-mono mb-6">{editingId ? 'Editar Conexión' : 'Nueva Conexión'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-fgMuted mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-mono text-fgMuted mb-1">Servidor *</label>
                  <input type="text" value={form.host} onChange={e => setForm({...form, host: e.target.value})}
                    placeholder="localhost o IP" className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-fgMuted mb-1">Puerto</label>
                  <input type="number" value={form.port} onChange={e => setForm({...form, port: parseInt(e.target.value) || 1433})}
                    className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-fgMuted mb-1">Base de datos *</label>
                <input type="text" value={form.database} onChange={e => setForm({...form, database: e.target.value})}
                  className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-mono text-fgMuted mb-1">Usuario *</label>
                <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-mono text-fgMuted mb-1">
                  Contraseña {editingId && '(dejar vacío para mantener)'}
                </label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-mono text-fgMuted mb-1">Driver ODBC</label>
                <input type="text" value={form.driver} onChange={e => setForm({...form, driver: e.target.value})}
                  className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="btn-accent flex-1 py-3 text-sm font-mono">
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 py-3 text-sm font-mono">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {connections.length === 0 && (
          <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
            <Database size={48} className="text-border mb-4" strokeWidth={1} />
            <p className="text-fgMuted font-mono text-sm">No hay conexiones configuradas. Agrega una para comenzar.</p>
          </div>
        )}

        {connections.map(conn => (
          <div key={conn.id} className={`panel p-4 flex items-center justify-between transition-all ${conn.is_active ? 'border-accent' : ''}`}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`w-2 h-2 rounded-full ${conn.is_active ? 'bg-accent animate-pulse' : 'bg-fgMuted/30'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-sm">{conn.name}</span>
                  {conn.is_active && <span className="text-[10px] font-mono text-accent uppercase tracking-wider">Activa</span>}
                </div>
                <p className="text-xs font-mono text-fgMuted truncate mt-1">
                  {conn.host}:{conn.port}/{conn.database} — {conn.username}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {testResult[conn.id] === true && <CheckCircle size={16} className="text-green-400" />}
              {testResult[conn.id] === false && <XCircle size={16} className="text-red-400" />}
              <button onClick={() => handleTest(conn.id)} disabled={testingId === conn.id}
                className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-fg transition-colors" title="Probar conexión">
                {testingId === conn.id ? <span className="w-4 h-4 block border-2 border-fgMuted border-t-transparent rounded-full animate-spin" /> : <Zap size={16} />}
              </button>
              {!conn.is_active && (
                <button onClick={() => handleActivate(conn.id)}
                  className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-accent transition-colors" title="Activar">
                  <CheckCircle size={16} />
                </button>
              )}
              <button onClick={() => handleEdit(conn)}
                className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-fg transition-colors" title="Editar">
                <Edit3 size={16} />
              </button>
              <button onClick={() => handleDelete(conn.id)}
                className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-red-400 transition-colors" title="Eliminar">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
