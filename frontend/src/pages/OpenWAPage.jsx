import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import 'flag-icons/css/flag-icons.min.css';
import { COUNTRIES } from '../constants/countries';

function OpenWAPage() {
  const [localPhone, setLocalPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+51');
  const [message, setMessage] = useState('');
  const [log, setLog] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) setCountryOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    axios.get('http://localhost:5000/api/whatsapp/sessions').then(res => {
      const data = res.data.data || [];
      setSessions(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedSession(data[0].name || data[0].id || (typeof data[0] === 'string' ? data[0] : ''));
      }
    }).catch(console.error);
  }, []);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];

  const handleSend = async () => {
    if (!localPhone || !message || !selectedSession) {
      setLog(prev => [...prev, `[RX] ERROR: Completa todos los campos.`]);
      return;
    }
    const fullPhone = `${countryCode}${localPhone}`;
    setLog(prev => [...prev, `[TX] Enviando a ${fullPhone} vía sesión '${selectedSession}'...`]);
    try {
      await axios.post('http://localhost:5000/api/whatsapp/send', { session: selectedSession, phone: fullPhone, text: message });
      setLog(prev => [...prev, `[RX] Mensaje enviado correctamente.`]);
      setMessage('');
    } catch (err) {
      setLog(prev => [...prev, `[RX] ERROR: ${err.response?.data?.error || err.message}`]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <h2 className="text-3xl font-light tracking-tight mb-2">Puente OpenWA</h2>
      <p className="text-fgMuted">Interfaz para probar envío de mensajes WhatsApp vía OpenWA.</p>

      <div className="panel p-6 space-y-6">
        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">SESIÓN</label>
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono">
            <option value="">Seleccionar sesión...</option>
            {sessions.map((s, idx) => {
              const val = s.name || s.id || (typeof s === 'string' ? s : `sesion-${idx}`);
              const display = s.name || val;
              return <option key={val} value={val}>{display}</option>;
            })}
          </select>
        </div>
        <div ref={countryRef}>
          <label className="block text-xs font-mono text-fgMuted mb-2">NÚMERO DESTINO</label>
          <div className="flex gap-2">
            <div className="relative w-[180px] shrink-0">
              <button type="button" onClick={() => setCountryOpen(o => !o)}
                className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono flex items-center gap-2 cursor-pointer text-left">
                <span className={`fi fi-${selectedCountry.iso} text-lg`}></span>
                <span>{selectedCountry.code}</span>
                <span className="ml-auto text-fgMuted text-xs">{countryOpen ? '▲' : '▼'}</span>
              </button>
              {countryOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border max-h-56 overflow-y-auto z-50 shadow-lg">
                  {COUNTRIES.map(c => (
                    <button key={c.code} type="button" onClick={() => { setCountryCode(c.code); setCountryOpen(false); }}
                      className={`w-full px-3 py-2 text-sm font-mono flex items-center gap-2 cursor-pointer text-left hover:bg-accent/10 ${c.code === countryCode ? 'bg-accent/10' : ''}`}>
                      <span className={`fi fi-${c.iso} text-lg`}></span>
                      <span>{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              placeholder="Ej. 970292710" value={localPhone} onChange={e => setLocalPhone(e.target.value.replace(/\D/g, ''))}
              className="flex-1 bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">MENSAJE</label>
          <textarea rows={3} placeholder="Contenido del mensaje..." value={message} onChange={e => setMessage(e.target.value)}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm resize-none font-mono" />
        </div>
        <button onClick={handleSend} className="btn-accent w-full py-3 text-sm tracking-wider uppercase font-mono">Despachar Mensaje</button>
      </div>

      <div className="panel">
        <div className="hairline-b px-4 py-2 bg-panel">
          <span className="text-xs font-mono text-fgMuted">REGISTRO</span>
        </div>
        <div className="p-4 font-mono text-xs space-y-1 text-fgMuted h-48 overflow-y-auto">
          {log.length === 0 ? <p className="opacity-50">Sin actividad.</p> : log.map((l, i) => (
            <p key={i} className={l.includes('[RX]') ? 'text-accent' : ''}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OpenWAPage;
