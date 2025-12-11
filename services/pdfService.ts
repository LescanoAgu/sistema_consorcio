import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SettlementRecord, Unit, ExpenseDistributionType, ConsortiumSettings } from "../types";

// --- FUNCIÓN 1: REPORTE GENERAL ---
export const generateSettlementPDF = (record: SettlementRecord, consortiumName: string, units: Unit[], settings?: ConsortiumSettings) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(consortiumName, 14, 20);
  doc.setFontSize(14);
  doc.text("Liquidación de Expensas", 14, 30);
  doc.setFontSize(10);
  doc.text(`Período: ${record.month}`, pageWidth - 14, 20, { align: 'right' });
  doc.text(`Cierre: ${new Date(record.dateClosed).toLocaleDateString()}`, pageWidth - 14, 30, { align: 'right' });

  // Tabla Resumen
  const deficit = record.reserveDeficitCovered || 0;
  const summaryData = [
    ['Total Gastos del Mes', `$${record.totalExpenses.toFixed(2)}`],
    ['Total a Recaudar (Expensas)', `$${record.totalCollected.toFixed(2)}`],
    ['', ''], 
    ['FONDO DE RESERVA', ''],
    ['Saldo Inicial', `$${record.reserveBalanceStart.toFixed(2)}`],
    ['(-) Pagado con Fondo', `-$${record.reserveExpense.toFixed(2)}`],
    deficit > 0 ? ['(+) Recupero Déficit', `+$${deficit.toFixed(2)}`] : null,
    ['(=) Saldo Final', `$${record.reserveBalanceAtClose.toFixed(2)}`],
    ['', ''],
    ['(+) Aporte a Recaudar', `$${record.reserveContribution.toFixed(2)}`] 
  ].filter(Boolean); // Filtramos nulos

  autoTable(doc, {
    startY: 60,
    head: [['Concepto', 'Monto']],
    body: summaryData as any,
    theme: 'striped',
    headStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold' }
  });

  // Gastos
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Detalle de Gastos", 14, finalY);
  
  autoTable(doc, {
    startY: finalY + 5,
    head: [['Fecha', 'Descripción', 'Tipo', 'Monto']],
    body: record.snapshotExpenses.map(e => [
        e.date, e.description, 
        e.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario',
        e.distributionType === ExpenseDistributionType.FROM_RESERVE ? `($${e.amount.toFixed(2)})` : `$${e.amount.toFixed(2)}`
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }
  });

  // Prorrateo
  let tableY = (doc as any).lastAutoTable.finalY + 15;
  if (tableY > doc.internal.pageSize.height - 40) { doc.addPage(); tableY = 20; }
  
  doc.text("Prorrateo por Unidad", 14, tableY);
  
  autoTable(doc, {
    startY: tableY + 5,
    head: [['UF', 'Propietario', '%', 'A Pagar']],
    body: record.unitDetails.map(detail => {
        const u = units.find(unit => unit.id === detail.unitId);
        return [u?.unitNumber || '?', u?.ownerName || '', `${u?.proratePercentage.toFixed(2)}%`, `$${detail.totalToPay.toFixed(2)}`];
    }),
    theme: 'plain',
    headStyles: { fillColor: [229, 231, 235], textColor: 0 }
  });

  // Nota Administrativa
  if (record.couponMessage) {
      const msgY = (doc as any).lastAutoTable.finalY + 10;
      // Verificar si cabe en la página
      if (msgY < doc.internal.pageSize.height - 30) {
        doc.setFillColor(255, 251, 235);
        doc.rect(14, msgY, pageWidth - 28, 20, 'F');
        doc.setTextColor(50);
        doc.setFontSize(10);
        doc.text(`Nota: ${record.couponMessage}`, 18, msgY + 13);
      }
  }

  doc.save(`Liquidacion_${record.month}.pdf`);
};

