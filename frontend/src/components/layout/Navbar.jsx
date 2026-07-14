import React from 'react';
import { Sun, Moon } from 'lucide-react';

function Navbar({ activeView, toggleTheme, theme }) {
  return (
    <header className="shrink-0 h-14 hairline-b flex items-center justify-between px-6 bg-surface z-10 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
        <h1 className="font-medium tracking-wide">SmartFill</h1>
        <span className="text-fgMuted text-sm font-mono flex items-center gap-2">
          <span>/</span>
          <span className="uppercase tracking-widest text-accent">{activeView.replace('_', ' ')}</span>
        </span>
      </div>
      <div className="flex items-center gap-4 h-full">
        {/* Aquí irá el botón de perfil o notificaciones en el futuro */}
        <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-border/50 text-fgMuted hover:text-fg transition-colors" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

export default Navbar;
