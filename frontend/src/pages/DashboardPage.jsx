import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Activity, Database, Wrench, CheckCircle2, AlertCircle } from 'lucide-react';
import KPICard from '../components/dashboard/KPICard';
import HeatMap from '../components/dashboard/HeatMap';
import TrendChart from '../components/dashboard/TrendChart';

function DashboardPage() {
  const [dbStats, setDbStats] = useState(null);
  const [fragData, setFragData] = useState([]);
  const [activeDb, setActiveDb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState(null);

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

  const handleRunOptimize = async () => {
    setOptimizing(true);
    setOptResult(null);
    try {
      const res = await axios.post('http://localhost:5000/api/maintenance', { action: 'optimize' });
      setOptResult({ 
        type: 'success', 
        msg: res.data.message || res.data.data?.message || 'Optimización completada con éxito.' 
      });
      loadData();
    } catch (err) {
      setOptResult({ type: 'error', msg: err.response?.data?.message || err.message });
    }
    setOptimizing(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2">Dashboard de Fragmentación</h2>
          <p className="text-fgMuted">
            {activeDb ? `BD Activa: ${activeDb.name} (${activeDb.host}/${activeDb.database})` : 'Sin BD activa. Configura una en Configuración.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRunOptimize} 
            disabled={optimizing || !activeDb}
            className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 text-sm font-mono flex items-center gap-2 rounded transition-colors disabled:opacity-50"
          >
            <Wrench size={16} className={optimizing ? 'animate-spin' : ''} />
            {optimizing ? 'Optimizando...' : '⚡ Optimizar Ahora (Prueba)'}
          </button>
          <button onClick={loadData} className="btn-accent py-2 px-4 text-sm font-mono flex items-center gap-2">
            <Activity size={16} /> Actualizar
          </button>
        </div>
      </div>

      {optResult && (
        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-mono ${
          optResult.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {optResult.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{optResult.msg}</span>
        </div>
      )}

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

export default DashboardPage;
