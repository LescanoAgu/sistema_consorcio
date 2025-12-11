import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SettlementRecord, Unit, ExpenseDistributionType, ConsortiumSettings } from "../types";

// Helper para formatear moneda (Argentina: puntos para miles, coma para decimales)
const formatMoney = (amount: number) => {
  return amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// --- FUNCIÓN 1: REPORTE GENERAL (Público / Global) ---
export const generateSettlementPDF = (record: SettlementRecord, consortiumName: string, units: Unit[], settings?: ConsortiumSettings) => {
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

  // -- SUMMARY SECTION (Resumen Financiero) --
  let finalY = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("Resumen Financiero", 14, 55);

  // CÁLCULOS
  const startBalance = record.reserveBalanceStart || 0;
  const contribution = record.reserveContribution || 0; 
  const expense = record.reserveExpense || 0;
  const endBalance = record.reserveBalanceAtClose; 
  const deficit = record.reserveDeficitCovered || 0;

  // Desglose de Gastos
  const totalOrd = record.snapshotExpenses
      .filter(e => e.category === 'Ordinary')
      .reduce((a, b) => a + b.amount, 0);
  const totalExtra = record.snapshotExpenses
      .filter(e => e.category === 'Extraordinary')
      .reduce((a, b) => a + b.amount, 0);

  const summaryData = [
    ['Total Gastos del Mes', `$${formatMoney(record.totalExpenses)}`],
    ['     > Ordinarias', `$${formatMoney(totalOrd)}`],
    ['     > Extraordinarias', `$${formatMoney(totalExtra)}`],
    ['Total a Recaudar (Expensas)', `$${formatMoney(record.totalCollected)}`],
    ['', ''], 
    ['FONDO DE RESERVA', ''],
    ['Saldo Inicial (Caja Anterior)', `$${formatMoney(startBalance)}`],
    ['(-) Gastos pagados con Fondo', `-$${formatMoney(expense)}`],
    deficit > 0 ? ['(+) Recupero Saldo Negativo', `+$${formatMoney(deficit)}`] : null,
    ['(=) Saldo Final Disponible', `$${formatMoney(endBalance)}`],
    ['', ''],
    ['(+) Aporte a Recaudar este mes', `$${formatMoney(contribution)}`] 
  ].filter(row => row !== null);

  autoTable(doc, {
    startY: 60,
    head: [['Concepto', 'Monto']],
    body: summaryData as any,
    theme: 'striped',
    headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
    styles: { fontSize: 10, halign: 'right' },
    columnStyles: { 
        0: { cellWidth: 120, halign: 'left' },
        1: { fontStyle: 'bold' } 
    },
    didParseCell: function (data) {
        // Estilos para filas específicas
        if (data.row.raw[0] === 'Total Gastos del Mes' || data.row.raw[0] === 'Total a Recaudar (Expensas)') {
             data.cell.styles.fontStyle = 'bold';
        }
        if (typeof data.row.raw[0] === 'string' && data.row.raw[0].includes('>')) {
             data.cell.styles.fontStyle = 'italic';
             data.cell.styles.textColor = [100, 100, 100];
        }
        if (data.row.raw[0] === '(=) Saldo Final Disponible') { 
            data.cell.styles.fillColor = [209, 250, 229];
            data.cell.styles.textColor = [6, 95, 70];
            data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 5) { // Header Fondo
             data.cell.styles.fontStyle = 'bold';
             data.cell.styles.textColor = [79, 70, 229];
             data.cell.styles.halign = 'left';
        }
    },
    margin: { left: 14 }
  });

  // -- EXPENSES TABLES (Detalle de Gastos Dividido) --
  finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); 
  doc.text("Detalle de Gastos", 14, finalY);

  // 1. GASTOS ORDINARIOS
  const ordExpenses = record.snapshotExpenses.filter(e => e.category === 'Ordinary');
  
  if (ordExpenses.length > 0) {
      finalY += 7;
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229); // Indigo
      doc.text("Gastos Ordinarios", 14, finalY);
      
      const ordBody = ordExpenses.map(e => [
        e.date,
        e.description,
        e.itemCategory || '-',
        e.distributionType === ExpenseDistributionType.FROM_RESERVE ? `($${formatMoney(e.amount)})` : `$${formatMoney(e.amount)}`
      ]);

      autoTable(doc, {
        startY: finalY + 2,
        head: [['Fecha', 'Descripción', 'Rubro', 'Monto']],
        body: ordBody,
        theme: 'grid',
        headStyles: { fillColor: [224, 231, 255], textColor: [55, 65, 81] }, // Azul muy claro
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        styles: { fontSize: 9 }
      });
      
      finalY = (doc as any).lastAutoTable.finalY + 10;
  }

  // 2. GASTOS EXTRAORDINARIOS
  const extraExpenses = record.snapshotExpenses.filter(e => e.category === 'Extraordinary');
  
  if (extraExpenses.length > 0) {
      // Verificar espacio en hoja
      if (finalY > doc.internal.pageSize.height - 40) { doc.addPage(); finalY = 20; }

      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38); // Rojo
      doc.text("Gastos Extraordinarios", 14, finalY);
      
      const extraBody = extraExpenses.map(e => [
        e.date,
        e.description,
        e.itemCategory || '-',
        e.distributionType === ExpenseDistributionType.FROM_RESERVE ? `($${formatMoney(e.amount)})` : `$${formatMoney(e.amount)}`
      ]);

      autoTable(doc, {
        startY: finalY + 2,
        head: [['Fecha', 'Descripción', 'Rubro', 'Monto']],
        body: extraBody,
        theme: 'grid',
        headStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27] }, // Rojo muy claro
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        styles: { fontSize: 9 }
      });
      
      finalY = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- NOTA ADMINISTRATIVA ---
  if (record.couponMessage) {
      // Chequear si entra en la página
      if (finalY < doc.internal.pageSize.height - 30) {
        doc.setFillColor(255, 251, 235); 
        doc.setDrawColor(252, 211, 77);
        doc.rect(14, finalY, pageWidth - 28, 20, 'FD');
        
        doc.setTextColor(180, 83, 9);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("NOTA DE ADMINISTRACIÓN:", 18, finalY + 7);
        
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        doc.text(record.couponMessage, 18, finalY + 14);
      }
  }

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
    units: Unit[],
    settings?: ConsortiumSettings
) => {
    const doc = new jsPDF();
    const unit = units.find(u => u.id === unitId);
    
    // Si no encontramos la unidad o el detalle, salimos
    const detail = record.unitDetails.find(d => d.unitId === unitId);
    if (!unit || !detail) return;

    // --- CÁLCULOS DEL DESGLOSE ---
    const pct = unit.proratePercentage / 100;
    
    // 1. Ordinarias (Solo lo que NO salió del fondo)
    const ordinaryTotal = record.snapshotExpenses
        .filter(e => e.category === 'Ordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE)
        .reduce((a, b) => a + b.amount, 0);
    const ordinaryShare = ordinaryTotal * pct;

    // 2. Extraordinarias (Solo lo que NO salió del fondo)
    const extraTotal = record.snapshotExpenses
        .filter(e => e.category === 'Extraordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE)
        .reduce((a, b) => a + b.amount, 0);
    const extraShare = extraTotal * pct;

    // 3. Aporte mensual Fondo
    const reserveShare = (record.reserveContribution || 0) * pct;

    // 4. RECUPERO DÉFICIT
    const deficitTotal = record.reserveDeficitCovered || 0;
    const deficitShare = deficitTotal * pct;

    // Ajuste por redondeo
    const checkSum = ordinaryShare + extraShare + reserveShare + deficitShare;
    const diff = detail.totalToPay - checkSum;
    const finalOrdinaryShare = ordinaryShare + diff;

    // VENCIMIENTOS
    const total1 = detail.totalToPay;
    const surchargePct = record.secondExpirationSurcharge || 0;
    const total2 = total1 * (1 + (surchargePct / 100));

    // --- DIBUJO DEL CUPÓN ---

    // 1. Encabezado
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
    
    // FECHAS
    doc.setFontSize(11);
    const v1Date = record.firstExpirationDate ? new Date(record.firstExpirationDate).toLocaleDateString() : '-';
    doc.text(`1er Vto (${v1Date}):`, 120, 70);
    doc.setFont("helvetica", "bold");
    doc.text(`$${formatMoney(total1)}`, 165, 70);
    doc.setFont("helvetica", "normal");
    
    if (record.secondExpirationDate) {
        const v2Date = new Date(record.secondExpirationDate).toLocaleDateString();
        doc.text(`2do Vto (${v2Date}):`, 120, 77);
        doc.setFont("helvetica", "bold");
        doc.text(`$${formatMoney(total2)}`, 165, 77);
    }

    // 3. El Número Importante (TOTAL 1er Vto)
    doc.setFillColor(243, 244, 246); // Gris claro
    doc.roundedRect(20, 85, 170, 40, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text("TOTAL A PAGAR (1er Vto)", 105, 98, { align: "center" });
    
    doc.setFontSize(30);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.setFont("helvetica", "bold");
    doc.text(`$${formatMoney(total1)}`, 105, 115, { align: "center" });
    doc.setFont("helvetica", "normal");

    // 4. Tabla de Conceptos
    const tableBody = [];
    
    if (finalOrdinaryShare > 0.01) 
        tableBody.push(['Expensas Ordinarias', `$${formatMoney(finalOrdinaryShare)}`]);
    
    if (extraShare > 0.01) 
        tableBody.push(['Expensas Extraordinarias', `$${formatMoney(extraShare)}`]);
    
    if (deficitShare > 0.01)
        tableBody.push(['Recupero Saldo Fondo Reserva', `$${formatMoney(deficitShare)}`]);

    if (reserveShare > 0.01) 
        tableBody.push(['Aporte Fondo de Reserva', `$${formatMoney(reserveShare)}`]);

    autoTable(doc, {
        startY: 140,
        head: [['Concepto', 'Monto']],
        body: tableBody,
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
    if (settings) {
        doc.text(`Banco: ${settings.bankName}`, 30, finalY + 20);
        doc.text(`Titular: ${settings.bankHolder}`, 30, finalY + 28);
        doc.setFont("helvetica", "bold");
        doc.text(`CBU: ${settings.bankCBU}`, 30, finalY + 38);
        doc.text(`Alias: ${settings.bankAlias}`, 30, finalY + 46);
    } else {
        doc.text("Consulte datos a la administración.", 30, finalY + 25);
    }

    // Footer
    if (record.couponMessage) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Nota: ${record.couponMessage}`, 105, finalY + 60, { align: "center" });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Por favor envíe el comprobante por WhatsApp o Email al realizar el pago.", 105, 280, { align: "center" });

    doc.save(`Cupon_${unit.unitNumber}_${record.month}.pdf`);
};