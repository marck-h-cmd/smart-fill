import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AutomationConfig() {
  const [cfg, setCfg] = useState({ analysis_interval: '60', alert_umbral: '30', auto_optimize: 'false' });
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/automation/status').then(r => {
      if (r.data.data) setCfg(prev => ({ ...prev, ...r.data.data }));
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await axios.post('http://localhost:5000/api/automation/config', cfg);
      setStatusMsg('Configuración guardada.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {statusMsg && <p className={`text-sm font-mono ${statusMsg.includes('Error') ? 'text-red-400' : 'text-accent'}`}>{statusMsg}</p>}
      <div>
        <label className="block text-xs font-mono text-fgMuted mb-2">INTERVALO DE ANÁLISIS (MINUTOS)</label>
        <input type="number" min="5" value={cfg.analysis_interval} onChange={e => setCfg({...cfg, analysis_interval: e.target.value})}
          className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
      </div>
      <div>
        <label className="block text-xs font-mono text-fgMuted mb-2">UMBRAL DE ALERTA (%)</label>
        <input type="number" min="0" max="100" value={cfg.alert_umbral} onChange={e => setCfg({...cfg, alert_umbral: e.target.value})}
          className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
      </div>
      <div>
        <label className="block text-xs font-mono text-fgMuted mb-2">OPTIMIZACIÓN AUTOMÁTICA</label>
        <select value={cfg.auto_optimize} onChange={e => setCfg({...cfg, auto_optimize: e.target.value})}
          className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono">
          <option value="true">Activada</option>
          <option value="false">Desactivada</option>
        </select>
      </div>
      <button onClick={handleSave} className="btn-accent py-2 px-6 text-sm font-mono">Guardar</button>
    </div>
  );
}

function MaintenancePage() {
  const [cfg, setCfg] = useState({ maintenance_enabled: 'false', maintenance_horario: '02:00', maintenance_umbral: '30' });
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/maintenance').then(r => {
      if (r.data.data) setCfg(prev => ({ ...prev, ...r.data.data }));
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await axios.post('http://localhost:5000/api/maintenance', cfg);
      setStatusMsg('Configuración guardada exitosamente.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <h2 className="text-3xl font-light tracking-tight mb-2">Programación de Mantenimiento</h2>
      <p className="text-fgMuted">Configura ventanas de mantenimiento automático para optimización de índices.</p>

      {statusMsg && (
        <p className={`text-sm font-mono ${statusMsg.includes('Error') ? 'text-red-400' : 'text-accent'}`}>{statusMsg}</p>
      )}

      <div className="panel p-6 space-y-6">
        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">MANTENIMIENTO AUTOMÁTICO</label>
          <select value={cfg.maintenance_enabled} onChange={e => setCfg({...cfg, maintenance_enabled: e.target.value})}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono">
            <option value="true">Activado</option>
            <option value="false">Desactivado</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">HORARIO DE EJECUCIÓN (HH:MM)</label>
          <input type="time" value={cfg.maintenance_horario} onChange={e => setCfg({...cfg, maintenance_horario: e.target.value})}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
        </div>

        <div>
          <label className="block text-xs font-mono text-fgMuted mb-2">UMBRAL DE FRAGMENTACIÓN CRÍTICA (%)</label>
          <input type="number" min="0" max="100" value={cfg.maintenance_umbral} onChange={e => setCfg({...cfg, maintenance_umbral: e.target.value})}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono" />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-accent py-3 px-8 text-sm font-mono">Guardar Configuración</button>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4">Automatización de Análisis</h3>
        <AutomationConfig />
      </div>
    </div>
  );
}

export default MaintenancePage;
