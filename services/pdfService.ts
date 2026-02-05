import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, ConsortiumSettings, Expense, ExpenseDistributionType } from '../types';

// Extendemos jsPDF para incluir autoTable (TypeScript hack)
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

// --- 1. GENERAR LIQUIDACIÓN GENERAL (EXPENSA) ---
export const generateSettlementPDF = (
  record: SettlementRecord,
  consortiumName: string,
  units: Unit[],
  settings: ConsortiumSettings
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.width;

  // --- HEADER ---
  doc.setFontSize(18);
  doc.text(consortiumName, 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Liquidación de Expensas: ${record.month}`, 14, 28);
  doc.setFontSize(10);
  doc.text(`Fecha de Cierre: ${new Date(record.dateClosed).toLocaleDateString()}`, 14, 34);

  // --- RESUMEN FINANCIERO ---
  doc.setFillColor(240, 240, 240);
  doc.rect(14, 40, pageWidth - 28, 25, 'F');
  
  doc.setFontSize(10);
  doc.text("RESUMEN DEL PERÍODO", 18, 48);
  
  doc.setFontSize(9);
  doc.text(`Total Gastos Ordinarios:`, 18, 55);
  doc.text(formatCurrency(record.totalExpenses), 80, 55);
  
  // (Aquí podrías sumar más detalles si tuvieras gastos extraordinarios separados en el record)
  
  let currentY = 75;

  // --- TABLA DE GASTOS ---
  doc.setFontSize(12);
  doc.text("Detalle de Gastos", 14, currentY);
  currentY += 5;

  const expensesData = record.snapshotExpenses.map(e => [
    new Date(e.date).toLocaleDateString(),
    e.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario',
    e.itemCategory || 'Varios',
    e.description,
    formatCurrency(e.amount)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Fecha', 'Tipo', 'Rubro', 'Concepto', 'Importe']],
    body: expensesData,
    theme: 'grid',
    headStyles: { fillColor: [63, 81, 181] },
    styles: { fontSize: 8 },
    columnStyles: { 4: { halign: 'right' } },
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // --- TABLA DE PRORRATEO (DISTRIBUCIÓN) ---
  doc.setFontSize(12);
  doc.text("Distribución por Unidad (Prorrateo)", 14, currentY);
  currentY += 5;

  const distributionData = record.unitDetails.map(detail => {
    const unit = units.find(u => u.id === detail.unitId);
    return [
      unit?.unitNumber || '?',
      unit?.ownerName || '?',
      `${unit?.proratePercentage}%`,
      formatCurrency(detail.totalToPay) // Aquí podrías desglosar deuda previa si la tuvieras en el record
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Unidad', 'Propietario', '%', 'Total a Pagar']],
    body: distributionData,
    theme: 'striped',
    headStyles: { fillColor: [46, 125, 50] }, // Verde para cobros
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // --- DATOS BANCARIOS ---
  if (settings.bankCBU) {
      doc.setFillColor(230, 240, 255); // Azul muy claro
      doc.rect(14, currentY, 120, 35, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("DATOS PARA TRANSFERENCIA", 18, currentY + 8);
      
      doc.setFontSize(9);
      doc.text(`Banco: ${settings.bankName}`, 18, currentY + 15);
      doc.text(`Titular: ${settings.bankHolder}`, 18, currentY + 20);
      doc.text(`CBU: ${settings.bankCBU}`, 18, currentY + 25);
      doc.text(`Alias: ${settings.bankAlias}`, 18, currentY + 30);
  }

  // Guardar PDF
  doc.save(`Expensas_${consortiumName}_${record.month}.pdf`);
};

// --- 2. GENERAR CUPÓN INDIVIDUAL ---
export const generateIndividualCouponPDF = (
    record: SettlementRecord,
    unitId: string,
    consortiumName: string,
    units: Unit[],
    settings: ConsortiumSettings
) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const unit = units.find(u => u.id === unitId);
    const detail = record.unitDetails.find(d => d.unitId === unitId);

    if (!unit || !detail) return alert("Datos de unidad no encontrados");

    // Marco del Cupón
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 130); // Un cupón de media página aprox

    // Encabezado
    doc.setFontSize(16);
    doc.text(consortiumName, 20, 20);
    doc.setFontSize(10);
    doc.text(`CUPÓN DE PAGO - ${record.month}`, 150, 20);

    // Datos de la Unidad
    doc.setFontSize(12);
    doc.text(`Unidad: ${unit.unitNumber}`, 20, 35);
    doc.text(`Propietario: ${unit.ownerName}`, 20, 42);
    doc.text(`Porcentaje: ${unit.proratePercentage}%`, 150, 35);

    // Detalle del Cobro
    doc.line(10, 50, 200, 50);
    
    doc.setFontSize(14);
    doc.text("A PAGAR", 20, 65);
    doc.setFontSize(22);
    doc.text(formatCurrency(detail.totalToPay), 150, 65, { align: 'right' });

    // Vencimientos (Calculados simples +10 y +20 días del cierre)
    const cierre = new Date(record.dateClosed);
    const vto1 = new Date(cierre); vto1.setDate(cierre.getDate() + 10);
    
    doc.setFontSize(10);
    doc.text(`Vencimiento: ${vto1.toLocaleDateString()}`, 20, 80);

    // Datos Bancarios
    if (settings.bankCBU) {
        doc.setFillColor(245, 245, 245);
        doc.rect(20, 90, 170, 30, 'F');
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        doc.text(`Depositar en: ${settings.bankName}`, 25, 100);
        doc.text(`CBU: ${settings.bankCBU}`, 25, 107);
        doc.text(`Alias: ${settings.bankAlias}`, 25, 114);
    }

    // Pie
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Por favor, envíe el comprobante de pago a la administración.", 20, 135);

    doc.save(`Cupon_${unit.unitNumber}_${record.month}.pdf`);
};