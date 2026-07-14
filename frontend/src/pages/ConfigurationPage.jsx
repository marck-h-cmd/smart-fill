import React from 'react';
import { Database, Smartphone } from 'lucide-react';
import DatabaseConfig from '../components/configuration/DatabaseConfig';
import WhatsAppSessionManager from '../components/whatsapp/WhatsAppSessionManager';

function ConfigurationPage({ configTab, setConfigTab }) {
  const tabs = [
    { id: 'databases', label: 'Bases de Datos', icon: Database },
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-light tracking-tight mb-2">Configuración</h2>
      <p className="text-fgMuted">Gestiona conexiones a SQL Server y sesiones de WhatsApp.</p>

      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setConfigTab(t.id)}
            className={`px-4 py-3 text-sm font-mono flex items-center gap-2 border-b-2 transition-colors ${
              configTab === t.id ? 'border-accent text-accent' : 'border-transparent text-fgMuted hover:text-fg'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {configTab === 'databases' && <DatabaseConfig />}
        {configTab === 'whatsapp' && <WhatsAppSessionManager />}
      </div>
    </div>
  );
}

export default ConfigurationPage;
