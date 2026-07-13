import React, { useState } from 'react';
import axios from 'axios';
import { FileText } from 'lucide-react';
import KPICard from '../components/dashboard/KPICard';

function ReportsPage() {
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

export default ReportsPage;
