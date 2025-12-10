import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SettlementRecord, Unit } from "../types";

export const generateSettlementPDF = (record: SettlementRecord, consortiumName: string, units: Unit[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // -- HEADER --
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(consortiumName, 14, 20);
  
  doc.setFontSize(14);
  doc.text("Liquidación de Expensas", 14, 30);
  
  doc.setFontSize(10);
  doc.text(`Período: ${record.month}`, pageWidth - 14, 20, { align: 'right' });
  doc.text(`Cierre: ${new Date(record.dateClosed).toLocaleDateString()}`, pageWidth - 14, 30, { align: 'right' });

  // -- SUMMARY SECTION --
  let finalY = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("Resumen Financiero", 14, 55);

  // LOGICA FONDO DE RESERVA
  const startBalance = record.reserveBalanceStart || 0;
  const contribution = record.reserveContribution || 0; // Se muestra como informativo
  const expense = record.reserveExpense || 0;
  const endBalance = record.reserveBalanceAtClose; // Debería ser startBalance - expense

  const summaryData = [
    ['Total Gastos del Mes', `$${record.totalExpenses.toFixed(2)}`],
    ['Total a Recaudar (Expensas)', `$${record.totalCollected.toFixed(2)}`],
    ['', ''], // Espacio
    ['FONDO DE RESERVA', ''],
    ['Saldo Inicial (Caja Anterior)', `$${startBalance.toFixed(2)}`],
    ['(-) Gastos cubiertos por Fondo', `-$${expense.toFixed(2)}`],
    ['(=) Saldo Final Disponible', `$${endBalance.toFixed(2)}`],
    ['', ''],
    ['(+) Aporte a Recaudar este mes', `$${contribution.toFixed(2)}`] // Informativo
  ];

  autoTable(doc, {
    startY: 60,
    head: [['Concepto', 'Monto']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: { 
        0: { cellWidth: 120 },
        1: { halign: 'right', fontStyle: 'bold' } 
    },
    // Resaltar la fila final del fondo
    didParseCell: function (data) {
        // Resaltar Saldo Final (Fila 6)
        if (data.row.index === 6) { 
            data.cell.styles.fillColor = [209, 250, 229]; // Verde claro
            data.cell.styles.textColor = [6, 95, 70]; // Verde oscuro
            data.cell.styles.fontStyle = 'bold';
        }
        // Título Fondo Reserva
        if (data.row.index === 3) {
             data.cell.styles.fontStyle = 'bold';
             data.cell.styles.textColor = [79, 70, 229];
        }
        // Aporte futuro en cursiva/gris
        if (data.row.index === 8) {
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.textColor = [100, 100, 100];
        }
    },
    margin: { left: 14 }
  });

  // -- EXPENSES TABLE --
  finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); // Reset color
  doc.text("Detalle de Gastos", 14, finalY);

  const expenseBody = record.snapshotExpenses.map(e => [
    e.date,
    e.description,
    e.itemCategory || '-',
    e.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario',
    `$${e.amount.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Fecha', 'Descripción', 'Rubro', 'Tipo', 'Monto']],
    body: expenseBody,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 
        4: { halign: 'right' } 
    },
    styles: { fontSize: 9 }
  });

  // -- UNIT BREAKDOWN TABLE --
  finalY = (doc as any).lastAutoTable.finalY + 15;
  
  if (finalY > doc.internal.pageSize.height - 40) {
      doc.addPage();
      finalY = 20;
  }

  doc.setFontSize(12);
  doc.text("Prorrateo por Unidad", 14, finalY);

  const unitsBody = record.unitDetails.map(detail => {
    const unit = units.find(u => u.id === detail.unitId);
    return [
        unit?.unitNumber || '?',
        unit?.ownerName || 'Desconocido',
        `${unit?.proratePercentage.toFixed(2)}%`,
        `$${detail.totalToPay.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: finalY + 5,
    head: [['UF', 'Propietario', '%', 'A Pagar']],
    body: unitsBody,
    theme: 'plain',
    headStyles: { fillColor: [229, 231, 235], textColor: 0 },
    columnStyles: { 
        3: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' }
    },
    styles: { fontSize: 9, cellPadding: 2 }
  });

  // -- FOOTER --
  const pageCount = (doc as any).internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - Generado por Gestión Consorcio`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }

  doc.save(`Liquidacion_${consortiumName.replace(/\s+/g, '_')}_${record.month}.pdf`);
};