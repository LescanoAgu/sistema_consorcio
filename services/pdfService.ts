import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, Consortium } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// --- UTILIDADES ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount || 0);
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

// --- FUNCIÓN INTERNA: CREAR EL DOCUMENTO CUPÓN (Para no repetir código) ---
const createCouponDoc = (settlement: SettlementRecord, unit: Unit, consortium: Consortium) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    drawHeader(doc, consortium, "CUPÓN DE PAGO INDIVIDUAL", settlement);

    let finalY = 60;

    // Tarjeta Propietario
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, finalY, pageWidth - 28, 35, 2, 2, 'FD');
    
    // UF
    doc.setFontSize(18);
    doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`UF ${unit.unitNumber || '-'}`, 22, finalY + 14);
    
    // Propietario
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2]);
    doc.text(unit.ownerName || 'Propietario', 22, finalY + 24);

    // Coeficiente
    doc.setFontSize(10);
    doc.text("COEFICIENTE", pageWidth - 22, finalY + 14, { align: 'right' });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    // DECIMALES CORREGIDOS
    const formattedPercentage = Number(unit.proratePercentage || 0).toFixed(2);
    doc.text(`${formattedPercentage}%`, pageWidth - 22, finalY + 24, { align: 'right' });

    finalY += 45;

    // Detalle
    const detail = (settlement.unitDetails || []).find(d => d.unitId === unit.id);
    const amountToPay = detail ? detail.totalToPay : 0;

    autoTable(doc, {
        startY: finalY,
        body: [
            ['CONCEPTO', 'IMPORTE'],
            ['Expensas del Período', formatCurrency(amountToPay)],
            ['Deuda Anterior', '$ 0,00'],
            ['TOTAL A PAGAR', formatCurrency(amountToPay)]
        ],
        theme: 'plain',
        headStyles: { fillColor: [255,255,255], textColor: THEME.secondary, fontStyle: 'bold' },
        bodyStyles: { fontSize: 11, textColor: THEME.text, cellPadding: 5 },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 'auto', halign: 'right' }
        },
        didParseCell: (data) => {
            if (data.row.index === 3) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 13;
                data.cell.styles.textColor = THEME.primary;
                data.cell.styles.fillColor = THEME.stripe; 
            }
        }
    });

    // Datos Bancarios
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
    
    // Inyección de datos bancarios
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

// --- EXPORT 1: CUPÓN INDIVIDUAL ---
export const generateIndividualCouponPDF = (
    settlement: SettlementRecord,
    unit: Unit,
    consortium: Consortium
) => {
    const doc = createCouponDoc(settlement, unit, consortium);
    
    // NOMBRE DE ARCHIVO AJUSTADO
    const safeUnit = (unit.unitNumber || '00').replace(/[^a-z0-9]/gi, '_');
    const safeOwner = (unit.ownerName || 'Propietario').replace(/[^a-z0-9 ]/gi, '').trim().substring(0, 30);
    
    doc.save(`CUPON DE PAGO (${safeUnit}) (${safeOwner}).pdf`);
};

// --- EXPORT 2: GENERAR BASE64 (Para Email - aunque no lo usemos ahora, lo dejamos listo) ---
export const generateCouponBase64 = (
    settlement: SettlementRecord,
    unit: Unit,
    consortium: Consortium
): string => {
    const doc = createCouponDoc(settlement, unit, consortium);
    return doc.output('datauristring').split(',')[1]; 
};

// --- EXPORT 3: LIQUIDACIÓN GLOBAL ---
export const generateSettlementPDF = (
  settlement: SettlementRecord,
  consortium: Consortium,
  units: Unit[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  drawHeader(doc, consortium, "LIQUIDACIÓN DE EXPENSAS", settlement);

  let finalY = 50;

  // Calculamos totales
  const expenses = settlement.snapshotExpenses || [];
  const ordinaryExpenses = expenses.filter(e => e.category === 'Ordinary').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const extraordinaryExpenses = expenses.filter(e => e.category === 'Extraordinary').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalOrd = ordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExtra = extraordinaryExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Bloque Ordinarios
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

  // Bloque Extraordinarios
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

  // Bloque Financiero
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

  doc.save(`Expensas_${consortium.name || 'Consorcio'}_${settlement.month || 'Mes'}.pdf`);
};

// ==========================================
// HELPERS COMPARTIDOS
// ==========================================

// ESTE ES EL HELPER QUE FALTABA
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