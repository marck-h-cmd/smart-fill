import React, { useState, useEffect, useCallback } from 'react';
import { whatsapp, config as configApi } from '../../services/apiClient';
import { Plus, Smartphone, QrCode, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function WhatsAppSessionManager() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState('');
  const [newName, setNewName] = useState('');
  const [qrData, setQrData] = useState(null);
  const [qrSessionId, setQrSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const list = await whatsapp.listSessions();
      setSessions(Array.isArray(list) ? list : []);
      const cfg = await configApi.get();
      setActiveSession(cfg.bot_session || '');
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setStatusMsg('');
    try {
      const result = await whatsapp.createSession(newName.trim());
      const sessionId = result?.data?.id || result?.data?.name || newName.trim();
      setStatusMsg(`Sesión "${newName}" creada. Iniciando...`);
      setNewName('');
      await whatsapp.startSession(sessionId);
      setStatusMsg(`Sesión "${sessionId}" iniciada. Obteniendo QR...`);
      await loadSessions();
      handleShowQR(sessionId);
    } catch (err) {
      setStatusMsg(`Error: ${err.response?.data?.error || err.message}`);
    }
    setLoading(false);
  };

  const handleShowQR = async (sessionId) => {
    setQrSessionId(sessionId);
    setQrData(null);
    try {
      const result = await whatsapp.getQR(sessionId);
      const data = result?.data;
      if (data?.qr || data?.base64 || data?.image || data?.qrCode) {
        setQrData(data.qr || data.base64 || data.image || data.qrCode);
      } else if (typeof data === 'string') {
        setQrData(data);
      } else {
        setQrData(JSON.stringify(data));
      }
    } catch (err) {
      setQrData(null);
      setStatusMsg(`Error obteniendo QR: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDelete = async (sessionId) => {
    if (!window.confirm(`¿Eliminar sesión "${sessionId}"?`)) return;
    try {
      await whatsapp.deleteSession(sessionId);
      if (activeSession === sessionId) setActiveSession('');
      if (qrSessionId === sessionId) { setQrData(null); setQrSessionId(null); }
      loadSessions();
    } catch (err) {
      setStatusMsg(`Error al eliminar: ${err.message}`);
    }
  };

  const handleActivate = async (sessionId) => {
    try {
      await whatsapp.activateSession(sessionId);
      setActiveSession(sessionId);
      setStatusMsg(`Sesión "${sessionId}" activada como bot_session.`);
    } catch (err) {
      setStatusMsg(`Error al activar: ${err.message}`);
    }
  };

  const getSessionStatus = (session) => {
    const state = (session.state || session.status || '').toLowerCase();
    if (state === 'connected' || state === 'open' || state === 'activo') return 'connected';
    if (state === 'connecting' || state === 'loading' || state === 'scanning') return 'connecting';
    return 'disconnected';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-mono font-medium mb-1">Sesiones de WhatsApp</h3>
          <p className="text-sm text-fgMuted">Crea y gestiona sesiones de OpenWA desde aquí.</p>
        </div>
        <button onClick={loadSessions} className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-fg transition-colors" title="Actualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {activeSession && (
        <div className="panel bg-accent/5 border border-accent/20 p-4 flex items-center gap-3">
          <Smartphone size={18} className="text-accent" />
          <span className="text-sm font-mono">
            Sesión activa del bot: <strong className="text-accent">{activeSession}</strong>
          </span>
        </div>
      )}

      {statusMsg && (
        <p className={`text-sm font-mono ${statusMsg.includes('Error') ? 'text-red-400' : 'text-accent'}`}>
          {statusMsg}
        </p>
      )}

      <div className="panel p-6">
        <h4 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4">Crear Nueva Sesión</h4>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nombre de la sesión (ej. bot-principal)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono"
            disabled={loading}
          />
          <button onClick={handleCreate} disabled={loading || !newName.trim()}
            className="btn-accent flex items-center gap-2 py-3 px-6 text-sm font-mono disabled:opacity-50">
            <Plus size={16} /> {loading ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Smartphone size={48} className="text-border mb-4" strokeWidth={1} />
          <p className="text-fgMuted font-mono text-sm">No hay sesiones. Crea una para comenzar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s, idx) => {
            const sessionId = s.id || s.name || (typeof s === 'string' ? s : `session-${idx}`);
            const displayName = s.name || sessionId;
            const status = getSessionStatus(s);
            const isActive = activeSession === sessionId;
            const showQrForMe = qrSessionId === sessionId;

            return (
              <div key={sessionId} className={`panel p-4 ${isActive ? 'border-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'connected' ? 'bg-green-400 animate-pulse' :
                      status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                      'bg-fgMuted/30'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm">{displayName}</span>
                        {isActive && <span className="text-[10px] font-mono text-accent uppercase tracking-wider">Bot Activo</span>}
                      </div>
                      <p className="text-xs font-mono text-fgMuted mt-1 capitalize">
                        {status === 'connected' ? 'Conectado' : status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {status === 'connected' ? <CheckCircle size={16} className="text-green-400" /> : <XCircle size={16} className="text-red-400" />}
                    {!isActive && status !== 'connected' && (
                      <button onClick={() => handleShowQR(sessionId)}
                        className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-fg transition-colors" title="Ver QR">
                        <QrCode size={16} />
                      </button>
                    )}
                    {!isActive && (
                      <button onClick={() => handleActivate(sessionId)}
                        className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-accent transition-colors" title="Activar como bot">
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(sessionId)}
                      className="p-2 rounded hover:bg-border/50 text-fgMuted hover:text-red-400 transition-colors" title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {showQrForMe && (
                  <div className="mt-4 pt-4 hairline-t">
                    <div className="flex items-center justify-center">
                      {qrData ? (
                        <div className="text-center">
                          {qrData.startsWith('data:image') || qrData.startsWith('http') ? (
                            <img src={qrData} alt="QR Code" className="w-64 h-64 object-contain bg-white p-2 rounded" />
                          ) : (
                            <p className="text-xs font-mono text-fgMuted max-w-md break-all">{qrData}</p>
                          )}
                          <p className="text-xs font-mono text-fgMuted mt-2">Escanea este código QR con WhatsApp</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-8">
                          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs font-mono text-fgMuted">Obteniendo QR...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