// --- FUNCIÓN 2: CUPÓN INDIVIDUAL ---
export const generateIndividualCouponPDF = (
    record: SettlementRecord, unitId: string, consortiumName: string, units: Unit[], settings?: ConsortiumSettings
) => {
    const doc = new jsPDF();
    const unit = units.find(u => u.id === unitId);
    const detail = record.unitDetails.find(d => d.unitId === unitId);
    if (!unit || !detail) return;

    // Cálculos
    const pct = unit.proratePercentage / 100;
    
    // CORRECCIÓN DE TIPO: Usar el Enum explícito en el filter
    const ordinaryTotal = record.snapshotExpenses
        .filter(e => e.category === 'Ordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE)
        .reduce((a, b) => a + b.amount, 0);
    const ordinaryShare = ordinaryTotal * pct;

    const extraTotal = record.snapshotExpenses
        .filter(e => e.category === 'Extraordinary' && e.distributionType !== ExpenseDistributionType.FROM_RESERVE)
        .reduce((a, b) => a + b.amount, 0);
    const extraShare = extraTotal * pct;

    const reserveShare = (record.reserveContribution || 0) * pct;
    const deficitShare = (record.reserveDeficitCovered || 0) * pct;
    
    // Ajuste por redondeo
    const checkSum = ordinaryShare + extraShare + reserveShare + deficitShare;
    const diff = detail.totalToPay - checkSum;
    const finalOrdinaryShare = ordinaryShare + diff;

    // Vencimientos
    const total1 = detail.totalToPay;
    const surchargePct = record.secondExpirationSurcharge || 0;
    const total2 = total1 * (1 + (surchargePct / 100));

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("CUPÓN DE PAGO", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(consortiumName, 105, 30, { align: "center" });

    // Datos
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Propietario: ${unit.ownerName}`, 20, 60);
    doc.text(`UF: ${unit.unitNumber}`, 20, 70);
    doc.text(`Período: ${record.month}`, 140, 60);

    // Fechas de Vencimiento
    doc.setFontSize(11);
    const v1Date = record.firstExpirationDate ? new Date(record.firstExpirationDate).toLocaleDateString() : '-';
    doc.text(`1er Vto (${v1Date}):`, 120, 75);
    doc.setFont("helvetica", "bold");
    doc.text(`$${total1.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 165, 75);
    doc.setFont("helvetica", "normal");
    
    if (record.secondExpirationDate) {
        const v2Date = new Date(record.secondExpirationDate).toLocaleDateString();
        doc.text(`2do Vto (${v2Date}):`, 120, 82);
        doc.setFont("helvetica", "bold");
        doc.text(`$${total2.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 165, 82);
    }

    // Tabla Conceptos
    const tableBody = [];
    if (finalOrdinaryShare > 0.01) tableBody.push(['Expensas Ordinarias', `$${finalOrdinaryShare.toLocaleString('es-AR', {minimumFractionDigits: 2})}`]);
    if (extraShare > 0.01) tableBody.push(['Expensas Extraordinarias', `$${extraShare.toLocaleString('es-AR', {minimumFractionDigits: 2})}`]);
    if (deficitShare > 0.01) tableBody.push(['Recupero Saldo Fondo', `$${deficitShare.toLocaleString('es-AR', {minimumFractionDigits: 2})}`]);
    if (reserveShare > 0.01) tableBody.push(['Aporte Fondo Reserva', `$${reserveShare.toLocaleString('es-AR', {minimumFractionDigits: 2})}`]);

    autoTable(doc, { startY: 95, head: [['Concepto', 'Monto']], body: tableBody, theme: 'plain', styles: { fontSize: 11, cellPadding: 3 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } } });

    // Banco y Nota
    const bankY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFont("helvetica", "normal");
    
    if (settings) {
        doc.setFontSize(10);
        doc.text("DATOS DE PAGO:", 20, bankY);
        doc.text(`Banco: ${settings.bankName || '-'}`, 20, bankY + 7);
        doc.text(`Titular: ${settings.bankHolder || '-'}`, 20, bankY + 14);
        doc.setFont("helvetica", "bold");
        doc.text(`CBU: ${settings.bankCBU || '-'}`, 20, bankY + 24);
        doc.text(`Alias: ${settings.bankAlias || '-'}`, 20, bankY + 31);
    }

    if (record.couponMessage) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text(`Nota: ${record.couponMessage}`, 105, bankY + 50, { align: "center" });
    }

    doc.save(`Cupon_${unit.unitNumber}_${record.month}.pdf`);
};