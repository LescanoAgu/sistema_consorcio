import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, Consortium } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  } catch (e) {
    return dateString || '-';
  }
};

const THEME = {
    primary: [15, 23, 42] as [number, number, number], 
    secondary: [51, 65, 85] as [number, number, number], 
    stripe: [248, 250, 252] as [number, number, number], 
    border: [203, 213, 225] as [number, number, number], 
    text: [30, 41, 59] as [number, number, number] 
};

const createCouponDoc = (settlement: SettlementRecord, unit: Unit, consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    drawHeader(doc, consortium, "CUPÓN DE PAGO INDIVIDUAL", settlement);

    let finalY = 60;

    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, finalY, pageWidth - 28, 35, 2, 2, 'FD');
    
    doc.setFontSize(18);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`UF ${unit.unitNumber || '-'}`, 22, finalY + 14);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(unit.ownerName || 'Propietario', 22, finalY + 24);

    doc.setFontSize(10);
    doc.text("COEFICIENTE", pageWidth - 22, finalY + 14, { align: 'right' });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const formattedPercentage = Number(unit.proratePercentage || 0).toFixed(2);
    doc.text(`${formattedPercentage}%`, pageWidth - 22, finalY + 24, { align: 'right' });

    finalY += 45;

    const detail = (settlement.unitDetails || []).find(d => d.unitId === unit.id);
    const amountToPayMonth = detail ? detail.totalToPay : 0;

    const totalUnits = settlement.unitDetails?.length || 1;
    const prorateMultiplier = Number(unit.proratePercentage || 0) / 100;

    let ordTotal = 0;
    let extTotal = 0;

    (settlement.snapshotExpenses || []).forEach(exp => {
        if (exp.distributionType === 'FROM_RESERVE') return;
        
        let amount = 0;
        if (exp.distributionType === 'PRORATED') amount = exp.amount * prorateMultiplier;
        else if (exp.distributionType === 'EQUAL_PARTS') amount = exp.amount / totalUnits;

        if (exp.category === 'Ordinary') ordTotal += amount;
        else if (exp.category === 'Extraordinary') extTotal += amount;
    });

    const reserveContributionForUnit = (settlement.reserveContribution || 0) * prorateMultiplier;

    const bodyRows: any[][] = [['CONCEPTO', 'IMPORTE']];

    if (ordTotal > 0 || (ordTotal === 0 && extTotal === 0)) {
        bodyRows.push(['Expensas Ordinarias Período', formatCurrency(ordTotal)]);
    }
    if (extTotal > 0) {
        bodyRows.push(['Expensas Extraordinarias Período', formatCurrency(extTotal)]);
    }
    if (reserveContributionForUnit > 0) {
        bodyRows.push(['Aporte Fondo de Reserva', formatCurrency(reserveContributionForUnit)]);
    }

    const diff = amountToPayMonth - (ordTotal + extTotal + reserveContributionForUnit);
    if (Math.abs(diff) > 0.05) { 
        bodyRows.push(['Otros Ajustes Período', formatCurrency(diff)]);
    }

    // --- INTEGRACIÓN DE DEUDAS Y SALDO INICIAL ---
    let totalHistoricalDebt = 0;
    const initialBalance = unit.initialBalance || 0;
    
    // Si tiene deuda cargada O saldo inicial previo, agregamos la sección
    if ((unit.debts && unit.debts.length > 0) || initialBalance > 0) {
        bodyRows.push([{ content: 'DEUDA PENDIENTE Y RECARGOS HISTÓRICOS', colSpan: 2, styles: { fontStyle: 'bold', textColor: THEME.secondary, fillColor: [240, 240, 240] } }]);
        
        if (initialBalance > 0) {
            bodyRows.push(['Saldo Inicial / Deuda Previa', formatCurrency(initialBalance)]);
            totalHistoricalDebt += initialBalance;
        }

        if (unit.debts) {
            unit.debts.forEach(debt => {
                const label = `Deuda ${debt.period} (Capital: ${formatCurrency(debt.baseAmount)} + Int: ${debt.interestRate}%)`;
                bodyRows.push([label, formatCurrency(debt.total)]);
                totalHistoricalDebt += debt.total;
            });
        }
    } else {
        bodyRows.push(['Deuda Anterior', '$ 0,00']);
    }

    const finalTotalToPay = amountToPayMonth + totalHistoricalDebt;
    bodyRows.push(['TOTAL A PAGAR', formatCurrency(finalTotalToPay)]);

    autoTable(doc, {
        startY: finalY,
        body: bodyRows,
        theme: 'plain',
        headStyles: { fillColor: [255,255,255], textColor: THEME.secondary, fontStyle: 'bold' },
        bodyStyles: { fontSize: 11, textColor: THEME.text, cellPadding: 5 },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 'auto', halign: 'right' }
        },
        didParseCell: (data) => {
            if (data.row.index === bodyRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 13;
                data.cell.styles.textColor = THEME.primary;
                data.cell.styles.fillColor = THEME.stripe; 
            }
        }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 25;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.text("DATOS PARA TRANSFERENCIA BANCARIA", 14, finalY);
    
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.line(14, finalY + 2, pageWidth - 14, finalY + 2);
    finalY += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    
    const bankInfo = consortium as any;

    doc.text(`Banco: ${bankInfo.bankName || 'A definir'}`, 14, finalY);
    
    if(bankInfo.bankHolder) {
        doc.text(`Titular: ${bankInfo.bankHolder}`, 100, finalY); 
    }

    doc.setFont("helvetica", "bold"); 
    doc.text(`CBU: ${bankInfo.bankCBU || '-'}`, 14, finalY + 6);
    doc.text(`Alias: ${bankInfo.bankAlias || '-'}`, 14, finalY + 12);
    
    finalY += 25;
    drawFooter(doc, settlement, pageWidth, finalY);

    return doc;
};

