import React, { useState, useEffect, useCallback, useRef } from 'react';
import { whatsapp, config as configApi } from '../../services/apiClient';
import { Plus, Smartphone, QrCode, Trash2, CheckCircle, XCircle, RefreshCw, MessageSquare } from 'lucide-react';

export default function WhatsAppSessionManager() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState('');
  const [newName, setNewName] = useState('');
  const [qrData, setQrData] = useState(null);
  const [qrSessionId, setQrSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [botConfig, setBotConfig] = useState({ admin_phone: '', allowed_chat: '', bot_alias: '@BotSmartfill' });
  const [chats, setChats] = useState([]);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneManual, setPhoneManual] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatManual, setChatManual] = useState(false);
  const [cfgStatus, setCfgStatus] = useState('');
  const phoneRef = useRef(null);
  const chatRef = useRef(null);

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

  const loadBotData = useCallback(async () => {
    try {
      const data = await configApi.get();
      setBotConfig(prev => ({ ...prev, ...data }));
    } catch (_) {}
    try {
      const res = await fetch('http://localhost:5000/api/whatsapp/chats').then(r => r.json());
      if (Array.isArray(res.data)) setChats(res.data);
    } catch (_) {}
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    const handleClick = (e) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target)) setPhoneOpen(false);
      if (chatRef.current && !chatRef.current.contains(e.target)) setChatOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { loadBotData(); }, [loadBotData]);

  useEffect(() => {
    if (botConfig.allowed_chat) {
      setChatManual(!chats.find(c => c.id === botConfig.allowed_chat));
    } else {
      setChatManual(false);
    }
  }, [botConfig.allowed_chat, chats]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setStatusMsg('');
    try {
      const result = await whatsapp.createSession(newName.trim());
      const sessionData = result?.data;
      const sessionId = sessionData?.id || sessionData?.name || newName.trim();
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
      loadBotData();
    } catch (err) {
      setStatusMsg(`Error al activar: ${err.message}`);
    }
  };

  const handleSaveConfig = async () => {
    setCfgStatus('Guardando...');
    try {
      const payload = { admin_phone: botConfig.admin_phone, allowed_chat: botConfig.allowed_chat, bot_alias: botConfig.bot_alias };
      await configApi.save(payload);
      setCfgStatus('Configuración guardada.');
      setTimeout(() => setCfgStatus(''), 3000);
    } catch (err) {
      setCfgStatus(`Error: ${err.message}`);
    }
  };

  const getSessionStatus = (session) => {
    const state = (session.state || session.status || '').toLowerCase();
    if (state === 'connected' || state === 'open' || state === 'activo' || state === 'ready' || state === 'authenticated') return 'connected';
    if (state === 'connecting' || state === 'loading' || state === 'scanning' || state === 'authenticating') return 'connecting';
    if (state === 'disconnected' || state === 'failed' || state === 'error' || state === 'created') return 'disconnected';
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
                    {isActive ? (
                      <button onClick={() => handleActivate(sessionId)}
                        className="p-2 rounded hover:bg-border/50 text-accent hover:text-green-400 transition-colors" title="Reconectar y re-registrar webhook">
                        <RefreshCw size={16} />
                      </button>
                    ) : (
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

      <div className="hairline-t my-8"></div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={18} className="text-accent" />
          <h3 className="text-lg font-mono font-medium">Configuración del Bot</h3>
        </div>
        <p className="text-sm text-fgMuted mb-4">Destinatario de alertas, chat autorizado para comandos y alias de activación IA.</p>

        <div className="panel p-6 space-y-4">
          <div ref={phoneRef}>
            <label className="block text-xs font-mono text-fgMuted mb-2">🚨 DESTINATARIO DE ALERTAS</label>
            <div className="relative">
              <button type="button" onClick={() => setPhoneOpen(o => !o)}
                className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono flex items-center gap-2 cursor-pointer text-left">
                {(() => {
                  if (!botConfig.admin_phone) return <span className="text-fgMuted">Seleccionar chat o grupo...</span>;
                  if (phoneManual) return <span className="text-fgMuted">✏️ {botConfig.admin_phone}</span>;
                  const c = chats.find(x => x.id === botConfig.admin_phone);
                  if (c) return <span>{c.name} <span className="text-fgMuted">({c.isGroup ? 'Grupo' : 'Contacto'})</span></span>;
                  return <span className="text-fgMuted">{botConfig.admin_phone}</span>;
                })()}
                <span className="ml-auto text-fgMuted text-xs">{phoneOpen ? '▲' : '▼'}</span>
              </button>
              {phoneOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border max-h-64 overflow-y-auto z-50 shadow-lg">
                  {chats.filter(c => c.name).map(c => (
                    <button key={c.id} type="button" onClick={() => { setBotConfig({...botConfig, admin_phone: c.id}); setPhoneManual(false); setPhoneOpen(false); }}
                      className={`w-full px-3 py-2 text-sm font-mono flex items-center gap-2 cursor-pointer text-left hover:bg-accent/10 ${c.id === botConfig.admin_phone ? 'bg-accent/10' : ''}`}>
                      <span>{c.name}</span>
                      <span className="text-fgMuted text-xs ml-auto">{c.isGroup ? 'Grupo' : 'Contacto'}</span>
                    </button>
                  ))}
                  <div className="hairline-t mx-3"></div>
                  <button type="button" onClick={() => { setPhoneManual(true); setPhoneOpen(false); setBotConfig({...botConfig, admin_phone: ''}); }}
                    className="w-full px-3 py-2 text-sm font-mono flex items-center gap-2 cursor-pointer text-left hover:bg-accent/10 text-fgMuted">
                    ✏️ Ingresar ID manualmente...
                  </button>
                </div>
              )}
            </div>
            {phoneManual && (
              <input type="text" placeholder="Ej. 51970292710@c.us" value={botConfig.admin_phone} onChange={e => setBotConfig({...botConfig, admin_phone: e.target.value})}
                className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono mt-2" />
            )}
            <p className="text-xs text-fgMuted mt-1">Chat o grupo que recibirá las alertas automáticas.</p>
          </div>

          <div ref={chatRef}>
            <label className="block text-xs font-mono text-fgMuted mb-2">💬 CHAT AUTORIZADO</label>
            <div className="relative">
              <button type="button" onClick={() => setChatOpen(o => !o)}
                className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono flex items-center gap-2 cursor-pointer text-left">
                {(() => {
                  if (!botConfig.allowed_chat) return <span className="text-fgMuted">Seleccionar chat o grupo...</span>;
                  if (chatManual) return <span className="text-fgMuted">✏️ {botConfig.allowed_chat}</span>;
                  const c = chats.find(x => x.id === botConfig.allowed_chat);
                  if (c) return <span>{c.name} <span className="text-fgMuted">({c.isGroup ? 'Grupo' : 'Contacto'})</span></span>;
                  return <span className="text-fgMuted">{botConfig.allowed_chat}</span>;
                })()}
                <span className="ml-auto text-fgMuted text-xs">{chatOpen ? '▲' : '▼'}</span>
              </button>
              {chatOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border max-h-64 overflow-y-auto z-50 shadow-lg">
                  {chats.filter(c => c.name).map(c => (
                    <button key={c.id} type="button" onClick={() => { setBotConfig({...botConfig, allowed_chat: c.id}); setChatManual(false); setChatOpen(false); }}
                      className={`w-full px-3 py-2 text-sm font-mono flex items-center gap-2 cursor-pointer text-left hover:bg-accent/10 ${c.id === botConfig.allowed_chat ? 'bg-accent/10' : ''}`}>
                      <span>{c.name}</span>
                      <span className="text-fgMuted text-xs ml-auto">{c.isGroup ? 'Grupo' : 'Contacto'}</span>
                    </button>
                  ))}
                  <div className="hairline-t mx-3"></div>
                  <button type="button" onClick={() => { setChatManual(true); setChatOpen(false); setBotConfig({...botConfig, allowed_chat: ''}); }}
                    className="w-full px-3 py-2 text-sm font-mono flex items-center gap-2 cursor-pointer text-left hover:bg-accent/10 text-fgMuted">
                    ✏️ Ingresar ID manualmente...
                  </button>
                </div>
              )}
            </div>
            {chatManual && (
              <input type="text" placeholder="Ej. 120363429876270766@g.us" value={botConfig.allowed_chat} onChange={e => setBotConfig({...botConfig, allowed_chat: e.target.value})}
                className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono mt-2" />
            )}
            <p className="text-xs text-fgMuted mt-1">Solo los mensajes de este chat/grupo activarán comandos del bot.</p>
          </div>

          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">🤖 ALIAS DEL BOT</label>
            <input type="text" placeholder="@BotSmartfill" value={botConfig.bot_alias} onChange={e => setBotConfig({...botConfig, bot_alias: e.target.value})}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
            <p className="text-xs text-fgMuted mt-1">Menciona este alias en cualquier parte del mensaje para activar la IA.</p>
          </div>

          <button onClick={handleSaveConfig} className="btn-accent w-full py-3 text-sm tracking-wider uppercase font-mono">Guardar Configuración del Bot</button>
          {cfgStatus && <p className={`text-sm font-mono ${cfgStatus.includes('Error') ? 'text-red-400' : 'text-accent'}`}>{cfgStatus}</p>}
        </div>
      </div>
    </div>
  );
}
