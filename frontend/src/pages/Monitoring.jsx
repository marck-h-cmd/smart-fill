import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Activity, AlertTriangle, Database, HardDrive, Clock, Play, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API = 'http://localhost:5000/api';

export default function Monitoring() {
  const [alerts, setAlerts] = useState([]);
  const [kpiData, setKpiData] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [trends, setTrends] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const loadSupportingData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [autoRes, schedRes, trendsRes] = await Promise.all([
        axios.get(`${API}/automation/status`),
        axios.get(`${API}/scheduler/status`),
        axios.get(`${API}/trends`)
      ]);
      setAutomationStatus(autoRes.data.data);
      setSchedulerStatus(schedRes.data.data);
      setTrends(trendsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSupportingData(); }, [loadSupportingData]);

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    try {
      const res = await axios.post(`${API}/check-and-alert`);
      const data = res.data.data;
      setKpiData(data);
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setChecking(false);
  };

  const loadTableHistory = async (tableName) => {
    setSelectedTable(tableName);
    try {
      const res = await axios.get(`${API}/trends/${encodeURIComponent(tableName)}`);
      const trendData = res.data.data || [];
      setChartData({
        labels: trendData.map(d => d.date || d.timestamp?.slice(0, 10)),
        datasets: [{
          label: `${tableName} — Fragmentación`,
          data: trendData.map(d => d.fragmentation_percent),
          borderColor: '#00F0FF',
          backgroundColor: 'rgba(0, 240, 255, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: trendData.map(d =>
            d.fragmentation_percent >= 30 ? '#ef4444' :
            d.fragmentation_percent >= 10 ? '#eab308' : '#22c55e'
          ),
          pointBorderColor: trendData.map(d =>
            d.fragmentation_percent >= 30 ? '#ef4444' :
            d.fragmentation_percent >= 10 ? '#eab308' : '#22c55e'
          ),
        }]
      });
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityBorder = (severity) => {
    switch (severity) {
      case 'critical': return 'border-red-500/30 bg-red-500/5';
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'info': return 'border-blue-500/30 bg-blue-500/5';
      default: return 'border-gray-500/30 bg-gray-500/5';
    }
  };

  const getSeverityText = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-400';
      case 'warning': return 'bg-yellow-500/10 text-yellow-400';
      case 'info': return 'bg-blue-500/10 text-blue-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'worsening': return <TrendingUp size={16} className="text-red-400" />;
      case 'improving': return <TrendingDown size={16} className="text-green-400" />;
      default: return <Minus size={16} className="text-gray-400" />;
    }
  };

  const getTrendLabel = (trend) => {
    switch (trend) {
      case 'worsening': return 'Empeorando';
      case 'improving': return 'Mejorando';
      default: return 'Estable';
    }
  };

  const getTrendBadge = (trend) => {
    switch (trend) {
      case 'worsening': return 'bg-red-500/10 text-red-400';
      case 'improving': return 'bg-green-500/10 text-green-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#888', font: { family: 'JetBrains Mono', size: 11 } }
      },
      tooltip: {
        backgroundColor: '#111',
        titleColor: '#ededed',
        bodyColor: '#888',
        borderColor: '#222',
        borderWidth: 1,
        padding: 10,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 11 } },
        grid: { color: 'rgba(34, 34, 34, 0.6)' }
      },
      x: {
        ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 11 } },
        grid: { display: false }
      }
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2">Monitoreo de Base de Datos</h2>
          <p className="text-fgMuted">Estado de fragmentación, alertas y tendencias de optimización de índices.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSupportingData}
            className="py-2 px-4 text-sm font-mono text-fgMuted hover:text-fg border border-border hover:bg-panel transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} /> Recargar
          </button>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="btn-accent py-3 px-6 text-sm font-mono flex items-center gap-2 disabled:opacity-50"
          >
            {checking ? (
              <span className="w-4 h-4 block border-2 border-white dark:border-surface border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={16} />
            )}
            {checking ? 'Ejecutando...' : 'Ejecutar Chequeo Ahora'}
          </button>
        </div>
      </div>

      {error && (
        <div className="panel p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm font-mono text-red-400">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      {kpiData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          <div className="bg-panel p-6 flex flex-col justify-between transition-colors duration-300">
            <span className="text-xs font-mono text-fgMuted tracking-wider uppercase">Base de Datos</span>
            <div className="mt-4 mb-1">
              <span className="text-3xl font-light font-mono text-accent">{kpiData.database || 'N/A'}</span>
            </div>
            <span className="text-xs text-fgMuted">{new Date(kpiData.timestamp).toLocaleString()}</span>
          </div>
          <div className="bg-panel p-6 flex flex-col justify-between transition-colors duration-300">
            <span className="text-xs font-mono text-fgMuted tracking-wider uppercase">Alertas</span>
            <div className="mt-4 mb-1 flex items-baseline gap-2">
              <span className={`text-4xl font-light font-mono ${alerts.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{alerts.length}</span>
              {alerts.length > 0 && (
                <span className="text-xs text-fgMuted">({criticalCount} críticas · {warningCount} warnings)</span>
              )}
            </div>
            <span className="text-xs text-fgMuted">{kpiData.has_alerts ? 'Requiere atención' : 'Sin novedades'}</span>
          </div>
          <div className="bg-panel p-6 flex flex-col justify-between transition-colors duration-300">
            <span className="text-xs font-mono text-fgMuted tracking-wider uppercase">Índices Críticos</span>
            <div className="mt-4 mb-1">
              <span className={`text-4xl font-light font-mono ${(kpiData.fragmentation?.critical_count || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {kpiData.fragmentation?.critical_count || 0}
              </span>
            </div>
            <span className="text-xs text-fgMuted">Fragmentación ≥30%</span>
          </div>
          <div className="bg-panel p-6 flex flex-col justify-between transition-colors duration-300">
            <span className="text-xs font-mono text-fgMuted tracking-wider uppercase">Espacio Usado</span>
            <div className="mt-4 mb-1">
              <span className="text-4xl font-light font-mono text-accent">{kpiData.space?.used_percent || 0}%</span>
            </div>
            <span className="text-xs text-fgMuted">{kpiData.space?.free_mb || 0} MB libres</span>
          </div>
        </div>
      ) : (
        !loading && !checking && (
          <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
            <Activity size={48} className="text-border mb-4" strokeWidth={1} />
            <p className="text-fgMuted font-mono text-sm">Presiona "Ejecutar Chequeo Ahora" para analizar la base de datos activa.</p>
          </div>
        )
      )}

      {checking && !kpiData && (
        <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
          <span className="w-6 h-6 block border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-fgMuted font-mono text-sm">Ejecutando chequeo de base de datos...</p>
        </div>
      )}

      {/* Alert List */}
      {alerts.length > 0 && (
        <div className="panel p-6">
          <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> Alertas Detectadas
          </h3>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className={`p-4 rounded border ${getSeverityBorder(alert.severity)}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded uppercase ${getSeverityBadge(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className={`text-sm font-mono font-medium ${getSeverityText(alert.severity)}`}>
                    {alert.type === 'fragmentation' ? 'Fragmentación' : alert.type === 'space' ? 'Espacio en disco' : alert.type}
                  </span>
                </div>
                <p className="text-sm font-mono text-fgMuted ml-1">{alert.message}</p>
                {alert.items?.length > 0 && (
                  <div className="mt-2 ml-1 space-y-1">
                    {alert.items.slice(0, 5).map((item, j) => (
                      <p key={j} className="text-xs font-mono text-fgMuted/70">
                        {item.table_name}{item.index_name ? `.${item.index_name}` : ''} — {item.fragmentation_percent?.toFixed(1)}%
                      </p>
                    ))}
                    {alert.items.length > 5 && (
                      <p className="text-xs font-mono text-fgMuted/50">...y {alert.items.length - 5} más</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {kpiData && !kpiData.has_alerts && alerts.length === 0 && (
        <div className="panel p-8 flex flex-col items-center justify-center min-h-[150px] border-green-500/30 bg-green-500/5">
          <span className="text-4xl mb-2">✅</span>
          <p className="text-green-400 font-mono text-sm">No se detectaron problemas. La base de datos está saludable.</p>
        </div>
      )}

      {/* Alert Delivery Status */}
      {kpiData && kpiData.alert_sent !== undefined && (
        <div className={`panel p-4 ${kpiData.alert_sent ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          <p className="text-sm font-mono">
            {kpiData.alert_sent
              ? `📲 Alerta enviada al administrador (${kpiData.alert_sent_to})`
              : `⚠️ No se pudo enviar alerta: ${kpiData.alert_error || kpiData.alert_skipped || 'Error desconocido'}`}
          </p>
        </div>
      )}

      {/* Trends Section */}
      <div className="panel p-6">
        <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} /> Tendencias de Fragmentación por Tabla
        </h3>
        {trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[120px]">
            <p className="text-fgMuted font-mono text-sm">No hay datos de tendencia disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trends.map((t, i) => (
              <button
                key={i}
                onClick={() => loadTableHistory(t.table_name)}
                className={`flex items-center justify-between p-4 rounded border transition-colors text-left ${
                  selectedTable === t.table_name
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-surface border-border hover:bg-panel'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getTrendIcon(t.trend)}
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-fg truncate">{t.table_name}</p>
                    <p className="text-xs font-mono text-fgMuted">
                      Actual: {(t.current_frag)?.toFixed(1)}% · Anterior: {(t.previous_frag)?.toFixed(1)}% · Cambio: {(t.change)?.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded shrink-0 ml-2 ${getTrendBadge(t.trend)}`}>
                  {getTrendLabel(t.trend)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart Section */}
      {chartData && selectedTable && (
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider">
              Historial de Fragmentación — {selectedTable}
            </h3>
            <button
              onClick={() => { setSelectedTable(null); setChartData(null); }}
              className="text-xs font-mono text-fgMuted hover:text-fg transition-colors"
            >
              Cerrar
            </button>
          </div>
          <div className="h-72">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Scheduler Status */}
      <div className="panel p-6">
        <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock size={16} /> Estado del Programador
        </h3>
        {schedulerStatus ? (
          <div className="space-y-4">
              {schedulerStatus.jobs?.length > 0 ? (
              <div className="space-y-2">
                {schedulerStatus.jobs.map((job, i) => {
                  const labels = { 'smartfill_alert': 'Alertas', 'smartfill_analysis': 'Análisis', 'smartfill_maintenance': 'Mantenimiento' };
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface border border-border rounded">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0 bg-green-400 animate-pulse" />
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-fg truncate">{labels[job.id] || job.id}</p>
                          {job.interval_seconds && (
                            <p className="text-xs font-mono text-fgMuted truncate">
                              Cada {job.interval_seconds >= 86400 ? `${job.interval_seconds / 86400}d` : job.interval_seconds >= 3600 ? `${job.interval_seconds / 3600}h` : `${job.interval_seconds / 60}min`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-xs font-mono text-green-400 block">Programado</span>
                        {job.next_run && (
                          <span className="text-xs font-mono text-fgMuted/70">
                            Próxima: {new Date(job.next_run).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-fgMuted font-mono text-sm">No hay jobs programados.</p>
            )}
            {schedulerStatus.running !== undefined && (
              <div className="flex items-center gap-2 text-xs font-mono text-fgMuted pt-3 hairline-t">
                <span className={`w-2 h-2 rounded-full ${schedulerStatus.running ? 'bg-green-400' : 'bg-gray-500'}`} />
                Scheduler {schedulerStatus.running ? 'activo' : 'detenido'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[100px]">
            {loading ? (
              <p className="text-fgMuted font-mono text-sm">Cargando estado del programador...</p>
            ) : (
              <p className="text-fgMuted font-mono text-sm">No hay información del programador disponible.</p>
            )}
          </div>
        )}
      </div>

      {/* Automation Status */}
      {automationStatus && (
        <div className="panel p-6">
          <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Database size={16} /> Estado de la Automatización
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="block text-xs font-mono text-fgMuted mb-1">Análisis Automático</span>
              <span className={`text-sm font-mono ${automationStatus.analysis_interval ? 'text-green-400' : 'text-gray-400'}`}>
                {automationStatus.analysis_interval ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-mono text-fgMuted mb-1">Intervalo</span>
              <span className="text-sm font-mono text-fg">{automationStatus.analysis_interval || '-'} min</span>
            </div>
            <div>
              <span className="block text-xs font-mono text-fgMuted mb-1">Optimización Auto.</span>
              <span className={`text-sm font-mono ${automationStatus.auto_optimize ? 'text-green-400' : 'text-gray-400'}`}>
                {automationStatus.auto_optimize ? 'Activada' : 'Desactivada'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-mono text-fgMuted mb-1">Umbral de Alerta</span>
              <span className="text-sm font-mono text-fg">{automationStatus.alert_umbral || '-'}%</span>
            </div>
          </div>
        </div>
      )}

      {(loading || checking) && kpiData && (
        <div className="text-center py-4">
          <p className="text-fgMuted font-mono text-xs">Actualizando datos...</p>
        </div>
      )}
    </div>
  );
}
