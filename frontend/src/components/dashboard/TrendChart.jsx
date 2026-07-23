import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function TrendChart({ data = [], tableName = '' }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.index_name || d.table_name),
        datasets: [{
          label: 'Fragmentación (%)',
          data: data.map(d => d.fragmentation_percent),
          backgroundColor: data.map(d =>
            d.fragmentation_percent >= 30 ? 'rgba(239, 68, 68, 0.7)' :
            d.fragmentation_percent >= 10 ? 'rgba(234, 179, 8, 0.7)' :
            'rgba(34, 197, 94, 0.7)'
          ),
          borderColor: data.map(d =>
            d.fragmentation_percent >= 30 ? 'rgb(239, 68, 68)' :
            d.fragmentation_percent >= 10 ? 'rgb(234, 179, 8)' :
            'rgb(34, 197, 94)'
          ),
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const item = data[context[0].dataIndex];
                return `Índice: ${item.index_name || item.table_name}`;
              },
              afterTitle: (context) => {
                const item = data[context[0].dataIndex];
                return `Tabla: ${item.table_name} ${item.index_type ? '(' + item.index_type.replace('_INDEX', '') + ')' : ''}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: '#9ca3af', font: { size: 11 } },
            grid: { color: 'rgba(75, 85, 99, 0.3)' },
          },
          x: {
            ticks: { 
              color: '#9ca3af', 
              font: { size: 11 },
              callback: function(val, index) {
                const label = this.getLabelForValue(val);
                return label.length > 15 ? label.substr(0, 15) + '...' : label;
              }
            },
            grid: { display: false },
          },
        },
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [data]);

  if (!data.length) {
    return (
      <div className="panel p-8 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-fgMuted font-mono text-sm">No hay datos de tendencia disponibles.</p>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <h3 className="text-sm font-mono text-fgMuted uppercase tracking-wider mb-4">
        Fragmentación {tableName && `- ${tableName}`}
      </h3>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
