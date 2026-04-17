import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, Consortium, Payment } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// --- UTILIDADES ---

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
  }).format(amount || 0);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  } catch (e) {
    return dateString || '-';
  }
};

// PALETA DE COLORES CORPORATIVA
const THEME = {
    primary: [30, 58, 138] as [number, number, number],   // Azul Institucional
    secondary: [71, 85, 105] as [number, number, number], // Gris Pizarra
    stripe: [241, 245, 249] as [number, number, number],  // Fondo cebra tablas
    border: [203, 213, 225] as [number, number, number],  // Bordes
    text: [30, 41, 59] as [number, number, number]        // Texto principal
};

// --- HELPERS DE DIBUJO ---

function drawHeader(doc: jsPDF, consortium: Consortium, title: string, settlement: SettlementRecord) {
    const pageWidth = doc.internal.pageSize.width;
    
    // Fondo azul superior
    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setTextColor(255, 255, 255);
    
    if (consortium.image) { 
        try { doc.addImage(consortium.image, 'JPEG', 14, 8, 22, 22); } catch (e) { } 
        doc.setFontSize(18); 
        doc.setFont("helvetica", "bold"); 
        doc.text((consortium.name || "CONSORCIO").toUpperCase(), 42, 16);
        
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal"); 
        doc.text(consortium.address || "", 42, 22);
        
        if (consortium.cuit) {
            doc.text(`CUIT: ${consortium.cuit}`, 42, 27);
        }
    } else {
        doc.setFontSize(18); 
        doc.setFont("helvetica", "bold"); 
        doc.text((consortium.name || "CONSORCIO").toUpperCase(), 14, 16);
        
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal"); 
        doc.text(consortium.address || "", 14, 22);
        
        if (consortium.cuit) {
            doc.text(`CUIT: ${consortium.cuit}`, 14, 27);
        }
    }

    // Título a la derecha
    doc.setFontSize(12); 
    doc.setFont("helvetica", "bold"); 
    doc.text(title, pageWidth - 14, 18, { align: 'right' });
    
    doc.setFontSize(11); 
    doc.setFont("helvetica", "normal"); 
    doc.text(`Período: ${(settlement.month || '-').toUpperCase()}`, pageWidth - 14, 26, { align: 'right' });
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
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    
    const vto1 = settlement.firstExpirationDate ? formatDate(settlement.firstExpirationDate) : '-';
    const vto2 = settlement.secondExpirationDate ? formatDate(settlement.secondExpirationDate) : '-';
    
    doc.text(`1° Vencimiento: ${vto1}`, 50, yPos); 
    doc.text(`2° Vencimiento: ${vto2}`, 110, yPos);
    
    if (settlement.couponMessage) {
        yPos += 8; 
        doc.setFontSize(9); 
        doc.setFont("helvetica", "italic"); 
        doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
        doc.text(`Aviso: ${settlement.couponMessage}`, 14, yPos, { maxWidth: pageWidth - 28 });
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
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
}

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

// --- GENERADOR CUPÓN INDIVIDUAL ---

const createCouponDoc = (settlement: SettlementRecord, unit: Unit, consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    drawHeader(doc, consortium, "CUPÓN DE PAGO INDIVIDUAL", settlement);

    let finalY = 50;

    // Tarjeta del Propietario
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, finalY, pageWidth - 28, 35, 3, 3, 'FD');
    
    doc.setFontSize(20);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`Unidad: ${unit.unitNumber || '-'}`, 20, finalY + 16);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.text(`Propietario: ${unit.ownerName || 'A designar'}`, 20, finalY + 26);

    doc.setFontSize(10);
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text("COEF. PRORRATEO", pageWidth - 20, finalY + 16, { align: 'right' });
    
    doc.setFontSize(16);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    const formattedPercentage = Number(unit.proratePercentage || 0).toFixed(2);
    doc.text(`${formattedPercentage}%`, pageWidth - 20, finalY + 26, { align: 'right' });

    finalY += 45;

    const allUnits = settlement.unitDetails || [];
    let ordTotal = 0; 
    let extTotal = 0;
    
    (settlement.snapshotExpenses || []).forEach(exp => {
        if (exp.distributionType === 'FROM_RESERVE') return;
        
        if (exp.affectedUnitIds && exp.affectedUnitIds.length > 0) {
            if (!exp.affectedUnitIds.includes(unit.id)) return; 
            
            if (exp.distributionType === 'EQUAL_PARTS') {
                const amount = exp.amount / exp.affectedUnitIds.length;
                if (exp.category === 'Ordinary') ordTotal += amount; 
                else extTotal += amount;
            }
        } else {
            let amount = 0;
            if (exp.distributionType === 'EQUAL_PARTS') {
                amount = exp.amount / (allUnits.length || 1);
            } else {
                amount = exp.amount * (Number(unit.proratePercentage) / 100);
            }

            if (exp.category === 'Ordinary') ordTotal += amount;
            else if (exp.category === 'Extraordinary') extTotal += amount;
        }
    });

    const detail = (settlement.unitDetails || []).find(d => d.unitId === unit.id);
    const exactAmountToPayMonth = detail ? detail.totalToPay : 0;
    const reserveContributionForUnit = (settlement.reserveContribution || 0) * (Number(unit.proratePercentage) / 100);

    const bodyRows: any[][] = [['CONCEPTO', 'IMPORTE']];

    if (ordTotal > 0 || (ordTotal === 0 && extTotal === 0)) {
        bodyRows.push(['Expensas Ordinarias (Tu Cuota Parte)', formatCurrency(ordTotal)]);
    }
    if (extTotal > 0) {
        bodyRows.push(['Expensas Extraordinarias (Tu Cuota Parte)', formatCurrency(extTotal)]);
    }
    if (reserveContributionForUnit > 0) {
        bodyRows.push(['Aporte a Fondo de Reserva', formatCurrency(reserveContributionForUnit)]);
    }

    const diff = exactAmountToPayMonth - (ordTotal + extTotal + reserveContributionForUnit);
    if (Math.abs(diff) > 0.05) {
        bodyRows.push(['Gastos de Distribución Específica / Ajustes', formatCurrency(diff)]);
    }

    let totalHistoricalDebt = 0;
    const initialBalance = unit.initialBalance || 0;
    
    if ((unit.debts && unit.debts.length > 0) || initialBalance > 0) {
        bodyRows.push([{ content: 'DEUDA PENDIENTE Y RECARGOS', colSpan: 2, styles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: THEME.secondary } }]);
        
        if (initialBalance > 0) { 
            bodyRows.push(['Saldo Inicial / Deuda Previa', formatCurrency(initialBalance)]); 
            totalHistoricalDebt += initialBalance; 
        }
        
        if (unit.debts) {
            unit.debts.forEach(debt => {
                const label = `Deuda ${debt.period} (Cap: ${formatCurrency(debt.baseAmount)} | Int: ${debt.interestRate}%)`;
                bodyRows.push([label, formatCurrency(debt.total)]); 
                totalHistoricalDebt += debt.total;
            });
        }
    } else {
        bodyRows.push(['Deuda Anterior', '$ 0,00']);
    }

    const finalTotalToPay = exactAmountToPayMonth + totalHistoricalDebt;
    bodyRows.push(['TOTAL A PAGAR', formatCurrency(finalTotalToPay)]);

    autoTable(doc, {
        startY: finalY, 
        body: bodyRows, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255,255,255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 11, textColor: THEME.text, cellPadding: 5 },
        columnStyles: { 
            0: { cellWidth: 100 }, 
            1: { cellWidth: 'auto', halign: 'right' } 
        },
        alternateRowStyles: { fillColor: THEME.stripe },
        didParseCell: (data) => {
            if (data.row.index === 0 && data.section === 'body' && data.row.raw[0] === 'CONCEPTO') {
                data.cell.styles.fillColor = THEME.secondary; 
                data.cell.styles.textColor = [255,255,255]; 
                data.cell.styles.fontStyle = 'bold';
            }
            if (data.row.index === bodyRows.length - 1) {
                data.cell.styles.fontStyle = 'bold'; 
                data.cell.styles.fontSize = 14; 
                data.cell.styles.textColor = [255,255,255]; 
                data.cell.styles.fillColor = THEME.primary; 
            }
        }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 15;

    // Caja Bancaria
    doc.setDrawColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]);
    doc.roundedRect(14, finalY, pageWidth - 28, 28, 2, 2, 'FD');

    doc.setFontSize(11); 
    doc.setFont("helvetica", "bold"); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.text("DATOS PARA TRANSFERENCIA BANCARIA", 20, finalY + 8);
    
    doc.setFontSize(10); 
    doc.setFont("helvetica", "normal"); 
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    
    const bankInfo = consortium as any;
    doc.text(`Banco: ${bankInfo.bankName || 'A definir'}`, 20, finalY + 15);
    
    if(bankInfo.bankHolder) {
        doc.text(`Titular: ${bankInfo.bankHolder}`, 100, finalY + 15); 
    }
    
    doc.setFont("helvetica", "bold"); 
    doc.text(`CBU: ${bankInfo.bankCBU || '-'}`, 20, finalY + 22);
    doc.text(`Alias: ${bankInfo.bankAlias || '-'}`, 100, finalY + 22);
    
    finalY += 35;
    drawFooter(doc, settlement, pageWidth, finalY);

    return doc;
};


