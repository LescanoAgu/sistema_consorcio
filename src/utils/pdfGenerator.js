import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Importamos el plugin de tablas

// Función para formatear moneda (la copiamos de los componentes)
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(value);
};

// Función para formatear fechas (dd/mm/aaaa)
const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Genera un PDF de liquidación para una unidad específica
 * @param {object} unidad - El objeto de la unidad (propietario, nombre, etc.)
 * @param {object} liquidacion - El objeto de la liquidación (nombre, totales)
 * @param {array} gastos - La lista de gastos de esta liquidación
 * @param {object} itemCtaCte - El item de Cta. Cte. con los montos y vencimientos
 */
export const generarPDFLiquidacion = (unidad, liquidacion, gastos, itemCtaCte) => {
  const doc = new jsPDF(); // Crea el documento PDF

  // --- 1. TÍTULO ---
  doc.setFontSize(18);
  doc.text(`Resumen de Expensas - ${liquidacion.nombre}`, 14, 22);

  // --- 2. DATOS DE LA UNIDAD ---
  doc.setFontSize(11);
  doc.text(`Propietario: ${unidad.propietario}`, 14, 32);
  doc.text(`Unidad Funcional: ${unidad.nombre}`, 14, 37);
  doc.text(`Porcentaje de Incidencia: ${(unidad.porcentaje * 100).toFixed(4)} %`, 14, 42);

  // --- 3. DETALLE DE GASTOS DEL PERÍODO ---
  doc.setFontSize(14);
  doc.text('Detalle de Gastos Comunes', 14, 55);

  // Preparamos los datos para la tabla de gastos
  const bodyGastos = gastos.map(gasto => [
    gasto.fecha,
    gasto.concepto,
    gasto.proveedor,
    formatCurrency(gasto.monto)
  ]);
  
  // Usamos autoTable para dibujar la tabla
  doc.autoTable({
    startY: 60,
    head: [['Fecha', 'Concepto', 'Proveedor', 'Monto']],
    body: bodyGastos,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    foot: [[
      'TOTAL GASTOS ORDINARIOS', 
      '', '', 
      formatCurrency(liquidacion.totalGastos)
    ]],
    footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
  });

  // --- 4. RESUMEN DEL PRORRATEO ---
  let finalY = doc.lastAutoTable.finalY + 10; // Posición después de la tabla
  doc.setFontSize(12);
  doc.text('Resumen de Cálculo', 14, finalY);

  const resumenData = [
    ['Total Gastos Ordinarios', formatCurrency(liquidacion.totalGastos)],
    [`(+) Fondo de Reserva (${(liquidacion.montoFondo / liquidacion.totalGastos * 100).toFixed(2)}%)`, formatCurrency(liquidacion.montoFondo)],
    ['TOTAL A PRORRATEAR', formatCurrency(liquidacion.totalAProrratear)],
    ['MONTO CORRESPONDIENTE A SU UNIDAD', formatCurrency(itemCtaCte.montoVencimiento1)],
  ];
  
  doc.autoTable({
    startY: finalY + 5,
    theme: 'grid',
    styles: { fontSize: 10 },
    body: resumenData,
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' }
    }
  });

  // --- 5. CUPÓN DE PAGO (Como en tu CUPONES.csv) ---
  finalY = doc.lastAutoTable.finalY + 15;
  doc.setDrawColor(0);
  doc.setFillColor(240, 240, 240);
  doc.rect(10, finalY, 190, 40, 'F'); // Un rectángulo de fondo

  doc.setFontSize(16);
  doc.text(`CUPÓN DE PAGO - ${liquidacion.nombre}`, 14, finalY + 10);
  doc.setFontSize(12);
  doc.text(`Unidad: ${unidad.nombre}`, 14, finalY + 17);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('1er Vencimiento:', 110, finalY + 10);
  doc.text(formatDate(itemCtaCte.vencimiento1), 150, finalY + 10);
  doc.text(formatCurrency(itemCtaCte.montoVencimiento1), 150, finalY + 17);
  
  doc.text('2do Vencimiento:', 110, finalY + 27);
  doc.text(formatDate(itemCtaCte.vencimiento2), 150, finalY + 27);
  doc.text(formatCurrency(itemCtaCte.montoVencimiento2), 150, finalY + 34);
  
  // --- 6. GUARDAR EL ARCHIVO ---
  doc.save(`Expensa-${liquidacion.nombre}-${unidad.nombre}.pdf`);
};