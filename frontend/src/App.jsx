import React, { useState, useEffect } from 'react';
import { Database, Sun, Moon } from 'lucide-react';
import axios from 'axios';

function App() {
  const [activeView, setActiveView] = useState('system');
  const [theme, setTheme] = useState('dark');

  // Aplicar clase dark al HTML cuando cambie el tema
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-surface text-fg font-sans flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="h-14 hairline-b flex items-center justify-between px-6 bg-surface z-10 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <h1 className="font-medium tracking-wide">Consola SmartFill</h1>
          <span className="text-fgMuted text-sm font-mono">[ENTORNO: LOCAL]</span>
        </div>
        <div className="flex items-center h-full">
          <nav className="flex gap-1 h-full mr-6">
            <NavTab label="ESTADO DEL SISTEMA" view="system" current={activeView} set={setActiveView} />
            <NavTab label="PUENTE OPENWA" view="openwa" current={activeView} set={setActiveView} />
            <NavTab label="CONFIGURACIÓN IA" view="ai_config" current={activeView} set={setActiveView} />
          </nav>
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-md hover:bg-border/50 text-fgMuted hover:text-fg transition-colors"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column */}
        <div className="w-80 hairline-r bg-panel/50 flex flex-col transition-colors duration-300">
          <div className="p-6 hairline-b">
            <h2 className="text-xs font-mono text-fgMuted uppercase tracking-widest mb-4">[01] OPERACIONES ACTIVAS</h2>
            <div className="space-y-4">
              <OperationRow label="Análisis de Índices" status="INACTIVO" />
              <OperationRow label="Cálculo FillFactor" status="EJECUTANDO" highlight />
              <OperationRow label="Sincronización Agente" status="OK" />
            </div>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            <h2 className="text-xs font-mono text-fgMuted uppercase tracking-widest mb-4">[02] LOGS DE CONTEXTO</h2>
            <div className="font-mono text-xs text-fgMuted space-y-2">
              <p>{'>'} Sistema inicializado</p>
              <p>{'>'} Esperando conexión con OpenWA...</p>
              <p>{'>'} Mock de BD cargado exitosamente</p>
            </div>
          </div>
        </div>

        {/* Right Column: Main View */}
        <div className="flex-1 overflow-y-auto bg-surface p-10 relative transition-colors duration-300">
          <div className="max-w-4xl mx-auto">
            {activeView === 'system' && <SystemView />}
            {activeView === 'openwa' && <OpenWAView />}
            {activeView === 'ai_config' && <AIConfigView />}
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------- Components ----------------

function NavTab({ label, view, current, set }) {
  const active = current === view;
  return (
    <button 
      onClick={() => set(view)}
      className={`px-4 h-full text-xs font-mono tracking-wider border-b-2 transition-colors ${
        active ? 'border-accent text-accent' : 'border-transparent text-fgMuted hover:text-fg hover:bg-border/30'
      }`}
    >
      {label}
    </button>
  );
}

function OperationRow({ label, status, highlight }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="font-medium">{label}</span>
      <span className={`font-mono text-xs px-2 py-0.5 ${highlight ? 'bg-accent/10 text-accent font-bold' : 'text-fgMuted'}`}>
        {status}
      </span>
    </div>
  );
}

function SystemView() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-light tracking-tight mb-2">Fragmentación Global</h2>
        <p className="text-fgMuted">Salud de los índices en tiempo real en las instancias monitorizadas de SQL Server.</p>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border border border-border">
        <MetricBox title="TABLAS CRÍTICAS" value="03" sub="Requieren reconstrucción" />
        <MetricBox title="FILLFACTOR PROM." value="85%" sub="A nivel de sistema" />
        <MetricBox title="ÚLTIMO ESCANEO" value="12:00" sub="UTC" />
      </div>

      <div className="panel p-8 mt-8 flex flex-col items-center justify-center min-h-[300px]">
        <Database size={48} className="text-border mb-4" strokeWidth={1} />
        <p className="text-fgMuted font-mono text-sm">Esperando inyección de datos para gráficos...</p>
      </div>
    </div>
  );
}

function MetricBox({ title, value, sub }) {
  return (
    <div className="bg-panel p-6 flex flex-col justify-between transition-colors duration-300">
      <span className="text-xs font-mono text-fgMuted tracking-wider">{title}</span>
      <div className="mt-4 mb-1">
        <span className="text-4xl font-light font-mono text-accent">{value}</span>
      </div>
      <span className="text-xs text-fgMuted">{sub}</span>
    </div>
  );
}

