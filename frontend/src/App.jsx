import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon, Activity, Database, Smartphone, BarChart3, Clock, FileText, Wrench, MessageSquare, Cpu } from 'lucide-react';
import axios from 'axios';
import 'flag-icons/css/flag-icons.min.css';
import KPICard from './components/dashboard/KPICard';
import HeatMap from './components/dashboard/HeatMap';
import TrendChart from './components/dashboard/TrendChart';
import DatabaseConfig from './components/configuration/DatabaseConfig';
import WhatsAppSessionManager from './components/whatsapp/WhatsAppSessionManager';
import MonitoringView from './pages/Monitoring';
import { databases } from './services/apiClient';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [configTab, setConfigTab] = useState('databases');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-surface text-fg font-sans flex flex-col transition-colors duration-300">
      <header className="h-14 hairline-b flex items-center justify-between px-6 bg-surface z-10 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <h1 className="font-medium tracking-wide">SmartFill</h1>
          <span className="text-fgMuted text-sm font-mono">[CONSOLA DE ADMINISTRACIÓN]</span>
        </div>
        <div className="flex items-center h-full">
          <nav className="flex gap-1 h-full mr-6 overflow-x-auto">
            <NavTab label="DASHBOARD" view="dashboard" current={activeView} set={setActiveView} icon={<BarChart3 size={14} />} />
            <NavTab label="CONFIGURACIÓN" view="configuration" current={activeView} set={setActiveView} icon={<Database size={14} />} />
            <NavTab label="HISTORIAL" view="history" current={activeView} set={setActiveView} icon={<Clock size={14} />} />
            <NavTab label="REPORTES" view="reports" current={activeView} set={setActiveView} icon={<FileText size={14} />} />
            <NavTab label="MANTENIMIENTO" view="maintenance" current={activeView} set={setActiveView} icon={<Wrench size={14} />} />
            <NavTab label="MONITOREO" view="monitoring" current={activeView} set={setActiveView} icon={<Activity size={14} />} />
            <NavTab label="OPENWA" view="openwa" current={activeView} set={setActiveView} icon={<MessageSquare size={14} />} />
            <NavTab label="IA" view="ai_config" current={activeView} set={setActiveView} icon={<Cpu size={14} />} />
          </nav>
          <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-border/50 text-fgMuted hover:text-fg transition-colors" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-80 hairline-r bg-panel/50 flex flex-col transition-colors duration-300 overflow-y-auto">
          <SidebarContent activeView={activeView} setActiveView={setActiveView} configTab={configTab} setConfigTab={setConfigTab} />
        </div>

        <div className="flex-1 overflow-y-auto bg-surface p-10 relative transition-colors duration-300">
          <div className="max-w-5xl mx-auto">
            {activeView === 'dashboard' && <DashboardView />}
            {activeView === 'configuration' && (
              <ConfigurationView configTab={configTab} setConfigTab={setConfigTab} />
            )}
            {activeView === 'history' && <HistoryView />}
            {activeView === 'reports' && <ReportsView />}
            {activeView === 'maintenance' && <MaintenanceView />}
            {activeView === 'monitoring' && <MonitoringView />}
            {activeView === 'openwa' && <OpenWAView />}
            {activeView === 'ai_config' && <AIConfigView />}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavTab({ label, view, current, set, icon }) {
  const active = current === view;
  return (
    <button onClick={() => set(view)}
      className={`px-3 h-full text-xs font-mono tracking-wider border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
        active ? 'border-accent text-accent' : 'border-transparent text-fgMuted hover:text-fg hover:bg-border/30'
      }`}>
      {icon} {label}
    </button>
  );
}

