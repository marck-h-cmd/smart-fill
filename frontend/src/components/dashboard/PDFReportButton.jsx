import React from 'react';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PDFReportButton = ({ report }) => {
  const handleDownloadPDF = () => {
    if (!report) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Brand Colors
    const primaryColor = [14, 165, 233]; // #0ea5e9 (Sky blue)
    const dangerColor = [239, 68, 68];   // Red
    const warningColor = [234, 179, 8];   // Yellow
    const successColor = [34, 197, 94];   // Green
    const textColor = [30, 41, 59];      // Slate 800
    const mutedColor = [100, 116, 139];   // Slate 500

    // --- Header ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("SMARTFILL", 20, 18);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte Ejecutivo de Salud y Mantenimiento de BD", 20, 27);
    
    doc.setFontSize(9);
    const dateStr = new Date(report.generated_at).toLocaleString();
    doc.text(`Generado: ${dateStr}`, 20, 35);

    // --- Resumen KPI Boxes ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("1. Resumen Ejecutivo (KPIs)", 20, 54);

    const kpiY = 60;
    const boxWidth = 38;
    const marginX = 20;
    const gap = (pageWidth - (marginX * 2) - (boxWidth * 4)) / 3;

    const kpis = [
      { label: "TABLAS ANALIZADAS", value: report.summary.total_tables_analyzed.toString(), color: textColor },
      { label: "FRAG. PROMEDIO", value: `${report.summary.average_fragmentation}%`, color: report.summary.average_fragmentation >= 30 ? dangerColor : primaryColor },
      { label: "TABLAS CRÍTICAS", value: report.summary.critical_tables.toString(), color: report.summary.critical_tables > 0 ? dangerColor : successColor },
      { label: "SALUDABLES", value: report.summary.healthy_tables.toString(), color: successColor }
    ];

    kpis.forEach((kpi, idx) => {
      const x = marginX + (boxWidth + gap) * idx;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, kpiY, boxWidth, 22, 3, 3, 'FD');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.value, x + (boxWidth / 2), kpiY + 11, { align: 'center' });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text(kpi.label, x + (boxWidth / 2), kpiY + 17, { align: 'center' });
    });

    // --- Visual Distribution Chart (Bar Graph) ---
    let currentY = kpiY + 30;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("2. Gráfico de Salud Global de la Base de Datos", 20, currentY);

    currentY += 8;
    const totalTables = Math.max(report.summary.total_tables_analyzed, 1);
    const healthyPct = Math.round((report.summary.healthy_tables / totalTables) * 100);
    const criticalPct = Math.round((report.summary.critical_tables / totalTables) * 100);
    const moderatePct = Math.max(0, 100 - healthyPct - criticalPct);

    const chartBarWidth = pageWidth - 40;
    const barHeight = 12;

    // Background Container
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, currentY, chartBarWidth, barHeight, 2, 2, 'F');

    // Draw proportional colored bars
    let xOffset = 20;
    if (healthyPct > 0) {
      const w = (chartBarWidth * healthyPct) / 100;
      doc.setFillColor(successColor[0], successColor[1], successColor[2]);
      doc.rect(xOffset, currentY, w, barHeight, 'F');
      xOffset += w;
    }
    if (moderatePct > 0) {
      const w = (chartBarWidth * moderatePct) / 100;
      doc.setFillColor(warningColor[0], warningColor[1], warningColor[2]);
      doc.rect(xOffset, currentY, w, barHeight, 'F');
      xOffset += w;
    }
    if (criticalPct > 0) {
      const w = (chartBarWidth * criticalPct) / 100;
      doc.setFillColor(dangerColor[0], dangerColor[1], dangerColor[2]);
      doc.rect(xOffset, currentY, w, barHeight, 'F');
    }

    // Legend below chart
    currentY += barHeight + 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    // Healthy Legend
    doc.setFillColor(successColor[0], successColor[1], successColor[2]);
    doc.circle(23, currentY - 1, 2, 'F');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Saludables (<10%): ${report.summary.healthy_tables} (${healthyPct}%)`, 27, currentY);

    // Moderate Legend
    doc.setFillColor(warningColor[0], warningColor[1], warningColor[2]);
    doc.circle(85, currentY - 1, 2, 'F');
    doc.text(`Moderadas (10-30%): ${report.summary.total_tables_analyzed - report.summary.healthy_tables - report.summary.critical_tables} (${moderatePct}%)`, 89, currentY);

    // Critical Legend
    doc.setFillColor(dangerColor[0], dangerColor[1], dangerColor[2]);
    doc.circle(150, currentY - 1, 2, 'F');
    doc.text(`Críticas (≥30%): ${report.summary.critical_tables} (${criticalPct}%)`, 154, currentY);

    // --- Table & Details ---
    currentY += 12;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("3. Diagnóstico de Tablas Críticas", 20, currentY);

    currentY += 5;

    if (report.critical_tables && report.critical_tables.length > 0) {
      const tableData = report.critical_tables.map(t => [
        t.nombre_tabla,
        `${t.fragmentacion_porcentaje}%`,
        t.fragmentacion_porcentaje >= 80 ? 'REBUILD (Urgente)' : t.fragmentacion_porcentaje >= 30 ? 'REBUILD' : 'REORGANIZE',
        `ALTER INDEX ALL ON [${t.nombre_tabla}] REBUILD;`
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Tabla', 'Fragmentación', 'Acción Sugerida', 'Comando de Mantenimiento']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { halign: 'right', cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { font: 'courier', fontSize: 7, cellWidth: 'auto' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 1) {
            const val = parseFloat(data.cell.raw);
            if (val >= 80) {
              data.cell.styles.textColor = dangerColor;
              data.cell.styles.fontStyle = 'bold';
            } else if (val >= 30) {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        },
        margin: { left: 20, right: 20 }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(successColor[0], successColor[1], successColor[2]);
      doc.text("✔ No se detectaron tablas con fragmentación crítica en la última revisión.", 20, currentY + 5);
      currentY += 15;
    }

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `SmartFill DB Optimizer — Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save File
    doc.save(`Reporte_Ejecutivo_SmartFill_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <button onClick={handleDownloadPDF} className="btn-accent py-3 px-6 text-sm font-mono flex items-center gap-2">
      <Download size={16} /> Descargar PDF Reporte
    </button>
  );
};

export default PDFReportButton;