// --- EXPORTS PRINCIPALES ---

export const generateIndividualCouponPDF = (settlement: SettlementRecord, unit: Unit, consortium: Consortium) => {
    const doc = createCouponDoc(settlement, unit, consortium);
    const safeUnit = (unit.unitNumber || '00').replace(/[^a-z0-9]/gi, '_');
    doc.save(`CUPON_DE_PAGO_${safeUnit}.pdf`);
};

export const generateCouponBase64 = (settlement: SettlementRecord, unit: Unit, consortium: Consortium): string => {
    const doc = createCouponDoc(settlement, unit, consortium);
    return doc.output('datauristring').split(',')[1]; 
};

export const generateSettlementPDF = (settlement: SettlementRecord, consortium: Consortium, units: Unit[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  drawHeader(doc, consortium, "LIQUIDACIÓN GENERAL", settlement);
  
  let finalY = 45;

  const expenses = settlement.snapshotExpenses || [];
  const ordinaryExpenses = expenses.filter(e => e.category === 'Ordinary').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const extraordinaryExpenses = expenses.filter(e => e.category === 'Extraordinary').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalOrd = ordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExtra = extraordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);

  const drawExpenseTable = (title: string, dataRows: any[], total: number) => {
      doc.setFontSize(12); 
      doc.setFont("helvetica", "bold"); 
      doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
      doc.text(title, 14, finalY); 
      finalY += 3;
      
      const rows = dataRows.map(exp => [
        formatDate(exp.date),
        exp.itemCategory || 'General',
        exp.description + (exp.affectedUnitIds && exp.affectedUnitIds.length > 0 ? ' (*Distribución Específica)' : ''),
        formatCurrency(exp.amount)
      ]);
      
      autoTable(doc, {
        startY: finalY, 
        head: [['FECHA', 'RUBRO', 'DETALLE', 'IMPORTE']], 
        body: rows, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255,255,255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 3 },
        columnStyles: { 
            0: { cellWidth: 25 }, 
            1: { cellWidth: 35, fontStyle: 'bold' }, 
            2: { cellWidth: 'auto' }, 
            3: { cellWidth: 35, halign: 'right' } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
      });
      
      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 5;
      
      doc.setFont("helvetica", "bold"); 
      doc.setFontSize(11); 
      doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
      doc.text(`Subtotal: ${formatCurrency(total)}`, pageWidth - 14, finalY, { align: 'right' });
      finalY += 10;
  };

  if (ordinaryExpenses.length > 0) {
      drawExpenseTable("GASTOS ORDINARIOS", ordinaryExpenses, totalOrd);
  }
  
  if (extraordinaryExpenses.length > 0) { 
      if (finalY > 230) { doc.addPage(); finalY = 20; } 
      drawExpenseTable("GASTOS EXTRAORDINARIOS", extraordinaryExpenses, totalExtra); 
  }
  
  if (finalY > 200) { doc.addPage(); finalY = 20; }

  // ESTADO FINANCIERO Y RESERVA
  doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
  doc.roundedRect(14, finalY, pageWidth - 28, 60, 2, 2, 'F'); 
  
  doc.setFontSize(14); 
  doc.setTextColor(255, 255, 255); 
  doc.setFont("helvetica", "bold");
  doc.text("ESTADO FINANCIERO Y RESERVA", 20, finalY + 10);

  const col1X = 20; 
  const col2X = pageWidth - 25; 
  let currentY = finalY + 22; 
  const lh = 7; 
  
  doc.setFontSize(10); 
  doc.setFont("helvetica", "normal");
  
  doc.text("Saldo Anterior Fondo/Caja", col1X, currentY); 
  doc.text(formatCurrency(settlement.reserveBalanceStart), col2X, currentY, { align: 'right' }); 
  currentY += lh;
  
  doc.text("(+) Cobranzas Recibidas", col1X, currentY); 
  doc.text(formatCurrency(settlement.totalCollected), col2X, currentY, { align: 'right' }); 
  currentY += lh;
  
  if (settlement.reserveExpense > 0) { 
      doc.text("(-) Pagos cubiertos por Reserva", col1X, currentY); 
      doc.text(`- ${formatCurrency(settlement.reserveExpense)}`, col2X, currentY, { align: 'right' }); 
      currentY += lh; 
  }
  
  doc.text("(+) Aporte de este mes a Reserva", col1X, currentY); 
  doc.text(formatCurrency(settlement.reserveContribution), col2X, currentY, { align: 'right' }); 
  currentY += lh;
  
  doc.setDrawColor(255,255,255); 
  doc.line(20, currentY, pageWidth - 20, currentY); 
  currentY += 6;
  
  doc.setFontSize(12); 
  doc.setFont("helvetica", "bold");
  doc.text("SALDO FINAL DISPONIBLE (ESTIMADO)", col1X, currentY); 
  doc.text(formatCurrency(settlement.reserveBalanceAtClose), col2X, currentY, { align: 'right' });

  finalY += 75; 
  
  drawFooter(doc, settlement, pageWidth, finalY); 
  addPageNumbers(doc);
  
  doc.save(`Expensas_Generales_${(consortium.name || 'Consorcio').replace(/[^a-z0-9]/gi, '_')}_${settlement.month || 'Mes'}.pdf`);
};

