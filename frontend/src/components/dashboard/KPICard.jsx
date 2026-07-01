import React from 'react';

export default function KPICard({ title, value, sub, accent = true }) {
  return (
    <div className="bg-panel p-6 flex flex-col justify-between transition-colors duration-300">
      <span className="text-xs font-mono text-fgMuted tracking-wider uppercase">{title}</span>
      <div className="mt-4 mb-1">
        <span className={`text-4xl font-light font-mono ${accent ? 'text-accent' : ''}`}>{value}</span>
      </div>
      <span className="text-xs text-fgMuted">{sub}</span>
    </div>
  );
}
