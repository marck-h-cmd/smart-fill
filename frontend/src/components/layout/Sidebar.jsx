import React from 'react';
import { BarChart3, Database, Clock, FileText, Wrench, Activity, MessageSquare, Cpu } from 'lucide-react';

function Sidebar({ activeView, setActiveView, configTab, setConfigTab }) {
  const items = [
    { view: 'dashboard', label: 'Dashboard Principal', icon: BarChart3 },
    { view: 'configuration', label: 'Configuración', icon: Database },
    { view: 'history', label: 'Historial', icon: Clock },
    { view: 'reports', label: 'Reportes', icon: FileText },
    { view: 'maintenance', label: 'Mantenimiento', icon: Wrench },
    { view: 'monitoring', label: 'Monitoreo', icon: Activity },
    { view: 'index_health', label: 'Salud de Índices', icon: Activity },
    { view: 'openwa', label: 'Puente OpenWA', icon: MessageSquare },
    { view: 'ai_config', label: 'Configuración IA', icon: Cpu },
    { view: 'chat_test', label: 'Chat de Prueba', icon: MessageSquare },
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

export default Sidebar;
