import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// <-- Mantenemos las funciones de formato fuera -->
const formatCurrency = (value) => {
  // Aseguramos que sea número, si no, devolvemos 0 formateado o 'N/A'
  const numValue = Number(value);
  if (isNaN(numValue)) return formatCurrency(0); // O podrías devolver 'N/A'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(numValue);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  // Intentamos manejar si viene como objeto Date o string YYYY-MM-DD
  try {
    let date;
    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string' && dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
         // Aseguramos hora 0 para evitar problemas de zona horaria
        date = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      } else {
        return dateString; // Si no es YYYY-MM-DD, devolvemos como está
      }
    } else {
       return String(dateString); // Si no es reconocible, lo devolvemos
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formateando fecha en PDF:", dateString, error);
    return String(dateString); // Devolvemos el original si hay error
  }
};


// <-- La función principal ahora recibe 'liquidacionData' que es la PREVIEW COMPLETA -->
export const generarPDFLiquidacion = (unidad, liquidacionData, gastosIncluidos, itemCtaCte) => {
  const doc = new jsPDF();
  let finalY = 0; // <-- Variable para controlar la posición Y

  // --- 1. TÍTULO ---
  doc.setFontSize(18);
  doc.text(`Resumen de Expensas - ${liquidacionData.nombre}`, 14, 22);
  finalY = 22;

  // --- 2. DATOS DE LA UNIDAD ---
  doc.setFontSize(11);
  doc.text(`Propietario: ${unidad.propietario}`, 14, finalY + 10);
  doc.text(`Unidad Funcional: ${unidad.nombre}`, 14, finalY + 15);
  doc.text(`Porcentaje de Incidencia (Prorrateo): ${(unidad.porcentaje * 100).toFixed(4)} %`, 14, finalY + 20);
  finalY += 20;

  // --- 3. DETALLE DE GASTOS (Filtrado por tipo) ---
  // <-- Filtramos los gastos que corresponden a Ordinarios o Extra por Prorrateo -->
  const gastosComunes = gastosIncluidos.filter(g =>
     g.tipo === 'Ordinario' || (g.tipo === 'Extraordinario' && g.distribucion === 'Prorrateo')
  );
  // <-- Filtramos los gastos Extraordinarios Específicos para ESTA unidad -->
  const gastosExtraEspecificos = gastosIncluidos.filter(g =>
     g.tipo === 'Extraordinario' && g.distribucion === 'UnidadesEspecificas' && g.unidadesAfectadas?.includes(unidad.id)
  );

  // --- 3.A. Tabla de Gastos Comunes (Ordinarios + Extra Prorrateo) ---
  if (gastosComunes.length > 0) {
    finalY += 15;
    doc.setFontSize(14);
    doc.text('Detalle de Gastos Comunes (Prorrateados)', 14, finalY);
    finalY += 5;

    const bodyGastosComunes = gastosComunes.map(gasto => [
      formatDate(gasto.fecha), // <-- Usar formatDate
      gasto.concepto + (gasto.tipo === 'Extraordinario' ? ' (Extra)' : ''), // <-- Indicamos si es Extra
      gasto.proveedor,
      formatCurrency(gasto.monto)
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto']],
      body: bodyGastosComunes,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
      foot: [ // <-- Pie de tabla con desglose -->
          ['TOTAL GASTOS ORDINARIOS', '', '', formatCurrency(liquidacionData.totalGastosOrdinarios)],
          ['TOTAL GASTOS EXTRA (Prorrateo)', '', '', formatCurrency(liquidacionData.totalGastosExtraProrrateo)],
      ],
      footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
    });
    finalY = doc.lastAutoTable.finalY;
  }

  // --- 3.B. Tabla de Gastos Extraordinarios Específicos ---
  if (gastosExtraEspecificos.length > 0) {
    finalY += 10;
    doc.setFontSize(14);
    doc.setTextColor(192, 57, 43); // <-- Color distintivo (rojo)
    doc.text('Detalle de Gastos Extraordinarios Específicos (No Prorrateados)', 14, finalY);
    doc.setTextColor(0); // <-- Volver a negro
    finalY += 5;

    const bodyGastosExtra = gastosExtraEspecificos.map(gasto => [
      formatDate(gasto.fecha),
      gasto.concepto,
      gasto.proveedor,
      formatCurrency(gasto.monto)
    ]);

     // <-- Calculamos el total de estos gastos específicos -->
     const totalEspecificos = gastosExtraEspecificos.reduce((sum, g) => sum + g.monto, 0);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto']],
      body: bodyGastosExtra,
      theme: 'striped',
      headStyles: { fillColor: [192, 57, 43] }, // <-- Cabecera roja
       foot: [[
         'TOTAL GASTOS EXTRA ESPECÍFICOS (Para su unidad)',
         '', '',
         formatCurrency(totalEspecificos)
       ]],
       footStyles: { fillColor: [255, 235, 238], textColor: 0, fontStyle: 'bold' } // <-- Pie rojo claro
    });
    finalY = doc.lastAutoTable.finalY;
  }


  // --- 4. RESUMEN DEL CÁLCULO (MODIFICADO) ---
  finalY += 10;
  doc.setFontSize(12);
  doc.text('Resumen de Cálculo para su Unidad', 14, finalY);
  finalY += 5;

  // <-- Calculamos los montos prorrateados para esta unidad -->
  const montoOrdinarioUnidad = liquidacionData.totalGastosOrdinarios * unidad.porcentaje;
  const montoFondoUnidad = liquidacionData.montoFondoReservaCalculado * unidad.porcentaje;
  const montoExtraProrrateoUnidad = liquidacionData.totalGastosExtraProrrateo * unidad.porcentaje;
  // <-- El total específico ya lo calculamos antes -->
  const montoExtraEspecificoUnidad = gastosExtraEspecificos.reduce((sum, g) => sum + g.monto, 0);

  // <-- El total a pagar es la suma de todo lo que le corresponde -->
  //    (Coincide con itemCtaCte.montoVencimiento1 si todo está bien)
  const montoTotalUnidad = montoOrdinarioUnidad + montoFondoUnidad + montoExtraProrrateoUnidad + montoExtraEspecificoUnidad;

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
      0: { fontStyle: 'bold', cellWidth: 120 }, // <-- Más ancho para etiquetas largas
      1: { halign: 'right' }
    },
     didParseCell: function (data) { // <-- Para resaltar la fila del total
        if (data.row.index === resumenData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 230, 230];
            data.cell.styles.textColor = 0;
        }
    }
  });
  finalY = doc.lastAutoTable.finalY;


  // --- 5. ESTADO DEL FONDO DE RESERVA (NUEVO) ---
  // Verificamos si tenemos la info del fondo
  if (liquidacionData.saldoFondoInicial !== undefined && liquidacionData.saldoFondoFinal !== undefined) {
      finalY += 10;
      doc.setFontSize(10);
      doc.setTextColor(100); // <-- Gris
      doc.text('Estado del Fondo de Reserva del Consorcio (Informativo)', 14, finalY);
      doc.setTextColor(0);
      finalY += 5;

      const fondoData = [
          ['Saldo Inicial', formatCurrency(liquidacionData.saldoFondoInicial)],
          ['(-) Gastos Cubiertos por Fondo', formatCurrency(liquidacionData.totalGastosExtraFondo)],
          ['(+) Aporte del Período', formatCurrency(liquidacionData.montoFondoReservaCalculado)],
          ['Saldo Final Estimado', formatCurrency(liquidacionData.saldoFondoFinal)],
      ];

       autoTable(doc, {
         startY: finalY,
         theme: 'plain', // <-- Más simple
         styles: { fontSize: 8, cellPadding: 1 }, // <-- Más pequeño
         body: fondoData,
         columnStyles: {
           1: { halign: 'right' }
         },
          didParseCell: function (data) {
             if (data.row.index === fondoData.length - 1) { // <-- Resaltar saldo final
                 data.cell.styles.fontStyle = 'bold';
             }
         }
       });
       finalY = doc.lastAutoTable.finalY;
  }

  // --- 6. CUPÓN DE PAGO (Ajustamos posición Y) ---
  // <-- Aseguramos que haya espacio, si no, añadimos página -->
  if (finalY > 240) { // <-- Si estamos muy abajo
    doc.addPage();
    finalY = 15; // <-- Empezamos arriba en la nueva página
  } else {
    finalY += 15; // <-- Dejamos espacio
  }

  doc.setDrawColor(0);
  doc.setFillColor(240, 240, 240);
  doc.rect(10, finalY, 190, 40, 'F'); // Fondo gris

  doc.setFontSize(16);
  doc.text(`CUPÓN DE PAGO - ${liquidacionData.nombre}`, 14, finalY + 10);
  doc.setFontSize(12);
  doc.text(`Unidad: ${unidad.nombre}`, 14, finalY + 17);

  // Datos del Cupón (como antes)
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('1er Vencimiento:', 110, finalY + 10);
  doc.text(formatDate(itemCtaCte.vencimiento1), 150, finalY + 10); // <-- Usar formatDate
  // <-- Mostramos el monto TOTAL calculado (debe coincidir con vencimiento1) -->
  doc.text(formatCurrency(montoTotalUnidad), 150, finalY + 17);

  doc.text('2do Vencimiento:', 110, finalY + 27);
  doc.text(formatDate(itemCtaCte.vencimiento2), 150, finalY + 27); // <-- Usar formatDate
  // <-- Calculamos el 2do vencimiento basado en el total -->
  const montoVencimiento2 = montoTotalUnidad * (1 + (liquidacionData.pctRecargo || 0)); // Usa pctRecargo de liquidacionData
  doc.text(formatCurrency(montoVencimiento2), 150, finalY + 34);

  // --- 7. DEVOLVER EL BLOB ---
  return doc.output('blob');
};