export const generateReserveLedgerPDF = (ledgerData: any[], consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    drawHeader(doc, consortium, "MAYOR: FONDO DE RESERVA", { month: new Date().toLocaleDateString() } as any);

    let finalY = 45;
    const currentBalance = ledgerData.length > 0 ? ledgerData[0].runningBalance : 0;

    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]);
    doc.roundedRect(14, finalY, pageWidth - 28, 20, 2, 2, 'FD');
    
    doc.setFontSize(12); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO ACTUAL DISPONIBLE: ${formatCurrency(currentBalance)}`, 20, finalY + 12);
    
    finalY += 25;

    const tableBody = ledgerData.map(t => [
        formatDate(t.date), 
        t.description + (t.type === 'SYSTEM' ? ' (Auto)' : ''),
        t.amount > 0 ? formatCurrency(t.amount) : '-', 
        t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-', 
        formatCurrency(t.runningBalance)
    ]);
    
    autoTable(doc, {
        startY: finalY, 
        head: [['FECHA', 'CONCEPTO', 'INGRESO (+)', 'EGRESO (-)', 'SALDO']], 
        body: tableBody, 
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: THEME.text, cellPadding: 4 },
        columnStyles: { 
            0: { cellWidth: 25 }, 
            2: { halign: 'right', textColor: [22, 163, 74] }, 
            3: { halign: 'right', textColor: [220, 38, 38] }, 
            4: { halign: 'right', fontStyle: 'bold' } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    addPageNumbers(doc);
    doc.save(`Reserva_${(consortium.name || '').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

export const generateDebtDetailPDF = (unit: Unit, consortium: Consortium) => {
    const doc = new jsPDF(); 
    const pageWidth = doc.internal.pageSize.width;
    
    drawHeader(doc, consortium, "ESTADO DE DEUDA", { month: new Date().toLocaleDateString() } as any);

    let finalY = 45;
    
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]); 
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]); 
    doc.roundedRect(14, finalY, pageWidth - 28, 25, 2, 2, 'FD');
    
    doc.setFontSize(14); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.setFont("helvetica", "bold");
    doc.text(`Unidad: ${unit.unitNumber || '-'}`, 20, finalY + 10);
    
    doc.setFontSize(11); 
    doc.setFont("helvetica", "normal"); 
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.text(`Propietario: ${unit.ownerName || 'No asignado'}`, 20, finalY + 18);

    finalY += 35;
    
    let totalDebt = 0; 
    const tableBody: any[][] = [];

    if (unit.initialBalance && unit.initialBalance > 0) {
        tableBody.push(['Saldo Inicial / Deuda Previa', formatCurrency(unit.initialBalance), '-', '-', formatCurrency(unit.initialBalance)]);
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
    doc.save(`Deuda_${(unit.unitNumber || '').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

export const generateUnitLedgerPDF = (unit: Unit, payments: Payment[], consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    drawHeader(doc, consortium, "ESTADO DE CUENTA", { month: new Date().toLocaleDateString() } as any);

    let finalY = 45;
    
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(THEME.stripe[0], THEME.stripe[1], THEME.stripe[2]);
    doc.roundedRect(14, finalY, pageWidth - 28, 25, 2, 2, 'FD');
    
    doc.setFontSize(14); 
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]); 
    doc.setFont("helvetica", "bold");
    doc.text(`Unidad: ${unit.unitNumber || '-'}`, 20, finalY + 10);
    
    doc.setFontSize(11); 
    doc.setFont("helvetica", "normal"); 
    doc.setTextColor(THEME.text[0], THEME.text[1], THEME.text[2]);
    doc.text(`Propietario: ${unit.ownerName || 'No asignado'}`, 20, finalY + 18);

    finalY += 35;

    const items: any[] = [];
    
    if (unit.initialBalance) {
        items.push({ date: '-', concept: 'Saldo Inicial / Deuda Previa', charge: unit.initialBalance, payment: 0 });
    }
    
    if (unit.debts) {
        unit.debts.forEach(d => {
            items.push({ date: d.period, concept: `Deuda Histórica / Recargo`, charge: d.total, payment: 0 });
        });
    }
    
    payments.filter(p => p.unitId === unit.id && p.status === 'APPROVED').forEach(p => {
        items.push({ date: new Date(p.date).toLocaleDateString(), concept: `Pago Realizado (${p.method})`, charge: 0, payment: p.amount });
    });

    const tableBody: any[][] = items.map(t => [ 
        t.date, 
        t.concept, 
        t.charge > 0 ? formatCurrency(t.charge) : '-', 
        t.payment > 0 ? formatCurrency(t.payment) : '-' 
    ]);

    if (tableBody.length === 0) {
        tableBody.push([{ content: 'No registra movimientos.', colSpan: 4, styles: { halign: 'center', fontStyle: 'italic' } }]);
    }

    autoTable(doc, {
        startY: finalY,
        head: [['FECHA / PERÍODO', 'CONCEPTO', 'CARGO (+)', 'PAGO (-)']],
        body: tableBody,
        theme: 'plain',
        headStyles: { fillColor: THEME.secondary, textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, textColor: THEME.text, cellPadding: 4 },
        columnStyles: { 
            0: { cellWidth: 35 }, 
            2: { halign: 'right', textColor: [220, 38, 38] }, 
            3: { halign: 'right', textColor: [22, 163, 74] } 
        },
        alternateRowStyles: { fillColor: THEME.stripe }
    });

    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;
    
    const balance = items.reduce((acc, curr) => acc + curr.charge - curr.payment, 0);

    doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.roundedRect(pageWidth - 90, finalY, 76, 12, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12); 
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO TOTAL: ${formatCurrency(balance)}`, pageWidth - 86, finalY + 8);
    
    addPageNumbers(doc);
    doc.save(`Estado_Cuenta_${(unit.unitNumber || '').replace(/[^a-z0-9]/gi, '_')}.pdf`);
};