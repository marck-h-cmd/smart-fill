import React, { useState, useEffect } from 'react';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ConfigurationPage from './pages/ConfigurationPage';
import HistoryPage from './pages/HistoryPage';
import ReportsPage from './pages/ReportsPage';
import MaintenancePage from './pages/MaintenancePage';
import OpenWAPage from './pages/OpenWAPage';
import AIConfigPage from './pages/AIConfigPage';
import MonitoringView from './pages/Monitoring';
import IndexHealth from './pages/IndexHealth';
import ChatSimulator from './components/chat/ChatSimulator';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [configTab, setConfigTab] = useState('databases');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="h-screen overflow-hidden bg-surface text-fg font-sans flex flex-col transition-colors duration-300">
      <Navbar activeView={activeView} toggleTheme={toggleTheme} theme={theme} />

      <main className="flex-1 flex overflow-hidden">
        <div className="w-80 hairline-r bg-panel/50 flex flex-col transition-colors duration-300 overflow-y-auto">
          <Sidebar activeView={activeView} setActiveView={setActiveView} configTab={configTab} setConfigTab={setConfigTab} />
        </div>

        <div className="flex-1 overflow-y-auto bg-surface p-10 relative transition-colors duration-300">
          <div className="max-w-5xl mx-auto">
            {activeView === 'dashboard' && <DashboardPage />}
            {activeView === 'configuration' && (
              <ConfigurationPage configTab={configTab} setConfigTab={setConfigTab} />
            )}
            {activeView === 'history' && <HistoryPage />}
            {activeView === 'reports' && <ReportsPage />}
            {activeView === 'maintenance' && <MaintenancePage />}
            {activeView === 'monitoring' && <MonitoringView />}
            {activeView === 'index_health' && <IndexHealth />}
            {activeView === 'openwa' && <OpenWAPage />}
            {activeView === 'ai_config' && <AIConfigPage />}
            {activeView === 'chat_test' && (
              <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
                <h2 className="text-3xl font-light tracking-tight mb-2">Chat de Prueba Agentico</h2>
                <p className="text-fgMuted mb-4">Simula una conversación con tu IA sin necesidad de WhatsApp para probar las herramientas (ejecución SQL).</p>
                <ChatSimulator />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
