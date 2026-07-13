import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AIConfigPage() {
  const [sessions, setSessions] = useState([]);
  const [config, setConfig] = useState({ bot_session: '', ai_model: '', ai_api_key: '' });
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/whatsapp/sessions').then(res =>
      setSessions(Array.isArray(res.data.data) ? res.data.data : [])
    ).catch(console.error);
    axios.get('http://localhost:5000/api/config').then(res => {
      if (res.data.data) {
        setConfig(prev => ({ ...prev, ...res.data.data }));
      }
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setStatusMsg('Guardando...');
    try {
      const payload = { bot_session: config.bot_session, ai_model: config.ai_model, ai_api_key: config.ai_api_key };
      await axios.post('http://localhost:5000/api/config', payload);
      setStatusMsg('Configuración guardada.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <h2 className="text-3xl font-light tracking-tight mb-2">Configuración del Motor IA</h2>
      <p className="text-fgMuted">Parámetros del LLM para el asistente inteligente.</p>

      <div className="panel p-6 space-y-6">
        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">SESIÓN DEL BOT</label>
          <select value={config.bot_session} onChange={e => setConfig({...config, bot_session: e.target.value})}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono">
            <option value="">Ninguna (bot desactivado)</option>
            {sessions.map((s, idx) => {
              const sid = s.id || `temp-${idx}`;
              return <option key={sid} value={sid}>{s.name || sid}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">MODELO (LITELLM)</label>
          <input type="text" placeholder="gemini/gemini-1.5-pro" value={config.ai_model} onChange={e => setConfig({...config, ai_model: e.target.value})}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">API KEY DEL PROVEEDOR</label>
          <input type="password" placeholder="sk-..." value={config.ai_api_key} onChange={e => setConfig({...config, ai_api_key: e.target.value})}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
        </div>
        <button onClick={handleSave} className="btn-accent w-full py-3 text-sm tracking-wider uppercase font-mono">Guardar Configuración IA</button>
        {statusMsg && <p className={`text-sm font-mono ${statusMsg.includes('Error') ? 'text-red-400' : 'text-accent'}`}>{statusMsg}</p>}
      </div>
    </div>
  );
}

export default AIConfigPage;
