import React from 'react';

function getColor(pct) {
  if (pct >= 30) return 'bg-red-500/80';
  if (pct >= 10) return 'bg-yellow-500/80';
  return 'bg-green-500/80';
}

function getWidth(pct) {
  return Math.min(Math.max(pct, 2), 100);
}

export default function HeatMap({ data = [] }) {
  if (!data.length) {
    return (
      <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-fgMuted font-mono text-sm">No hay datos de fragmentación disponibles.</p>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4">Mapa de Calor - Fragmentación por Tabla</h3>
      <div className="space-y-2">
        {data.map((item, idx) => (
          <div key={`${item.table_name}-${idx}`} className="flex items-center gap-3">
            <span className="w-32 text-sm font-mono truncate text-fgMuted">{item.table_name}</span>
            <div className="flex-1 bg-border rounded-full h-5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getColor(item.fragmentation_percent)}`}
                style={{ width: `${getWidth(item.fragmentation_percent)}%` }}
              />
            </div>
            <span className={`text-sm font-mono w-16 text-right ${
              item.fragmentation_percent >= 30 ? 'text-red-400' :
              item.fragmentation_percent >= 10 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {item.fragmentation_percent}%
            </span>
            <span className="text-xs font-mono w-20 text-right text-fgMuted">{item.suggested_action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