function OpenWAView() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [log, setLog] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');

  React.useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/whatsapp/sessions');
        const data = res.data.data || [];
        setSessions(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          // Usamos el ID interno para las llamadas API
          setSelectedSession(data[0].id || (typeof data[0] === 'string' ? data[0] : '')); 
        }
      } catch (err) {
        console.error("Error cargando sesiones:", err);
      }
    };
    fetchSessions();
  }, []);

  const handleSend = async () => {
    if (!phone || !message || !selectedSession) {
      setLog(prev => [...prev, `[RX] ERROR: Por favor, selecciona una sesión, un número y un mensaje.`]);
      return;
    }
    setLog(prev => [...prev, `[TX] Usando sesión '${selectedSession}' para despachar a ${phone}...`]);
    
    try {
      // Llamada real al backend
      const response = await axios.post('http://localhost:5000/api/whatsapp/send', {
        session: selectedSession,
        phone: phone,
        text: message
      });
      
      setLog(prev => [...prev, `[RX] Éxito: Backend confirmó envío a OpenWA.`]);
      setMessage('');
    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.error || error.message;
      setLog(prev => [...prev, `[RX] ERROR: Falló la comunicación -> ${errMsg}`]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h2 className="text-3xl font-light tracking-tight mb-2">Puente OpenWA</h2>
        <p className="text-fgMuted">Interfaz directa para probar el envío de mensajes por WhatsApp vía API local.</p>
      </div>

      <div className="panel p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">SESIÓN ACTIVA</label>
            <select 
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono transition-colors"
            >
              <option value="" disabled>Seleccione una sesión...</option>
              {sessions.map((s, idx) => {
                const val = s.id || (typeof s === 'string' ? s : `Sesion-${idx}`);
                const display = s.name || val; // Mostramos el nombre, pero usamos el ID
                return <option key={val} value={val}>{display}</option>
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">NÚMERO DESTINO (CON CÓDIGO DE PAÍS)</label>
            <input 
              type="text" 
              placeholder="Ej. 51999999999" 
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">CARGA ÚTIL (MENSAJE)</label>
            <textarea 
              rows={3}
              placeholder="Contenido del mensaje..." 
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm resize-none transition-colors"
            />
          </div>
        </div>

        <button onClick={handleSend} className="btn-accent w-full py-3 text-sm tracking-wider uppercase font-mono">
          Despachar Mensaje
        </button>
      </div>

      <div className="panel bg-surface border-border border">
        <div className="hairline-b px-4 py-2 bg-panel transition-colors duration-300">
          <span className="text-xs font-mono text-fgMuted">REGISTRO DE TRANSMISIÓN</span>
        </div>
        <div className="p-4 font-mono text-xs space-y-2 text-fgMuted h-48 overflow-y-auto">
          {log.length === 0 ? <p className="opacity-50">No hay transmisiones registradas en esta sesión.</p> : log.map((l, i) => (
            <p key={i} className={l.includes('[RX]') ? 'text-accent' : ''}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIConfigView() {
  const [sessions, setSessions] = useState([]);
  const [config, setConfig] = useState({
    bot_session: '',
    ai_model: 'gemini/gemini-1.5-pro',
    ai_api_key: ''
  });
  const [statusMsg, setStatusMsg] = useState('');

  React.useEffect(() => {
    // Cargar sesiones de OpenWA
    axios.get('http://localhost:5000/api/whatsapp/sessions')
      .then(res => setSessions(Array.isArray(res.data.data) ? res.data.data : []))
      .catch(err => console.error(err));

    // Cargar configuración de la BD
    axios.get('http://localhost:5000/api/config')
      .then(res => {
        if (res.data.data) {
          setConfig(prev => ({ ...prev, ...res.data.data }));
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSave = async () => {
    setStatusMsg('Guardando configuración...');
    try {
      await axios.post('http://localhost:5000/api/config', config);
      setStatusMsg('¡Configuración guardada exitosamente!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(`Error al guardar: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h2 className="text-3xl font-light tracking-tight mb-2">Motor de Inteligencia Artificial</h2>
        <p className="text-fgMuted">Configura los parámetros del LLM y la sesión asignada al bot.</p>
      </div>

      <div className="panel p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">SESIÓN DE OPENWA ASIGNADA AL BOT</label>
            <select 
              value={config.bot_session}
              onChange={e => setConfig({...config, bot_session: e.target.value})}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono transition-colors"
            >
              <option value="">Ninguna (Bot desactivado)</option>
              {sessions.map((s, idx) => {
                const val = s.id || (typeof s === 'string' ? s : `Sesion-${idx}`);
                const display = s.name || val;
                return <option key={val} value={val}>{display}</option>
              })}
            </select>
            <p className="text-xs text-fgMuted mt-2 font-mono">El bot solo escuchará y responderá en esta sesión.</p>
          </div>

          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">IDENTIFICADOR DEL MODELO (LITELLM)</label>
            <input 
              type="text" 
              placeholder="Ej. gemini/gemini-1.5-pro, groq/llama3-8b-8192" 
              value={config.ai_model}
              onChange={e => setConfig({...config, ai_model: e.target.value})}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono transition-colors"
            />
            <p className="text-xs text-fgMuted mt-2 font-mono">Usa el formato proveedor/modelo compatible con LiteLLM.</p>
          </div>

          <div>
            <label className="block text-xs font-mono text-fgMuted mb-2">API KEY DEL PROVEEDOR</label>
            <input 
              type="password" 
              placeholder="sk-..." 
              value={config.ai_api_key}
              onChange={e => setConfig({...config, ai_api_key: e.target.value})}
              className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono transition-colors"
            />
          </div>
        </div>

        <button onClick={handleSave} className="btn-accent w-full py-3 text-sm tracking-wider uppercase font-mono">
          Guardar Configuración
        </button>

        {statusMsg && (
          <p className={`text-sm font-mono ${statusMsg.includes('Error') ? 'text-danger' : 'text-accent'}`}>
            {statusMsg}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;