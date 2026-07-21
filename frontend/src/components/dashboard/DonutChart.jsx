import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function DonutChart({ title, data = [], labels = [], colors = [], emptyMessage = "No hay datos disponibles" }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length || data.every(v => v === 0)) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { 
            position: 'bottom',
            labels: {
              color: '#9ca3af',
              font: { size: 12, family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
              padding: 20,
              usePointStyle: true,
            }
          },
        },
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [data, labels, colors]);

  if (!data.length || data.every(v => v === 0)) {
    return (
      <div className="panel p-6 flex flex-col items-center justify-center min-h-[300px]">
        <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4 w-full text-left">{title}</h3>
        <p className="text-fgMuted font-mono text-sm m-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="panel p-6 flex flex-col min-h-[300px]">
      <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4 w-full">{title}</h3>
      <div className="flex-1 relative min-h-[220px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
