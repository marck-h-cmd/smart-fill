import React from 'react';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PDFReportButton = ({ report }) => {
  const handleDownloadPDF = () => {
    if (!report) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = [14, 165, 233]; // #0ea5e9 (Tailwind sky-500)
    const textColor = [40, 40, 40];
    const secondaryColor = [100, 100, 100];

    // --- Header ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("SMARTFILL", 20, 20);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte Ejecutivo de Mantenimiento", 20, 28);
    
    // --- Meta Info ---
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    const dateStr = new Date(report.generated_at).toLocaleString();
    doc.text(`Fecha de Generación: ${dateStr}`, 20, 50);

    // --- Resumen de KPIs ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Resumen de Métricas (KPIs)", 20, 65);

    // Dibujar cajitas para KPIs
    const kpiY = 72;
    const boxWidth = 40;
    const marginX = 20;
    const gap = (pageWidth - (marginX * 2) - (boxWidth * 4)) / 3;

    const kpis = [
      { label: "TABLAS", value: report.summary.total_tables_analyzed.toString() },
      { label: "FRAG. PROM.", value: `${report.summary.average_fragmentation}%` },
      { label: "CRÍTICAS", value: report.summary.critical_tables.toString() },
      { label: "SALUDABLES", value: report.summary.healthy_tables.toString() }
    ];

    kpis.forEach((kpi, idx) => {
      const x = marginX + (boxWidth + gap) * idx;
      // Box
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, kpiY, boxWidth, 20, 2, 2, 'FD');
      
      // Value
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(kpi.value, x + (boxWidth / 2), kpiY + 10, { align: 'center' });
      
      // Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(kpi.label, x + (boxWidth / 2), kpiY + 16, { align: 'center' });
    });

    // --- Tabla Crítica ---
    let finalY = kpiY + 35;
    
    if (report.critical_tables && report.critical_tables.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Detalle de Tablas Críticas (Fragmentación >= 30%)", 20, finalY);
      
      const tableData = report.critical_tables.map(t => [
        t.nombre_tabla, 
        `${t.fragmentacion_porcentaje}%`,
        t.fragmentacion_porcentaje >= 80 ? 'CRÍTICO ALTO' : 'CRÍTICO'
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Nombre de Tabla', 'Fragmentación', 'Estado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 10 },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        margin: { left: 20, right: 20 }
      });
      finalY = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(12);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("¡Excelente! No se detectaron tablas con fragmentación crítica.", 20, finalY);
      finalY += 10;
    }

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Reporte Confidencial - Generado automáticamente por SmartFill`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // --- Save ---
    doc.save(`Reporte_SmartFill_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <button onClick={handleDownloadPDF} className="btn-accent py-3 px-6 text-sm font-mono flex items-center gap-2">
      <Download size={16} /> Descargar PDF
    </button>
  );
};

export default PDFReportButton;