function SidebarContent({ activeView, setActiveView, configTab, setConfigTab }) {
  const items = [
    { view: 'dashboard', label: 'Dashboard Principal', icon: BarChart3 },
    { view: 'configuration', label: 'Configuración', icon: Database },
    { view: 'history', label: 'Historial', icon: Clock },
    { view: 'reports', label: 'Reportes', icon: FileText },
    { view: 'maintenance', label: 'Mantenimiento', icon: Wrench },
    { view: 'monitoring', label: 'Monitoreo', icon: Activity },
    { view: 'openwa', label: 'Puente OpenWA', icon: MessageSquare },
    { view: 'ai_config', label: 'Configuración IA', icon: Cpu },
  ];

  return (
    <div className="p-4 space-y-1">
      <h2 className="text-xs font-mono text-fgMuted uppercase tracking-widest mb-4 px-2">Navegación</h2>
      {items.map(item => (
        <button key={item.view} onClick={() => setActiveView(item.view)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-mono transition-colors ${
            activeView === item.view ? 'bg-accent/10 text-accent' : 'text-fgMuted hover:text-fg hover:bg-border/30'
          }`}>
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DashboardView() {
  const [dbStats, setDbStats] = useState(null);
  const [fragData, setFragData] = useState([]);
  const [activeDb, setActiveDb] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/databases/active');
      const db = res.data.data;
      setActiveDb(db);
      if (db && db.id) {
        const [statsRes, fragRes] = await Promise.all([
          axios.post(`http://localhost:5000/api/databases/${db.id}/stats`),
          axios.post(`http://localhost:5000/api/databases/${db.id}/fragmentation`)
        ]);
        setDbStats(statsRes.data.data);
        setFragData(fragRes.data.data || []);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 30000); return () => clearInterval(iv); }, [loadData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2">Dashboard de Fragmentación</h2>
          <p className="text-fgMuted">
            {activeDb ? `BD Activa: ${activeDb.name} (${activeDb.host}/${activeDb.database})` : 'Sin BD activa. Configura una en Configuración.'}
          </p>
        </div>
        <button onClick={loadData} className="btn-accent py-2 px-4 text-sm font-mono flex items-center gap-2">
          <Activity size={16} /> Actualizar
        </button>
      </div>

      {loading && !dbStats && <p className="text-fgMuted font-mono text-sm">Cargando datos...</p>}

      {dbStats && (
        <div className="grid grid-cols-4 gap-px bg-border border border-border">
          <KPICard title="TOTAL ÍNDICES" value={dbStats.total_indexes || 0} sub="Monitoreados" />
          <KPICard title="PROM. FRAGMENTACIÓN" value={`${dbStats.avg_fragmentation || 0}%`} sub="General" />
          <KPICard title="CRÍTICAS" value={dbStats.critical_count || 0} sub="≥30% fragmentación" />
          <KPICard title="SALUDABLES" value={dbStats.healthy_count || 0} sub="<10% fragmentación" />
        </div>
      )}

      {!activeDb && (
        <div className="panel p-8 flex flex-col items-center justify-center min-h-[300px]">
          <Database size={48} className="text-border mb-4" strokeWidth={1} />
          <p className="text-fgMuted font-mono text-sm">Configura una base de datos activa para ver métricas en tiempo real.</p>
        </div>
      )}

      <HeatMap data={fragData} />
      <TrendChart data={fragData} />
    </div>
  );
}

function ConfigurationView({ configTab, setConfigTab }) {
  const tabs = [
    { id: 'databases', label: 'Bases de Datos', icon: Database },
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-light tracking-tight mb-2">Configuración</h2>
      <p className="text-fgMuted">Gestiona conexiones a SQL Server y sesiones de WhatsApp.</p>

      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setConfigTab(t.id)}
            className={`px-4 py-3 text-sm font-mono flex items-center gap-2 border-b-2 transition-colors ${
              configTab === t.id ? 'border-accent text-accent' : 'border-transparent text-fgMuted hover:text-fg'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {configTab === 'databases' && <DatabaseConfig />}
        {configTab === 'whatsapp' && <WhatsAppSessionManager />}
      </div>
    </div>
  );
}

function HistoryView() {
  const [records, setRecords] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (table) => {
    setLoading(true);
    try {
      const params = table ? `?table=${encodeURIComponent(table)}` : '';
      const res = await axios.get(`http://localhost:5000/api/history${params}`);
      setRecords(res.data.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => {
    axios.get('http://localhost:5000/api/history/tables').then(r => setTables(r.data.data || [])).catch(console.error);
    loadHistory();
  }, [loadHistory]);

  const handleFilter = () => { loadHistory(selectedTable); };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-light tracking-tight mb-2">Historial de Métricas</h2>
      <p className="text-fgMuted">Evolución de la fragmentación de índices en el tiempo.</p>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-mono text-fgMuted mb-1">Filtrar por tabla</label>
          <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)}
            className="w-full bg-surface border border-border p-3 focus:outline-none focus:border-accent text-sm font-mono">
            <option value="">Todas las tablas</option>
            {tables.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={handleFilter} className="btn-accent py-3 px-6 text-sm font-mono">Filtrar</button>
      </div>

      {loading && <p className="text-fgMuted font-mono text-sm">Cargando...</p>}

      {records.length === 0 && !loading && (
        <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Clock size={48} className="text-border mb-4" strokeWidth={1} />
          <p className="text-fgMuted font-mono text-sm">No hay datos históricos disponibles.</p>
        </div>
      )}

      {records.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="hairline-b bg-panel">
                  <th className="text-left p-3 text-fgMuted text-xs">Tabla</th>
                  <th className="text-right p-3 text-fgMuted text-xs">Fragmentación</th>
                  <th className="text-right p-3 text-fgMuted text-xs">FillFactor</th>
                  <th className="text-right p-3 text-fgMuted text-xs">Filas</th>
                  <th className="text-right p-3 text-fgMuted text-xs">Última Actualización</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="hairline-b hover:bg-border/20 transition-colors">
                    <td className="p-3">{r.nombre_tabla}</td>
                    <td className={`p-3 text-right ${
                      r.fragmentacion_porcentaje >= 30 ? 'text-red-400' :
                      r.fragmentacion_porcentaje >= 10 ? 'text-yellow-400' : 'text-green-400'
                    }`}>{r.fragmentacion_porcentaje}%</td>
                    <td className="p-3 text-right">{r.fillfactor_actual}</td>
                    <td className="p-3 text-right">{r.total_filas}</td>
                    <td className="p-3 text-right text-fgMuted text-xs">{r.ultima_actualizacion?.slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsView() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('http://localhost:5000/api/reports');
      setReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2">Reportes Ejecutivos</h2>
          <p className="text-fgMuted">Análisis de costo-beneficio de optimizaciones realizadas.</p>
        </div>
        <button onClick={generateReport} disabled={loading} className="btn-accent py-3 px-6 text-sm font-mono flex items-center gap-2">
          <FileText size={16} /> {loading ? 'Generando...' : 'Generar Reporte'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

      {!report && !loading && (
        <div className="panel p-8 flex flex-col items-center justify-center min-h-[300px]">
          <FileText size={48} className="text-border mb-4" strokeWidth={1} />
          <p className="text-fgMuted font-mono text-sm">Haz clic en "Generar Reporte" para obtener un resumen ejecutivo.</p>
        </div>
      )}

      {loading && <p className="text-fgMuted font-mono text-sm">Generando reporte...</p>}

      {report && (
        <div className="panel p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-mono">Resumen Ejecutivo</h3>
            <span className="text-xs font-mono text-fgMuted">Generado: {new Date(report.generated_at).toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-4 gap-px bg-border border border-border">
            <KPICard title="TABLAS ANALIZADAS" value={report.summary.total_tables_analyzed} sub="En total" />
            <KPICard title="FRAGMENTACIÓN PROM." value={`${report.summary.average_fragmentation}%`} sub="General" />
            <KPICard title="TABLAS CRÍTICAS" value={report.summary.critical_tables} sub="≥30%" />
            <KPICard title="TABLAS SALUDABLES" value={report.summary.healthy_tables} sub="<10%" />
          </div>

          {report.critical_tables?.length > 0 && (
            <div>
              <h4 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-3">Tablas Críticas</h4>
              <div className="space-y-2">
                {report.critical_tables.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded">
                    <span className="font-mono text-sm">{t.nombre_tabla}</span>
                    <span className="font-mono text-sm text-red-400">{t.fragmentacion_porcentaje}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button onClick={() => window.print()} className="btn-accent py-2 px-4 text-sm font-mono">
              Imprimir Reporte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenanceView() {
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

const COUNTRIES = [
  { code: '+51', iso: 'pe', name: 'Perú' },
  { code: '+52', iso: 'mx', name: 'México' },
  { code: '+54', iso: 'ar', name: 'Argentina' },
  { code: '+57', iso: 'co', name: 'Colombia' },
  { code: '+56', iso: 'cl', name: 'Chile' },
  { code: '+34', iso: 'es', name: 'España' },
  { code: '+1', iso: 'us', name: 'EE.UU./Canadá' },
  { code: '+58', iso: 've', name: 'Venezuela' },
  { code: '+593', iso: 'ec', name: 'Ecuador' },
  { code: '+591', iso: 'bo', name: 'Bolivia' },
  { code: '+595', iso: 'py', name: 'Paraguay' },
  { code: '+598', iso: 'uy', name: 'Uruguay' },
  { code: '+506', iso: 'cr', name: 'Costa Rica' },
  { code: '+502', iso: 'gt', name: 'Guatemala' },
  { code: '+507', iso: 'pa', name: 'Panamá' },
  { code: '+53', iso: 'cu', name: 'Cuba' },
  { code: '+55', iso: 'br', name: 'Brasil' },
  { code: '+44', iso: 'gb', name: 'Reino Unido' },
  { code: '+39', iso: 'it', name: 'Italia' },
  { code: '+49', iso: 'de', name: 'Alemania' },
  { code: '+33', iso: 'fr', name: 'Francia' },
];

function OpenWAView() {
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

function AIConfigView() {
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

export default App;
