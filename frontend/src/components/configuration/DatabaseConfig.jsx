import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Database, Plus, Edit3, Trash2, CheckCircle, XCircle, Zap, Search } from 'lucide-react';

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
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [availableDbs, setAvailableDbs] = useState([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [exploreError, setExploreError] = useState('');

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
    setConnecting(true);
    setConnectionError('');
    setStatusMsg('');
    try {
      const testRes = await axios.post(`${API}/test-raw`, {
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        driver: form.driver,
      });
      if (!testRes.data.connected) {
        setConnectionError(testRes.data.message || 'No se pudo conectar a la base de datos. Verifica las credenciales.');
        setConnecting(false);
        return;
      }

      let connId = editingId;
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await axios.put(`${API}/${editingId}`, payload);
      } else {
        const res = await axios.post(API, form);
        connId = res.data.data.id;
      }

      await axios.post(`${API}/${connId}/activate`);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setStatusMsg(editingId ? 'Conexión reconectada y activada exitosamente' : 'Conectado exitosamente');
      loadConnections();
    } catch (err) {
      setConnectionError(err.response?.data?.error || err.message);
    }
    setConnecting(false);
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
    setAvailableDbs([]);
    setExploreError('');
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
      setTestResult({ [id]: { connected: res.data.connected, message: res.data.message || '' } });
    } catch {
      setTestResult({ [id]: { connected: false, message: 'Error inesperado al probar la conexión' } });
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

  const handleExplore = async () => {
    if (!form.host || !form.username || !form.password) return;
    setLoadingDbs(true);
    setExploreError('');
    setAvailableDbs([]);
    try {
      const res = await axios.post(`${API}/explore`, {
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        driver: form.driver,
      });
      setAvailableDbs(res.data.data || []);
      if (res.data.data?.length > 0 && !form.database) {
        setForm({ ...form, database: res.data.data[0] });
      }
    } catch (err) {
      setExploreError(err.response?.data?.message || 'Error al obtener bases de datos');
    }
    setLoadingDbs(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2">Conexiones a Bases de Datos</h2>
          <p className="text-fgMuted">Gestiona las conexiones a SQL Server para el bot y el dashboard.</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); setAvailableDbs([]); setExploreError(''); }}
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
              <div>
                <label className="block text-xs font-mono text-fgMuted mb-1">Base de datos *</label>
                <div className="flex gap-2">
                  {availableDbs.length > 0 ? (
                    <select value={form.database} onChange={e => setForm({...form, database: e.target.value})}
                      className="flex-1 bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono">
                      {availableDbs.map(db => (
                        <option key={db} value={db}>{db}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={form.database} onChange={e => setForm({...form, database: e.target.value})}
                      placeholder="Escribe o carga BD disponibles"
                      className="flex-1 bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
                  )}
                  <button onClick={handleExplore} disabled={loadingDbs || !form.host || !form.username || !form.password}
                    className="px-3 bg-surface border border-border hover:border-accent text-fgMuted hover:text-accent transition-colors disabled:opacity-50"
                    title="Cargar bases de datos disponibles">
                    {loadingDbs ? (
                      <span className="w-4 h-4 block border-2 border-fgMuted border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search size={16} />
                    )}
                  </button>
                </div>
                {exploreError && (
                  <p className="mt-1 text-xs font-mono text-red-400">{exploreError}</p>
                )}
              </div>
            </div>
            {connectionError && (
              <p className="mt-4 text-sm font-mono text-red-400">{connectionError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={connecting}
                className="btn-accent flex-1 py-3 text-sm font-mono flex items-center justify-center gap-2 disabled:opacity-50">
                {connecting ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Conectando...</>
                ) : (
                  <>{editingId ? 'Reconectar' : 'Conectar'}</>
                )}
              </button>
              <button onClick={() => { setShowForm(false); setConnectionError(''); setAvailableDbs([]); setExploreError(''); }}
                className="btn-ghost flex-1 py-3 text-sm font-mono">
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
              {testResult[conn.id]?.connected === true && <CheckCircle size={16} className="text-green-400 shrink-0" />}
              {testResult[conn.id]?.connected === false && (
                <div className="relative group">
                  <XCircle size={16} className="text-red-400 shrink-0 cursor-help" />
                  <div className="absolute right-0 top-6 w-80 bg-red-900/90 border border-red-700 p-3 rounded text-xs font-mono text-red-200 hidden group-hover:block z-50 whitespace-pre-line">
                    {testResult[conn.id]?.message || 'Error de conexión'}
                  </div>
                </div>
              )}
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