export const generateDebtDetailPDF = (unit: Unit, consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(16);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text("ESTADO DE DEUDA HISTÓRICA", pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(consortium.name, pageWidth / 2, 28, { align: 'center' });

    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 40, pageWidth - 28, 25, 2, 2, 'FD');
    
    doc.setFontSize(14);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`UF ${unit.unitNumber || '-'}`, 20, 50);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(`Propietario: ${unit.ownerName || 'No asignado'}`, 20, 58);

    doc.text(`Fecha de emisión: ${formatDate(new Date().toISOString())}`, pageWidth - 20, 50, { align: 'right' });

    let finalY = 75;
    let totalDebt = 0;
    
    const tableBody: any[][] = [];

    // Incluir Saldo Inicial en el PDF de Estado de Deuda
    if (unit.initialBalance && unit.initialBalance > 0) {
        tableBody.push([
            'Saldo Inicial / Deuda Previa',
            formatCurrency(unit.initialBalance),
            '-',
            '-',
            formatCurrency(unit.initialBalance)
        ]);
        totalDebt += unit.initialBalance;
    }

    (unit.debts || []).forEach(debt => {
        totalDebt += debt.total;
        tableBody.push([
            debt.period,
            formatCurrency(debt.baseAmount),
            `${debt.interestRate}%`,
            formatCurrency(debt.interestAmount),
            formatCurrency(debt.total)
        ]);
    });

    if (tableBody.length === 0) {
        tableBody.push([{ content: 'No registra deuda histórica.', colSpan: 5, styles: { halign: 'center', fontStyle: 'italic' } }]);
    }

    autoTable(doc, {
        startY: finalY,
        head: [['PERÍODO', 'IMPORTE BASE', '% INT.', 'INTERÉS', 'SUBTOTAL']],
        body: tableBody,
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, textColor: THEME.text, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { halign: 'right' },
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;

    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.roundedRect(pageWidth - 90, finalY, 76, 12, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL ADEUDADO: ${formatCurrency(totalDebt)}`, pageWidth - 86, finalY + 8);

    addPageNumbers(doc);

    const safeUnit = (unit.unitNumber || '00').replace(/[^a-z0-9]/gi, '_');
    doc.save(`Detalle_Deuda_UF_${safeUnit}.pdf`);
};

export const generateIndividualCouponPDF = (settlement: SettlementRecord, unit: Unit, consortium: Consortium) => {
    const doc = createCouponDoc(settlement, unit, consortium);
    const safeUnit = (unit.unitNumber || '00').replace(/[^a-z0-9]/gi, '_');
    const safeOwner = (unit.ownerName || 'Propietario').replace(/[^a-z0-9 ]/gi, '').trim().substring(0, 30);
    doc.save(`CUPON DE PAGO (${safeUnit}) (${safeOwner}).pdf`);
};

export const generateCouponBase64 = (settlement: SettlementRecord, unit: Unit, consortium: Consortium): string => {
    const doc = createCouponDoc(settlement, unit, consortium);
    return doc.output('datauristring').split(',')[1]; 
};

export const generateSettlementPDF = (settlement: SettlementRecord, consortium: Consortium, units: Unit[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  drawHeader(doc, consortium, "LIQUIDACIÓN DE EXPENSAS", settlement);

  let finalY = 50;

  const expenses = settlement.snapshotExpenses || [];
  const ordinaryExpenses = expenses.filter(e => e.category === 'Ordinary').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const extraordinaryExpenses = expenses.filter(e => e.category === 'Extraordinary').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalOrd = ordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExtra = extraordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (ordinaryExpenses.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
      doc.text("GASTOS ORDINARIOS", 14, finalY);
      doc.setDrawColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
      doc.setLineWidth(0.5);
      doc.line(14, finalY + 2, pageWidth - 14, finalY + 2);
      finalY += 4;

      const ordRows = ordinaryExpenses.map(exp => [
        formatDate(exp.date),
        exp.itemCategory || 'General',
        exp.description,
        formatCurrency(exp.amount)
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [['FECHA', 'RUBRO', 'DETALLE', 'IMPORTE']],
        body: ordRows,
        theme: 'plain',
        headStyles: { fillColor: [255, 255, 255], textColor: THEME.primary, fontStyle: 'bold', lineColor: THEME.border, lineWidth: { bottom: 0.1 } },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35, fontStyle: 'bold' }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 35, halign: 'right' } },
        didParseCell: (data) => { if (data.section === 'body' && data.row.index % 2 === 0) { data.cell.styles.fillColor = THEME.stripe; } }
      });
      
      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Subtotal Ordinarios: ${formatCurrency(totalOrd)}`, pageWidth - 14, finalY + 5, { align: 'right' });
      finalY += 12;
  }

  if (extraordinaryExpenses.length > 0) {
      if (finalY > 230) { doc.addPage(); finalY = 20; }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
      doc.text("GASTOS EXTRAORDINARIOS", 14, finalY);
      doc.line(14, finalY + 2, pageWidth - 14, finalY + 2);
      finalY += 4;

      const extraRows = extraordinaryExpenses.map(exp => [
        formatDate(exp.date),
        exp.itemCategory || 'General',
        exp.description,
        formatCurrency(exp.amount)
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [['FECHA', 'RUBRO', 'DETALLE', 'IMPORTE']],
        body: extraRows,
        theme: 'plain',
        headStyles: { fillColor: [255, 255, 255], textColor: THEME.primary, fontStyle: 'bold', lineColor: THEME.border, lineWidth: { bottom: 0.1 } },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35, fontStyle: 'bold' }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 35, halign: 'right' } },
        didParseCell: (data) => { if (data.section === 'body' && data.row.index % 2 === 0) { data.cell.styles.fillColor = THEME.stripe; } }
      });
      
      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Subtotal Extraordinarios: ${formatCurrency(totalExtra)}`, pageWidth - 14, finalY + 5, { align: 'right' });
      finalY += 15;
  } else {
      finalY += 5;
  }

  if (finalY > 200) { doc.addPage(); finalY = 20; }

  doc.setFillColor(248, 250, 252); 
  doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
  doc.roundedRect(14, finalY, pageWidth - 28, 60, 1, 1, 'FD'); 

  doc.setFontSize(12);
  doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
  doc.setFont("helvetica", "bold");
  doc.text("ESTADO DE CAJA Y FONDO DE RESERVA", 20, finalY + 10);

  const col1X = 20;
  const col2X = pageWidth - 25;
  let currentY = finalY + 20;
  const lh = 8; 

  drawRow(doc, "Saldo Anterior Fondo/Caja", settlement.reserveBalanceStart, col1X, col2X, currentY, true); currentY += lh;
  drawRow(doc, "(+) Cobranzas Recibidas", settlement.totalCollected, col1X, col2X, currentY); currentY += lh;
  if (settlement.reserveExpense > 0) {
      drawRow(doc, "(-) Gastos cubiertos por Fondo de Reserva", -settlement.reserveExpense, col1X, col2X, currentY);
      currentY += lh;
  }
  drawRow(doc, "(+) Aporte Fondo Reserva (Devengado)", settlement.reserveContribution, col1X, col2X, currentY); currentY += lh;
  
  doc.setDrawColor(200);
  doc.line(20, currentY - 2, pageWidth - 20, currentY - 2);
  currentY += 2;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
  doc.text("SALDO FINAL DISPONIBLE (ESTIMADO)", col1X, currentY);
  doc.text(formatCurrency(settlement.reserveBalanceAtClose), col2X, currentY, { align: 'right' });

  finalY += 70; 
  drawFooter(doc, settlement, pageWidth, finalY);
  addPageNumbers(doc);

  doc.save(`Expensas_${(consortium.name || 'Consorcio').replace(/[^a-z0-9]/gi, '_')}_${settlement.month || 'Mes'}.pdf`);
};

function drawRow(doc: jsPDF, label: string, amount: number, x1: number, x2: number, y: number, isBoldLabel = false) {
    doc.setFontSize(10);
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.setFont("helvetica", isBoldLabel ? "bold" : "normal");
    doc.text(label, x1, y);
    doc.setFont("helvetica", "normal");
    const textAmount = formatCurrency(Math.abs(amount));
    const sign = amount < 0 ? "-" : "";
    doc.text(`${sign} ${textAmount}`, x2, y, { align: 'right' });
}

function drawHeader(doc: jsPDF, consortium: Consortium, title: string, settlement: SettlementRecord) {
    const pageWidth = doc.internal.pageSize.width;
    if (consortium.image) { try { doc.addImage(consortium.image, 'JPEG', 14, 10, 25, 25); } catch (e) { } }
    doc.setFontSize(16);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text((consortium.name || "CONSORCIO").toUpperCase(), 45, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(consortium.address || "", 45, 24);
    if (consortium.cuit) doc.text(`CUIT: ${consortium.cuit}`, 45, 29);
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - 85, 10, 71, 22, 1, 1, 'FD');
    doc.setFontSize(10);
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(title, pageWidth - 49.5, 16, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text((settlement.month || '-').toUpperCase(), pageWidth - 49.5, 24, { align: 'center' });
}

function drawFooter(doc: jsPDF, settlement: SettlementRecord, pageWidth: number, yPos: number) {
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.text("VENCIMIENTOS:", 14, yPos);
    doc.setFont("helvetica", "normal");
    const vto1 = settlement.firstExpirationDate ? formatDate(settlement.firstExpirationDate) : '-';
    const vto2 = settlement.secondExpirationDate ? formatDate(settlement.secondExpirationDate) : '-';
    doc.text(`1° Vto: ${vto1}`, 50, yPos);
    doc.text(`2° Vto: ${vto2}`, 90, yPos);
    if (settlement.couponMessage) {
        yPos += 8;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
        doc.text(`Nota: ${settlement.couponMessage}`, 14, yPos, { maxWidth: pageWidth - 28 });
    }
}

function addPageNumbers(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
}

export const generateReserveLedgerPDF = (ledgerData: any[], consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(16);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text("LIBRO MAYOR: FONDO DE RESERVA", pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(consortium.name || "Consorcio", pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${formatDate(new Date().toISOString())}`, pageWidth / 2, 34, { align: 'center' });

    const currentBalance = ledgerData.length > 0 ? ledgerData[0].runningBalance : 0;

    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 45, pageWidth - 28, 20, 2, 2, 'FD');
    doc.setFontSize(12);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO ACTUAL DISPONIBLE: ${formatCurrency(currentBalance)}`, 20, 57);

    let finalY = 75;

    const tableBody: any[][] = ledgerData.map(t => [
        formatDate(t.date),
        t.description + (t.type === 'SYSTEM' ? ' (Automático)' : ''),
        t.amount > 0 ? formatCurrency(t.amount) : '-',
        t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-',
        formatCurrency(t.runningBalance)
    ]);

    if (tableBody.length === 0) {
        tableBody.push([{ content: 'No hay movimientos registrados.', colSpan: 5, styles: { halign: 'center', fontStyle: 'italic' } }]);
    }

    autoTable(doc, {
        startY: finalY,
        head: [['FECHA', 'CONCEPTO', 'INGRESO (+)', 'EGRESO (-)', 'SALDO']],
        body: tableBody,
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 30, halign: 'right', textColor: [22, 163, 74] }, 
            3: { cellWidth: 30, halign: 'right', textColor: [220, 38, 38] }, 
            4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    addPageNumbers(doc);
    doc.save(`Libro_Mayor_Reserva_${(consortium.name || 'Consorcio').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};