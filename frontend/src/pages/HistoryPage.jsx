import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Clock, BarChart2, TrendingUp } from 'lucide-react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

function HistoryChart({ records, selectedTable }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !records.length) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    const sortedRecords = [...records].reverse();

    const labels = sortedRecords.map(r => 
      selectedTable 
        ? new Date(r.ultima_actualizacion).toLocaleDateString() + ' ' + new Date(r.ultima_actualizacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : r.nombre_tabla
    );

    const values = sortedRecords.map(r => r.fragmentacion_porcentaje);

    chartRef.current = new Chart(ctx, {
      type: selectedTable ? 'line' : 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Fragmentación (%)',
          data: values,
          borderColor: '#0ea5e9',
          backgroundColor: selectedTable 
            ? 'rgba(14, 165, 233, 0.2)' 
            : values.map(v => v >= 30 ? 'rgba(239, 68, 68, 0.7)' : v >= 10 ? 'rgba(234, 179, 8, 0.7)' : 'rgba(34, 197, 94, 0.7)'),
          borderWidth: 2,
          fill: !!selectedTable,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#0ea5e9'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Fragmentación: ${context.raw}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: '#888888', font: { size: 11 } },
            grid: { color: 'rgba(150, 150, 150, 0.15)' }
          },
          x: {
            ticks: { color: '#888888', font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [records, selectedTable]);

  if (!records.length) return null;

  return (
    <div className="panel p-6 rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-4 text-fg">
        {selectedTable ? <TrendingUp size={20} className="text-accent" /> : <BarChart2 size={20} className="text-accent" />}
        <h3 className="text-base font-mono uppercase tracking-wider text-fgMuted">
          {selectedTable ? `Evolución Histórica - ${selectedTable}` : 'Gráfico de Fragmentación Actual'}
        </h3>
      </div>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function HistoryPage() {
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

      {!loading && records.length > 0 && (
        <HistoryChart records={records} selectedTable={selectedTable} />
      )}

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

export default HistoryPage;
