import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Zap, Database } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ChatSimulator() {
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hola, soy tu Agente SmartFill 🤖\n\nPuedo consultar la base de datos directamente. Prueba preguntarme:\n• "¿Qué tablas existen?"\n• "Dame la primera fila de Ventas"\n• "¿Cuántos registros tiene la tabla X?"' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolIndicator, setToolIndicator] = useState('');
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isStreaming) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);
    setToolIndicator('');

    // Agregar mensaje de IA vacío que iremos llenando con el stream
    setMessages(prev => [...prev, { role: 'ai', content: '', streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_URL}/whatsapp/chat-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMsg }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'error', content: err.error || 'Error del servidor' }
        ]);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsStreaming(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // El último puede estar incompleto

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6); // Remove "data: "

          if (data === '__END__') {
            setIsStreaming(false);
            setToolIndicator('');
            // Marcar como terminado
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, streaming: false } : m
            ));
            break;
          }

          if (data.startsWith('__TOOL__:')) {
            setToolIndicator(data.replace('__TOOL__:', '').trim());
            continue;
          }

          // Decodificar \n escapados
          const chunk = data.replace(/\\n/g, '\n');
          accumulatedContent += chunk;

          // Actualizar el último mensaje con el contenido acumulado
          setMessages(prev => prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: accumulatedContent } : m
          ));
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'error', content: err.message }
        ]);
      }
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[650px] border border-border bg-surface rounded-xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="bg-accent/10 border-b border-accent/20 p-4 flex items-center gap-3">
        <div className="relative">
          <Bot className="text-accent" size={26} />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${isStreaming ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        </div>
        <div>
          <h3 className="font-mono font-bold text-accent">SmartFill Agente IA</h3>
          <p className="text-xs text-fgMuted flex items-center gap-1">
            <Database size={10} />
            Conectado a SQL Server · Chat de prueba
          </p>
        </div>
        {isStreaming && (
          <span className="ml-auto text-xs font-mono text-yellow-400 animate-pulse flex items-center gap-1">
            <Zap size={12} /> Generando...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/30">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-1">
                <Bot size={14} className="text-accent" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent text-white rounded-br-sm'
                : msg.role === 'error'
                ? 'bg-red-500/15 text-red-300 border border-red-500/30 rounded-bl-sm'
                : 'bg-surface border border-border text-fg rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.streaming && msg.content === '' && (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                </span>
              )}
              {msg.streaming && msg.content !== '' && (
                <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-1">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-accent" />
            </div>
            <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="text-accent animate-spin" />
              <span className="text-sm font-mono text-fgMuted">Pensando...</span>
            </div>
          </div>
        )}

        {toolIndicator && (
          <div className="flex justify-center">
            <span className="text-xs font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1 rounded-full flex items-center gap-1">
              <Zap size={10} /> {toolIndicator}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border bg-surface flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          placeholder="Escribe tu consulta... (Enter para enviar, Shift+Enter para salto de línea)"
          className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-accent transition-colors resize-none min-h-[42px] max-h-[120px]"
          disabled={isLoading || isStreaming}
          rows={1}
        />
        <button
          type="submit"
          disabled={isLoading || isStreaming || !input.trim()}
          className="bg-accent hover:bg-accent/90 text-white p-2.5 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
