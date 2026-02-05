import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, ConsortiumSettings } from '../types';

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

const formatDate = (dateString?: string) => {
    if(!dateString) return '-';
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`; 
};

// Auxiliar Logo
const getImageDataUrl = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) { return ''; }
};

// --- 1. LIQUIDACIÓN GENERAL (Diseño "Resumen Financiero") ---
export const generateSettlementPDF = async (
  record: SettlementRecord,
  consortiumName: string,
  units: Unit[],
  settings: ConsortiumSettings
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  
  // LOGO y ENCABEZADO
  if (settings.logoUrl) {
      const logoData = await getImageDataUrl(settings.logoUrl);
      if (logoData) doc.addImage(logoData, 'PNG', 14, 10, 20, 20);
  }
  const textX = settings.logoUrl ? 40 : 14;
  
  doc.setFontSize(16);
  doc.text(consortiumName, textX, 18);
  doc.setFontSize(10);
  doc.text("Liquidación de Expensas", textX, 24);
  doc.text(`Período: ${record.month}`, textX, 30);

  // --- TABLA 1: RESUMEN FINANCIERO ---
  const ordinarias = record.totalExpenses - record.reserveExpense - (record.snapshotExpenses.filter(e => e.category === 'Extraordinary').reduce((a,b)=>a+b.amount,0));
  const extraordinarias = record.snapshotExpenses.filter(e => e.category === 'Extraordinary').reduce((a,b)=>a+b.amount,0);
  
  autoTable(doc, {
      startY: 40,
      head: [['Concepto', 'Monto']],
      body: [
          ['Total Gastos del Mes', formatCurrency(record.totalExpenses)],
          ['> Ordinarias', formatCurrency(ordinarias)],
          ['> Extraordinarias', formatCurrency(extraordinarias)],
          ['Total a Recaudar (Expensas)', formatCurrency(record.totalExpenses + record.reserveContribution)]
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 
          0: { fontStyle: 'bold', cellWidth: 120 }, 
          1: { halign: 'right', fontStyle: 'bold' } 
      },
      didParseCell: (data) => {
          if (data.row.index === 1 || data.row.index === 2) {
              data.cell.styles.textColor = [100, 100, 100];
          }
          if (data.row.index === 3) {
              data.cell.styles.fillColor = [240, 240, 240];
              data.cell.styles.fontSize = 11;
          }
      }
  });

  // --- TABLA 2: FONDO DE RESERVA ---
  let finalY = doc.lastAutoTable.finalY + 10;
  
  doc.setFontSize(12);
  doc.text("FONDO DE RESERVA", 14, finalY);
  
  autoTable(doc, {
      startY: finalY + 5,
      body: [
          ['Saldo Inicial (Caja Anterior)', formatCurrency(record.reserveBalanceStart)],
          ['(-) Gastos pagados con Fondo', `-${formatCurrency(record.reserveExpense)}`],
          ['(=) Saldo Final Disponible', formatCurrency(record.reserveBalanceAtClose - record.reserveContribution)],
          ['(+) Aporte a Recaudar este mes', formatCurrency(record.reserveContribution)]
      ],
      theme: 'striped',
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });

  // --- TABLA 3: DETALLE DE GASTOS ---
  finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text("Detalle de Gastos", 14, finalY);

  const expensesData = record.snapshotExpenses.map(e => [
      formatDate(e.date),
      e.description,
      e.itemCategory,
      formatCurrency(e.amount)
  ]);

  autoTable(doc, {
      startY: finalY + 5,
      head: [['Fecha', 'Descripción', 'Rubro', 'Monto']],
      body: expensesData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: { 3: { halign: 'right' } }
  });

  if (record.couponMessage) {
      finalY = doc.lastAutoTable.finalY + 10;
      doc.setFillColor(255, 252, 220);
      doc.rect(14, finalY, 180, 15, 'F');
      doc.setFontSize(9);
      doc.setTextColor(0,0,0);
      doc.text(`AVISO: ${record.couponMessage}`, 16, finalY + 10);
  }

  doc.save(`Liquidacion_${consortiumName}_${record.month}.pdf`);
};

// --- 2. CUPÓN INDIVIDUAL (Diseño "Caja de Vencimientos" + Interés Configurable) ---
export const generateIndividualCouponPDF = async (
    record: SettlementRecord,
    unitId: string,
    consortiumName: string,
    units: Unit[],
    settings: ConsortiumSettings
) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const unit = units.find(u => u.id === unitId);
    const detail = record.unitDetails.find(d => d.unitId === unitId);

    if (!unit || !detail) return;

    if (settings.logoUrl) {
        const logoData = await getImageDataUrl(settings.logoUrl);
        if (logoData) doc.addImage(logoData, 'PNG', 15, 10, 20, 20);
    }
    const headerX = settings.logoUrl ? 40 : 15;

    doc.setFontSize(14);
    doc.text(consortiumName, headerX, 18);
    doc.setFontSize(10);
    doc.text("CUPÓN DE PAGO", headerX, 24);
    doc.text(`Período: ${record.month}`, headerX, 29);

    doc.setFillColor(245, 245, 245);
    doc.rect(15, 35, 180, 15, 'F');
    doc.setFontSize(10);
    doc.text(`Propietario: ${unit.ownerName}`, 20, 41);
    doc.text(`Unidad Funcional: ${unit.unitNumber}`, 20, 47);

    const totalToPay = detail.totalToPay;
    const ordinariaProp = totalToPay * 0.8; 
    const reservaProp = totalToPay * 0.05;
    const extraProp = totalToPay - ordinariaProp - reservaProp;

    // --- CAJA VENCIMIENTOS ---
    doc.setDrawColor(0);
    doc.rect(120, 55, 75, 25);
    doc.setFontSize(10);
    doc.text(`1er Vto (${formatDate(record.firstExpirationDate)}):`, 125, 62);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(totalToPay), 190, 62, { align: 'right' });
    
    // CÁLCULO DINÁMICO DEL INTERÉS
    const interest = settings.interestRate || 5; // <--- USA CONFIG O 5%
    const multiplier = 1 + (interest / 100);
    const total2nd = totalToPay * multiplier;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`2do Vto (${formatDate(record.secondExpirationDate)}):`, 125, 72);
    doc.text(formatCurrency(total2nd), 190, 72, { align: 'right' });

    // TABLA CONCEPTOS
    autoTable(doc, {
        startY: 55,
        margin: { right: 100 }, 
        head: [['Concepto', 'Monto']],
        body: [
            ['Expensas Ordinarias', formatCurrency(ordinariaProp)],
            ['Expensas Extraordinarias', formatCurrency(extraProp)],
            ['Aporte Fondo Reserva', formatCurrency(reservaProp)]
        ],
        theme: 'plain',
        tableWidth: 95,
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } }
    });

    let finalY = 95;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL A PAGAR (1er Vto)", 15, finalY);
    doc.setFontSize(22);
    doc.text(formatCurrency(totalToPay), 15, finalY + 10);

    finalY += 25;
    doc.setFontSize(11);
    doc.text("DATOS PARA TRANSFERENCIA", 15, finalY);
    doc.line(15, finalY+2, 195, finalY+2);
    
    finalY += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (settings.bankCBU) {
        doc.text(`Banco: ${settings.bankName}`, 15, finalY);
        doc.text(`Titular: ${settings.bankHolder || settings.adminName}`, 15, finalY + 6);
        doc.text(`CBU: ${settings.bankCBU}`, 15, finalY + 12);
        doc.text(`Alias: ${settings.bankAlias}`, 15, finalY + 18);
    } else {
        doc.text("Consulte datos de cuenta a la administración.", 15, finalY);
    }

    doc.setFontSize(9);
    doc.setTextColor(100,100,100);
    doc.text("Por favor envíe el comprobante por WhatsApp o Email al realizar el pago.", 15, finalY + 30);

    doc.save(`Cupon_${unit.unitNumber}_${record.month}.pdf`);
};