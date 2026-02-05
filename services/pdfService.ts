import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SettlementRecord, Unit, ConsortiumSettings } from '../types';

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

// --- AUXILIAR: Convertir URL de imagen a Base64 para el PDF ---
const getImageDataUrl = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Error cargando logo:", e);
        return '';
    }
};

// --- 1. GENERAR LIQUIDACIÓN GENERAL (EXPENSA) ---
export const generateSettlementPDF = async (
  record: SettlementRecord,
  consortiumName: string,
  units: Unit[],
  settings: ConsortiumSettings
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.width;

  // --- LOGO (Si existe) ---
  if (settings.logoUrl) {
      const logoData = await getImageDataUrl(settings.logoUrl);
      if (logoData) {
          // Posición X, Posición Y, Ancho, Alto
          doc.addImage(logoData, 'PNG', 14, 10, 20, 20); 
      }
  }

  // --- HEADER ---
  const textStartX = settings.logoUrl ? 40 : 14; // Si hay logo, movemos texto a la derecha
  
  doc.setFontSize(18);
  doc.text(consortiumName, textStartX, 20);
  
  doc.setFontSize(10);
  doc.text(settings.address || 'Dirección no configurada', textStartX, 26);
  if (settings.cuit) doc.text(`CUIT: ${settings.cuit}`, textStartX, 31);
  if (settings.adminName) doc.text(`Adm: ${settings.adminName}`, textStartX, 36);

  doc.setFontSize(12);
  const headerY = settings.cuit ? 45 : 40; 
  doc.text(`Liquidación de Expensas: ${record.month}`, 14, headerY);
  doc.setFontSize(10);
  doc.text(`Fecha de Cierre: ${new Date(record.dateClosed).toLocaleDateString()}`, 14, headerY + 6);

  // --- RESUMEN FINANCIERO ---
  const summaryY = headerY + 12;
  doc.setFillColor(240, 240, 240);
  doc.rect(14, summaryY, pageWidth - 28, 25, 'F');
  
  doc.setFontSize(10);
  doc.text("RESUMEN DEL PERÍODO", 18, summaryY + 8);
  
  doc.setFontSize(9);
  doc.text(`Total Gastos:`, 18, summaryY + 15);
  doc.text(formatCurrency(record.totalExpenses), 80, summaryY + 15);
  doc.text(`Fondo Reserva (Nuevo Saldo):`, 18, summaryY + 20);
  doc.text(formatCurrency(record.reserveBalanceAtClose), 80, summaryY + 20);
  
  let currentY = summaryY + 35;

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

  // --- TABLA DE PRORRATEO ---
  doc.setFontSize(12);
  doc.text("Distribución por Unidad (Prorrateo)", 14, currentY);
  currentY += 5;

  const distributionData = record.unitDetails.map(detail => {
    const unit = units.find(u => u.id === detail.unitId);
    return [
      unit?.unitNumber || '?',
      unit?.ownerName || '?',
      `${unit?.proratePercentage}%`,
      formatCurrency(detail.totalToPay)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Unidad', 'Propietario', '%', 'Total a Pagar']],
    body: distributionData,
    theme: 'striped',
    headStyles: { fillColor: [46, 125, 50] },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // --- DATOS BANCARIOS ---
  if (settings.bankCBU) {
      doc.setFillColor(230, 240, 255);
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

  doc.save(`Expensas_${consortiumName}_${record.month}.pdf`);
};

// --- 2. GENERAR CUPÓN INDIVIDUAL ---
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

    if (!unit || !detail) return alert("Datos de unidad no encontrados");

    // LOGO EN CUPON
    if (settings.logoUrl) {
        const logoData = await getImageDataUrl(settings.logoUrl);
        if (logoData) doc.addImage(logoData, 'PNG', 15, 15, 15, 15);
    }

    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 130);

    const textX = settings.logoUrl ? 35 : 20;

    doc.setFontSize(16);
    doc.text(consortiumName, textX, 20);
    doc.setFontSize(10);
    doc.text(settings.address || '', textX, 26);
    doc.text(`CUPÓN DE PAGO - ${record.month}`, 150, 20);

    doc.setFontSize(12);
    doc.text(`Unidad: ${unit.unitNumber}`, 20, 45);
    doc.text(`Propietario: ${unit.ownerName}`, 20, 52);
    doc.text(`Porcentaje: ${unit.proratePercentage}%`, 150, 45);

    doc.line(10, 60, 200, 60);
    
    doc.setFontSize(14);
    doc.text("A PAGAR", 20, 75);
    doc.setFontSize(22);
    doc.text(formatCurrency(detail.totalToPay), 150, 75, { align: 'right' });

    const cierre = new Date(record.dateClosed);
    const vto1 = new Date(cierre); vto1.setDate(cierre.getDate() + 10);
    
    doc.setFontSize(10);
    doc.text(`Vencimiento: ${vto1.toLocaleDateString()}`, 20, 90);

    if (settings.bankCBU) {
        doc.setFillColor(245, 245, 245);
        doc.rect(20, 100, 170, 30, 'F');
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        doc.text(`Depositar en: ${settings.bankName}`, 25, 110);
        doc.text(`CBU: ${settings.bankCBU}`, 25, 117);
        doc.text(`Alias: ${settings.bankAlias}`, 25, 124);
    }

    doc.save(`Cupon_${unit.unitNumber}_${record.month}.pdf`);
};