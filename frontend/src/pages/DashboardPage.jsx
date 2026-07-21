import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Activity, Database, Server, HardDrive, Cpu } from 'lucide-react';
import KPICard from '../components/dashboard/KPICard';
import HeatMap from '../components/dashboard/HeatMap';
import TrendChart from '../components/dashboard/TrendChart';
import DonutChart from '../components/dashboard/DonutChart';
import PDFReportButton from '../components/dashboard/PDFReportButton';

function DashboardPage() {
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

  const { actionsData, rowData } = useMemo(() => {
    let rebuild = 0, reorganize = 0, ok = 0;
    let totalRows = 0;
    fragData.forEach(d => {
      if (d.suggested_action === 'REBUILD') rebuild++;
      else if (d.suggested_action === 'REORGANIZE') reorganize++;
      else ok++;
      totalRows += d.total_rows || 0;
    });
    return {
      actionsData: [rebuild, reorganize, ok],
      rowData: totalRows
    };
  }, [fragData]);

  const formatNumber = (num) => new Intl.NumberFormat('es-MX').format(num);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-light tracking-tight mb-2 text-fg flex items-center gap-2">
            <Activity className="text-accent" /> Dashboard de Salud
          </h2>
          <p className="text-fgMuted flex items-center gap-2">
            {activeDb ? (
              <>
                <Database size={16} /> 
                <span>{activeDb.name} <span className="opacity-50">({activeDb.host} / {activeDb.database})</span></span>
              </>
            ) : 'Sin BD activa. Configura una en la sección de Configuración.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeDb && <PDFReportButton dbStats={dbStats} fragData={fragData} activeDb={activeDb} />}
          <button onClick={loadData} className="btn-accent py-2 px-4 text-sm font-mono flex items-center gap-2">
            <Activity size={16} /> Actualizar
          </button>
        </div>
      </div>

      {loading && !dbStats && <p className="text-fgMuted font-mono text-sm">Cargando métricas de la base de datos...</p>}

      {!activeDb && !loading && (
        <div className="panel p-12 flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
          <Server size={64} className="text-border mb-6" strokeWidth={1} />
          <h3 className="text-xl font-medium text-fg mb-2">No hay conexión activa</h3>
          <p className="text-fgMuted font-mono text-sm max-w-md text-center">Dirígete a la sección de Configuración para conectar y activar una base de datos SQL Server y comenzar el monitoreo de índices.</p>
        </div>
      )}

      {dbStats && (
        <>
          {/* Main KPIs Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="panel p-0 overflow-hidden"><KPICard title="TOTAL ÍNDICES" value={formatNumber(dbStats.total_indexes || 0)} sub="Monitoreados" /></div>
            <div className="panel p-0 overflow-hidden"><KPICard title="PROM. FRAGMENTACIÓN" value={`${dbStats.avg_fragmentation || 0}%`} sub="General" /></div>
            <div className="panel p-0 overflow-hidden"><KPICard title="TOTAL FILAS" value={formatNumber(rowData)} sub="Registros indexados" /></div>
            <div className="panel p-0 overflow-hidden"><KPICard title="SALUDABLES" value={formatNumber(dbStats.healthy_count || 0)} sub="<10% fragmentación" /></div>
          </div>

          {/* Sub KPIs Row 2 (Critical & Moderate Context) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="panel p-6 border-l-4 border-l-red-500 bg-red-500/5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-1">Índices Críticos</h3>
                    <p className="text-3xl font-light text-red-500">{formatNumber(dbStats.critical_count || 0)}</p>
                    <p className="text-xs text-fgMuted mt-1">≥30% de fragmentación (Requiere REBUILD)</p>
                  </div>
                  <HardDrive size={40} className="text-red-500/20" />
                </div>
             </div>
             <div className="panel p-6 border-l-4 border-l-yellow-500 bg-yellow-500/5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-1">Índices Moderados</h3>
                    <p className="text-3xl font-light text-yellow-500">{formatNumber(dbStats.moderate_count || 0)}</p>
                    <p className="text-xs text-fgMuted mt-1">10% - 30% fragmentación (Requiere REORGANIZE)</p>
                  </div>
                  <Cpu size={40} className="text-yellow-500/20" />
                </div>
             </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DonutChart 
              title="Estado de Salud de Índices" 
              data={[dbStats.healthy_count || 0, dbStats.moderate_count || 0, dbStats.critical_count || 0]} 
              labels={['Saludables (<10%)', 'Moderados (10-30%)', 'Críticos (≥30%)']}
              colors={['rgba(34, 197, 94, 0.8)', 'rgba(234, 179, 8, 0.8)', 'rgba(239, 68, 68, 0.8)']}
              emptyMessage="Sin métricas de salud."
            />
            
            <DonutChart 
              title="Acciones Sugeridas" 
              data={actionsData} 
              labels={['REBUILD (Reconstruir)', 'REORGANIZE (Reorganizar)', 'OK (Sin Acción)']}
              colors={['rgba(239, 68, 68, 0.8)', 'rgba(234, 179, 8, 0.8)', 'rgba(34, 197, 94, 0.8)']}
              emptyMessage="Sin acciones sugeridas."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="lg:col-span-1">
               <HeatMap data={fragData} />
             </div>
             <div className="lg:col-span-1">
               <TrendChart data={fragData.slice(0, 15)} tableName="Top 15 Fragmentadas" />
             </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
