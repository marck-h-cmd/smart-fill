import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Clock } from 'lucide-react';

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
