import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// ¡Necesitamos el servicio del fondo para la Hoja 2!
import { getHistorialFondo } from '../services/fondoService'; 

// --- Funciones de Formato ---
const formatCurrency = (value) => {
  const numValue = Number(value);
  if (isNaN(numValue)) return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(0);
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numValue);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    let date;
    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string' && dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        date = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      } else { return dateString; }
    } else { return String(dateString); }
    
    // Formato dd/mm/aaaa
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return String(dateString);
  }
};

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

// --- Generador de PDF (¡AHORA ES ASÍNCRONO!) ---
export const generarPDFLiquidacion = async (unidad, liquidacionData, gastosIncluidos, itemCtaCte) => {
  const doc = new jsPDF();
  let finalY = 0; 

  // --- HOJA 1: CUPÓN DE PAGO ---
  
  // 1. TÍTULO
  doc.setFontSize(18);
  doc.text(`LIQUIDACIÓN EXPENSAS - ${liquidacionData.nombre}`, 14, 22);
  finalY = 22;

  // 2. DATOS DE LA UNIDAD
  doc.setFontSize(11);
  doc.text(`Propietario: ${unidad.propietario}`, 14, finalY + 10);
  doc.text(`Unidad Funcional: ${unidad.nombre}`, 14, finalY + 15);
  doc.text(`Porcentaje de Incidencia (Prorrateo): ${(unidad.porcentaje * 100).toFixed(4)} %`, 14, finalY + 20);
  finalY += 20;

  // 3. DETALLE DE GASTOS (Filtrado)
  const gastosComunes = gastosIncluidos.filter(g =>
     g.tipo === 'Ordinario' || (g.tipo === 'Extraordinario' && g.distribucion === 'Prorrateo')
  );
  const gastosExtraEspecificos = gastosIncluidos.filter(g =>
     g.tipo === 'Extraordinario' && g.distribucion === 'UnidadesEspecificas' && g.unidadesAfectadas?.includes(unidad.id)
  );

  // 3.A. Tabla de Gastos Comunes (Prorrateados)
  if (gastosComunes.length > 0) {
    finalY += 15;
    doc.setFontSize(14);
    doc.text('DETALLE DE GASTOS ORDINARIOS (Prorrateados)', 14, finalY);
    finalY += 5;

    const bodyGastosComunes = gastosComunes.map(gasto => [
      formatDate(gasto.fecha),
      gasto.concepto + (gasto.tipo === 'Extraordinario' ? ' (Extra)' : ''),
      gasto.proveedor,
      formatCurrency(gasto.monto)
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto']],
      body: bodyGastosComunes,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
      foot: [
          ['TOTAL GASTOS ORDINARIOS', '', '', formatCurrency(liquidacionData.totalGastosOrdinarios)],
          ['TOTAL GASTOS EXTRA (Prorrateo)', '', '', formatCurrency(liquidacionData.totalGastosExtraProrrateo)],
      ],
      footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
    });
    finalY = doc.lastAutoTable.finalY;
  }
  
  // 3.B. Tabla de Gastos Extraordinarios (Específicos)
  if (gastosExtraEspecificos.length > 0) {
    finalY += 10;
    doc.setFontSize(14);
    doc.setTextColor(192, 57, 43); // Rojo
    doc.text('DETALLE DE GASTOS EXTRAORDINARIOS (Específicos)', 14, finalY);
    doc.setTextColor(0); 
    finalY += 5;

    const bodyGastosExtra = gastosExtraEspecificos.map(gasto => [
      formatDate(gasto.fecha),
      gasto.concepto,
      gasto.proveedor,
      formatCurrency(gasto.monto)
    ]);

     const totalEspecificos = gastosExtraEspecificos.reduce((sum, g) => sum + g.monto, 0);
     // El monto que PAGA la unidad (dividido)
     const montoEspecificoUnidad = (itemCtaCte.desglose?.extraEspecifico || 0);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto Total Gasto']],
      body: bodyGastosExtra,
      theme: 'striped',
      headStyles: { fillColor: [192, 57, 43] },
       foot: [[
         'MONTO ASIGNADO A SU UNIDAD (División por Iguales)',
         '', '',
         formatCurrency(montoEspecificoUnidad)
       ]],
       footStyles: { fillColor: [255, 235, 238], textColor: 0, fontStyle: 'bold' }
    });
    finalY = doc.lastAutoTable.finalY;
  }

  // 4. RESUMEN DE CÁLCULO
  finalY += 10;
  doc.setFontSize(12);
  doc.text('Resumen de Cálculo para su Unidad', 14, finalY);
  finalY += 5;

  // Leemos el desglose del itemCtaCte (que se guardó en la transacción)
  const desglose = itemCtaCte.desglose || {};
  const montoOrdinarioUnidad = desglose.ordinario || 0;
  const montoFondoUnidad = desglose.aporteFondo || 0;
  const montoExtraProrrateoUnidad = desglose.extraProrrateo || 0;
  const montoExtraEspecificoUnidad = desglose.extraEspecifico || 0;
  const montoTotalUnidad = Math.abs(itemCtaCte.monto); // El total es el monto del item

  const resumenData = [
    ['Total Gastos Ordinarios (Prorrateado)', formatCurrency(montoOrdinarioUnidad)],
    ['(+) Aporte Fondo Reserva (Prorrateado)', formatCurrency(montoFondoUnidad)],
    ['(+) Gastos Extra (Prorrateado)', formatCurrency(montoExtraProrrateoUnidad)],
    ['(+) Gastos Extra (Específicos)', formatCurrency(montoExtraEspecificoUnidad)],
    ['MONTO TOTAL CORRESPONDIENTE A SU UNIDAD', formatCurrency(montoTotalUnidad)],
  ];

  autoTable(doc, {
    startY: finalY,
    theme: 'grid',
    styles: { fontSize: 10 },
    body: resumenData,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 120 }, 
      1: { halign: 'right' }
    },
     didParseCell: function (data) { 
        if (data.row.index === resumenData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 230, 230];
            data.cell.styles.textColor = 0;
        }
    }
  });
  finalY = doc.lastAutoTable.finalY;

  // 5. CUPÓN DE PAGO Y COMENTARIOS
  finalY += 15;
  doc.setDrawColor(0);
  doc.setFillColor(240, 240, 240);
  
  // Calcular alto de comentarios
  let lineasComentarios = [];
  let altoComentarios = 0;
  if (liquidacionData.comentarios) {
    lineasComentarios = doc.splitTextToSize(liquidacionData.comentarios, 170); // Ancho de 170px
    altoComentarios = (lineasComentarios.length * 4) + 5; // 4mm por línea + 5mm padding
  }
  
  doc.rect(10, finalY, 190, 40 + altoComentarios, 'F'); // Fondo gris

  doc.setFontSize(16);
  doc.text(`CUPÓN DE PAGO - ${liquidacionData.nombre}`, 14, finalY + 10);
  doc.setFontSize(12);
  doc.text(`Unidad: ${unidad.nombre}`, 14, finalY + 17);

  // Vencimientos
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('1er Vencimiento:', 110, finalY + 10);
  doc.text(formatDate(itemCtaCte.vencimiento1), 150, finalY + 10); 
  doc.text(formatCurrency(montoTotalUnidad), 150, finalY + 17);

  doc.text('2do Vencimiento:', 110, finalY + 27);
  doc.text(formatDate(itemCtaCte.vencimiento2), 150, finalY + 27);
  const montoVencimiento2 = montoTotalUnidad * (1 + (liquidacionData.pctRecargo || 0));
  doc.text(formatCurrency(montoVencimiento2), 150, finalY + 34);
  
  // Mostrar Comentarios
  if (liquidacionData.comentarios) {
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50); // Gris oscuro
    doc.text(lineasComentarios, 14, finalY + 45);
  }
  finalY += (40 + altoComentarios); // Alto total del cupón


  // --- HOJA 2: BALANCE DEL FONDO DE RESERVA ---
  
  doc.addPage();
  finalY = 22;

  doc.setFontSize(18);
  doc.text(`Informe del Fondo de Reserva - ${liquidacionData.nombre}`, 14, finalY);

  doc.setFontSize(10);
  doc.setFont(undefined, 'italic');
  doc.setTextColor(100);
  doc.text(
    "Nota: El Saldo del Fondo de Reserva se calcula en base a lo PERCIBIDO (cobrado) y GASTADO (ejecutado).",
    14, finalY + 7
  );
  doc.setTextColor(0);
  doc.setFont(undefined, 'normal');
  finalY += 15;

  // Mostramos el resumen de saldos
  const resumenFondo = [
    ['Saldo Inicial del Fondo (al inicio de esta liquidación)', formatCurrency(liquidacionData.saldoFondoInicial)],
    ['(-) Gastos Cubiertos por el Fondo (en este período)', formatCurrency(liquidacionData.totalGastosExtraFondo)],
    ['SALDO FINAL DEL FONDO (al cierre de esta liquidación)', formatCurrency(liquidacionData.saldoFondoFinal)],
  ];

  autoTable(doc, {
    startY: finalY,
    theme: 'grid',
    styles: { fontSize: 10 },
    body: resumenFondo,
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
     didParseCell: function (data) { 
        if (data.row.index === resumenFondo.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 230, 230];
        }
    }
  });
  finalY = doc.lastAutoTable.finalY;

  // --- Historial de Movimientos del Fondo (¡Llamada Async!) ---
  finalY += 15;
  doc.setFontSize(14);
  doc.text('Historial de Movimientos del Fondo (Últimos 50)', 14, finalY);
  finalY += 5;

  try {
    // Usamos una Promise para manejar el callback de onSnapshot
    const historial = await new Promise((resolve, reject) => {
      // Pedimos el historial, pero getHistorialFondo usa onSnapshot (tiempo real)
      // Para un PDF, solo queremos los datos UNA VEZ.
      const unsubscribe = getHistorialFondo((movimientos, err) => {
        unsubscribe(); // ¡Nos desuscribimos inmediatamente!
        if (err) {
          reject(err);
        } else {
          resolve(movimientos);
        }
      });
    });

    const bodyHistorial = historial.slice(0, 50).map(mov => [ // Limitamos a 50
      formatDateTime(mov.fecha),
      mov.concepto,
      mov.gastoId ? `Gasto: ${mov.gastoId.substring(0, 5)}` : (mov.liquidacionId ? `Liq: ${mov.liquidacionId.substring(0, 5)}` : '-'),
      formatCurrency(mov.monto)
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Referencia', 'Monto']],
      body: bodyHistorial,
      theme: 'striped',
      headStyles: { fillColor: [80, 80, 80] },
      columnStyles: { 3: { halign: 'right' } }
    });

  } catch (error) {
    console.error("Error al obtener historial del fondo para el PDF:", error);
    doc.text("No se pudo cargar el historial de movimientos.", 14, finalY);
  }

  // --- 7. DEVOLVER EL BLOB ---
  return doc.output('blob');
};