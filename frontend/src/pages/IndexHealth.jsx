import React, { useState, useEffect } from 'react';
import { databases, monitoring } from '../services/apiClient';
import { Activity, AlertTriangle, RefreshCw, CheckCircle, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export default function IndexHealth() {
  const [activeDb, setActiveDb] = useState(null);
  const [unusedIndexes, setUnusedIndexes] = useState([]);
  const [missingIndexes, setMissingIndexes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadActiveDatabase();
  }, []);

  const loadActiveDatabase = async () => {
    try {
      const db = await databases.getActive();
      setActiveDb(db);
      if (db) {
        fetchHealthData(db.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHealthData = async (dbId) => {
    setLoading(true);
    setError('');
    try {
      const [unusedRes, missingRes] = await Promise.all([
        monitoring.unusedIndexes(dbId),
        monitoring.missingIndexes(dbId)
      ]);
      setUnusedIndexes(unusedRes.indexes || []);
      setMissingIndexes(missingRes.indexes || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  if (!activeDb) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Database className="w-16 h-16 text-fgMuted mb-4" />
        <h2 className="text-2xl font-bold text-fg">No hay base de datos activa</h2>
        <p className="text-fgMuted mt-2">Selecciona una base de datos en el Dashboard para ver el estado de los índices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-fg flex items-center gap-2">
            <Activity className="w-8 h-8 text-accent" />
            Salud de Índices
          </h1>
          <p className="text-fgMuted mt-1">
            Detecta índices inútiles que ralentizan escrituras y descubre índices faltantes recomendados.
          </p>
        </div>
        <button
          onClick={() => fetchHealthData(activeDb.id)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-panel hover:bg-surface text-fg rounded-lg transition-colors border border-border"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Unused Indexes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-6 rounded-2xl shadow-sm"
        >
          <h2 className="text-xl font-bold text-fg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Índices Inútiles ({unusedIndexes.length})
          </h2>
          <p className="text-fgMuted text-sm mb-4">
            Índices que no han sido utilizados para búsquedas, pero consumen recursos durante las operaciones de escritura (INSERT/UPDATE/DELETE).
          </p>
          
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-border/50 rounded-lg" />)}
            </div>
          ) : unusedIndexes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-fgMuted border border-dashed border-border rounded-xl bg-surface/30">
              <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
              <p>No se encontraron índices inútiles.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {unusedIndexes.map((idx, i) => (
                <div key={i} className="bg-surface/50 p-4 rounded-xl border border-border hover:border-accent transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-semibold px-2 py-1 bg-panel text-fgMuted rounded-full border border-border">
                        {idx.table_name}
                      </span>
                      <h3 className="text-fg font-medium mt-2">{idx.index_name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-fgMuted">Escrituras</div>
                      <div className="text-lg font-bold text-yellow-500">{idx.writes.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="mt-3 bg-panel p-3 rounded-lg overflow-x-auto border border-border">
                    <pre className="text-xs text-fg font-mono">{idx.drop_script}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Missing Indexes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="panel p-6 rounded-2xl shadow-sm"
        >
          <h2 className="text-xl font-bold text-fg mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Índices Faltantes ({missingIndexes.length})
          </h2>
          <p className="text-fgMuted text-sm mb-4">
            Recomendaciones automáticas de SQL Server basadas en consultas que se han ejecutado recientemente.
          </p>

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-border/50 rounded-lg" />)}
            </div>
          ) : missingIndexes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-fgMuted border border-dashed border-border rounded-xl bg-surface/30">
              <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
              <p>No se encontraron recomendaciones de índices faltantes.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {missingIndexes.map((idx, i) => (
                <div key={i} className="bg-surface/50 p-4 rounded-xl border border-border hover:border-accent transition-colors">
                  <div className="flex justify-between items-start mb-3 border-b border-border pb-3">
                    <div>
                      <span className="text-xs font-semibold px-2 py-1 bg-panel text-fgMuted rounded-full border border-border">
                        {idx.table_name}
                      </span>
                    </div>
                    <div className="text-right flex gap-4">
                      <div>
                        <div className="text-xs text-fgMuted">Impacto</div>
                        <div className="text-sm font-bold text-accent">{Math.round(idx.avg_user_impact)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-fgMuted">Búsquedas</div>
                        <div className="text-sm font-bold text-blue-500">{idx.user_seeks + idx.user_scans}</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-panel p-3 rounded-lg overflow-x-auto border border-border">
                    <pre className="text-xs text-accent whitespace-pre-wrap font-mono">{idx.create_script}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
