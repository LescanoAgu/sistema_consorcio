import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SettlementRecord, Unit } from "../types";

// --- FUNCIÓN 1: REPORTE GENERAL (Para el Grupo) ---
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
  const contribution = record.reserveContribution || 0; 
  const expense = record.reserveExpense || 0;
  const endBalance = record.reserveBalanceAtClose; 

  const summaryData = [
    ['Total Gastos del Mes', `$${record.totalExpenses.toFixed(2)}`],
    ['Total a Recaudar (Expensas)', `$${record.totalCollected.toFixed(2)}`],
    ['', ''], 
    ['FONDO DE RESERVA', ''],
    ['Saldo Inicial (Caja Anterior)', `$${startBalance.toFixed(2)}`],
    ['(-) Gastos cubiertos por Fondo', `-$${expense.toFixed(2)}`],
    ['(=) Saldo Final Disponible', `$${endBalance.toFixed(2)}`],
    ['', ''],
    ['(+) Aporte a Recaudar este mes', `$${contribution.toFixed(2)}`] 
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
    didParseCell: function (data) {
        if (data.row.index === 6) { 
            data.cell.styles.fillColor = [209, 250, 229];
            data.cell.styles.textColor = [6, 95, 70];
            data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 3) {
             data.cell.styles.fontStyle = 'bold';
             data.cell.styles.textColor = [79, 70, 229];
        }
    },
    margin: { left: 14 }
  });

  // -- EXPENSES TABLE --
  finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); 
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

  // Footer General
  const pageCount = (doc as any).internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - Generado por Gestión Consorcio`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }

  doc.save(`Liquidacion_${consortiumName.replace(/\s+/g, '_')}_${record.month}.pdf`);
};

// --- FUNCIÓN 2: CUPÓN INDIVIDUAL (Privado) ---
export const generateIndividualCouponPDF = (
    record: SettlementRecord, 
    unitId: string, 
    consortiumName: string, 
    units: Unit[]
) => {
    const doc = new jsPDF();
    const unit = units.find(u => u.id === unitId);
    
    // Si no encontramos la unidad o el detalle, salimos
    const detail = record.unitDetails.find(d => d.unitId === unitId);
    if (!unit || !detail) return;

    // Cálculos aproximados para mostrar desglose en el cupón
    const reserveShare = (record.reserveContribution || 0) * (unit.proratePercentage / 100);
    const expenseShare = detail.totalToPay - reserveShare;

    // 1. Encabezado Cupón
    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("CUPÓN DE PAGO", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(consortiumName, 105, 30, { align: "center" });

    // 2. Datos del Propietario
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Propietario: ${unit.ownerName}`, 20, 60);
    doc.text(`Unidad Funcional: ${unit.unitNumber}`, 20, 70);
    doc.text(`Período: ${record.month}`, 140, 60);
    
    // Fecha vto simulada (día 10 del mes siguiente)
    const vtoDate = new Date();
    vtoDate.setMonth(vtoDate.getMonth() + 1);
    doc.text(`Vencimiento: 10/${vtoDate.getMonth() + 1}/${vtoDate.getFullYear()}`, 140, 70);

    // 3. El Número Importante (TOTAL)
    doc.setFillColor(243, 244, 246); // Gris claro
    doc.roundedRect(20, 85, 170, 40, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text("TOTAL A PAGAR", 105, 98, { align: "center" });
    
    doc.setFontSize(30);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.setFont("helvetica", "bold");
    doc.text(`$${detail.totalToPay.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 105, 115, { align: "center" });
    doc.setFont("helvetica", "normal");

    // 4. Tabla de Conceptos
    autoTable(doc, {
        startY: 140,
        head: [['Concepto', 'Monto']],
        body: [
            ['Cuota Parte Expensas (Ordinarias + Extraord.)', `$${expenseShare.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`],
            ['Aporte Fondo de Reserva', `$${reserveShare.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`],
        ],
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    // 5. Datos Bancarios
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([2, 2], 0); 
    doc.rect(20, finalY, 170, 50); 
    doc.setLineDashPattern([], 0); 

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("DATOS PARA TRANSFERENCIA", 30, finalY + 10);
    
    doc.setFontSize(10);
    doc.text("Banco: Banco Nación", 30, finalY + 20);
    doc.text("Titular: Consorcio Propietarios Edificio Norte", 30, finalY + 28);
    
    doc.setFont("helvetica", "bold");
    doc.text("CBU: 0110599520000001234567", 30, finalY + 38);
    doc.text("Alias: EDIFICIO.NORTE.PAGO", 30, finalY + 46);

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Por favor envíe el comprobante por WhatsApp o Email al realizar el pago.", 105, 280, { align: "center" });

    doc.save(`Cupon_${unit.unitNumber}_${record.month}.pdf`);
};