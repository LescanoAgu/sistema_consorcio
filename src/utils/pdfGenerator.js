import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getHistorialFondo } from '../services/fondoService'; 

// --- Funciones de Formato (Existentes) ---
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
        date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
      } else if (parts.length === 2) {
        const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
        return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(dateObj);
      } else { 
        return dateString; 
      }
    } else { 
      return String(dateString); 
    }
    
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return String(dateString);
  }
};

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

// --- INICIO CORRECCIÓN 1: PDF DE LIQUIDACIÓN (CUPÓN DE PAGO) ---

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

  // 3. DETALLE DE GASTOS (Filtrado y separado como solicitaste)
  
  const gastosOrdinarios = gastosIncluidos.filter(g =>
     g.tipo === 'Ordinario'
  );
  const gastosExtraProrrateo = gastosIncluidos.filter(g =>
     g.tipo === 'Extraordinario' && g.distribucion === 'Prorrateo'
  );
  const gastosExtraEspecificos = gastosIncluidos.filter(g =>
     g.tipo === 'Extraordinario' && g.distribucion === 'UnidadesEspecificas' && g.unidadesAfectadas?.includes(unidad.id)
  );

  // 3.A. Tabla de Gastos Ordinarios
  if (gastosOrdinarios.length > 0) {
    finalY += 15;
    doc.setFontSize(14);
    doc.text('DETALLE DE GASTOS ORDINARIOS', 14, finalY);
    finalY += 5;

    const bodyGastos = gastosOrdinarios.map(g => [
      formatDate(g.fecha), g.concepto, g.proveedor, formatCurrency(g.monto)
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto']],
      body: bodyGastos,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }, // Azul
      foot: [
          ['TOTAL GASTOS ORDINARIOS', '', '', formatCurrency(liquidacionData.totalGastosOrdinarios)],
      ],
      footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }
    });
    finalY = doc.lastAutoTable.finalY;
  }
  
  // 3.B. Tabla de Gastos Extraordinarios (Prorrateados)
  if (gastosExtraProrrateo.length > 0) {
    finalY += 10;
    doc.setFontSize(14);
    doc.setTextColor(230, 126, 34); // Naranja
    doc.text('DETALLE DE GASTOS EXTRAORDINARIOS (Prorrateados)', 14, finalY);
    doc.setTextColor(0); 
    finalY += 5;

    const bodyGastos = gastosExtraProrrateo.map(g => [
      formatDate(g.fecha), g.concepto, g.proveedor, formatCurrency(g.monto)
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto']],
      body: bodyGastos,
      theme: 'striped',
      headStyles: { fillColor: [230, 126, 34] }, // Naranja
      foot: [
          ['TOTAL GASTOS EXTRA (Prorrateo)', '', '', formatCurrency(liquidacionData.totalGastosExtraProrrateo)],
      ],
      footStyles: { fillColor: [253, 237, 219], textColor: 0, fontStyle: 'bold' }
    });
    finalY = doc.lastAutoTable.finalY;
  }

  // 3.C. Tabla de Gastos Extraordinarios (Específicos de esta unidad)
  if (gastosExtraEspecificos.length > 0) {
    finalY += 10;
    doc.setFontSize(14);
    doc.setTextColor(192, 57, 43); // Rojo
    doc.text('DETALLE DE GASTOS EXTRAORDINARIOS (Específicos)', 14, finalY);
    doc.setTextColor(0); 
    finalY += 5;

    const bodyGastos = gastosExtraEspecificos.map(gasto => [
      formatDate(gasto.fecha),
      gasto.concepto,
      gasto.proveedor,
      formatCurrency(gasto.monto) // Monto total del gasto
    ]);

     // El monto que PAGA la unidad (dividido)
     const montoEspecificoUnidad = (itemCtaCte.desglose?.extraEspecifico || 0);

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Concepto', 'Proveedor', 'Monto Total Gasto']],
      body: bodyGastos,
      theme: 'striped',
      headStyles: { fillColor: [192, 57, 43] }, // Rojo
       foot: [[
         'MONTO ASIGNADO A SU UNIDAD (División por Iguales)',
         '', '',
         formatCurrency(montoEspecificoUnidad)
       ]],
       footStyles: { fillColor: [255, 235, 238], textColor: 0, fontStyle: 'bold' }
    });
    finalY = doc.lastAutoTable.finalY;
  }

  // 4. RESUMEN DE CÁLCULO (Ahora 100% granular)
  finalY += 10;
  doc.setFontSize(12);
  doc.text('Resumen de Cálculo para su Unidad', 14, finalY);
  finalY += 5;

  const desglose = itemCtaCte.desglose || {};
  const montoOrdinarioUnidad = desglose.ordinario || 0;
  const montoFondoUnidad = desglose.aporteFondo || 0;
  const montoExtraProrrateoUnidad = desglose.extraProrrateo || 0;
  const montoExtraEspecificoUnidad = desglose.extraEspecifico || 0;
  const montoTotalUnidad = Math.abs(itemCtaCte.monto);

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

  // 5. CUPÓN DE PAGO Y COMENTARIOS (Sin cambios)
  finalY += 15;
  doc.setDrawColor(0);
  doc.setFillColor(240, 240, 240);
  
  let lineasComentarios = [];
  let altoComentarios = 0;
  if (liquidacionData.comentarios) {
    lineasComentarios = doc.splitTextToSize(liquidacionData.comentarios, 170);
    altoComentarios = (lineasComentarios.length * 4) + 5;
  }
  
  doc.rect(10, finalY, 190, 40 + altoComentarios, 'F'); 

  doc.setFontSize(16);
  doc.text(`CUPÓN DE PAGO - ${liquidacionData.nombre}`, 14, finalY + 10);
  doc.setFontSize(12);
  doc.text(`Unidad: ${unidad.nombre}`, 14, finalY + 17);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('1er Vencimiento:', 110, finalY + 10);
  doc.text(formatDate(itemCtaCte.vencimiento1), 150, finalY + 10); 
  doc.text(formatCurrency(montoTotalUnidad), 150, finalY + 17);

  doc.text('2do Vencimiento:', 110, finalY + 27);
  doc.text(formatDate(itemCtaCte.vencimiento2), 150, finalY + 27);
  const montoVencimiento2 = montoTotalUnidad * (1 + (liquidacionData.pctRecargo || 0));
  doc.text(formatCurrency(montoVencimiento2), 150, finalY + 34);
  
  if (liquidacionData.comentarios) {
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(lineasComentarios, 14, finalY + 45);
  }
  finalY += (40 + altoComentarios);


  // --- HOJA 2: BALANCE DEL FONDO DE RESERVA (Sin cambios) ---
  
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

  // --- Historial de Movimientos del Fondo (Sin cambios) ---
  finalY += 15;
  doc.setFontSize(14);
  doc.text('Historial de Movimientos del Fondo (Últimos 50)', 14, finalY);
  finalY += 5;

  try {
    const historial = await new Promise((resolve, reject) => {
      const unsubscribe = getHistorialFondo((movimientos, err) => {
        unsubscribe();
        if (err) {
          reject(err);
        } else {
          resolve(movimientos);
        }
      });
    });

    const bodyHistorial = historial.slice(0, 50).map(mov => [ 
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

// --- FIN CORRECCIÓN 1 ---


// --- INICIO CORRECCIÓN 2: PDF DE DEUDA ---

/**
 * Genera un PDF de Estado de Deuda (Informe Legal).
 * @param {object} unidad - El objeto de la unidad (con .nombre, .propietario, .saldo)
 * @param {Array} movimientos - El array de movimientos de la cta. cte.
 */
export const generarPDFEstadoDeuda = async (unidad, movimientos) => {
  // --- PÁGINA 1 (Portrait) ---
  const doc = new jsPDF('portrait');
  let finalY = 0;

  // --- 1. TÍTULO Y DATOS ---
  doc.setFontSize(18);
  doc.text('Informe de Cuenta Corriente y Estado de Deuda', 14, 22);
  finalY = 22;
  doc.setFontSize(11);
  doc.text(`Propietario: ${unidad.propietario}`, 14, finalY + 10);
  doc.text(`Unidad Funcional: ${unidad.nombre}`, 14, finalY + 15);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`, 14, finalY + 20);
  finalY += 20;

  // --- 2. RESUMEN DE SALDO (Punto 5.A) ---
  finalY += 10;
  doc.setFontSize(14);
  doc.text('Resumen de Deuda Pendiente de Pago', 14, finalY);
  finalY += 5;

  let totalBasePendiente = 0;
  let totalInteresPendiente = 0; // Unificamos los intereses en el resumen

  const movimientosPendientes = movimientos.filter(m => m.pagado === false && m.monto < 0);

  movimientosPendientes.forEach(mov => {
    const montoPendiente = Math.abs(mov.monto) - (mov.montoAplicado || 0);
    
    // --- INICIO CORRECCIÓN (FIX LÓGICA RESUMEN) ---
    // Si tiene tipo Y es un interés...
    if (mov.tipo && (mov.tipo === 'INTERES_10' || mov.tipo === 'INTERES_BNA')) {
      totalInteresPendiente += montoPendiente;
    } 
    // Si es tipo BASE o NO TIENE TIPO (deuda antigua)
    else {
      totalBasePendiente += montoPendiente;
    }
    // --- FIN CORRECCIÓN (FIX LÓGICA RESUMEN) ---
  });

  const resumenData = [
    ['Total Capital (Expensas Base) Pendiente:', formatCurrency(totalBasePendiente)],
    ['Total Intereses (Mora) Pendiente:', formatCurrency(totalInteresPendiente)],
  ];

  autoTable(doc, {
    startY: finalY,
    theme: 'grid',
    styles: { fontSize: 10 },
    body: resumenData,
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
  });
  finalY = doc.lastAutoTable.finalY;

  const saldoTextY = finalY + 10; 
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(192, 57, 43); // Rojo
  doc.text(`SALDO TOTAL ADEUDADO: ${formatCurrency(unidad.saldo)}`, 105, saldoTextY, { align: 'center' });
  doc.setTextColor(0);
  doc.setFont(undefined, 'normal');
  finalY = saldoTextY + 10; 


  // --- 3. DETALLE DE PAGOS RECIBIDOS (En Página 1) ---
  doc.setFontSize(14);
  doc.text('Detalle de Pagos Recibidos', 14, finalY);
  finalY += 5;

  const pagos = movimientos.filter(m => m.tipo === 'PAGO_RECIBIDO');
  const bodyPagos = pagos.map(mov => [
      formatDateTime(mov.fecha),
      mov.concepto,
      formatCurrency(mov.monto)
  ]);

  if (bodyPagos.length > 0) {
    autoTable(doc, {
      startY: finalY,
      head: [['Fecha de Pago', 'Concepto', 'Monto Acreditado']],
      body: bodyPagos,
      theme: 'striped',
      headStyles: { fillColor: [39, 174, 96] }, // Verde
      columnStyles: {
        2: { halign: 'right' }
      }
    });
    finalY = doc.lastAutoTable.finalY;
  } else {
    doc.text("No se registraron pagos en este período.", 14, finalY);
    finalY += 5;
  }


  // --- PÁGINA 2 (Landscape) ---
  // --- 4. ANEXO: COMPOSICIÓN DE DEUDA (Matriz Pivotada - Punto 5.B) ---
  
  doc.addPage(null, 'landscape');
  finalY = 20;

  doc.setFontSize(14);
  doc.text('Anexo: Composición de Deuda (Detalle por Mes de Origen)', 14, finalY);
  finalY += 10;

  // 4.A. Procesar y pivotar datos
  const debitosNuevos = movimientos.filter(m => m.monto < 0 && m.tipo !== 'PAGO_RECIBIDO' && m.mes_origen);
  const debitosAntiguos = movimientos.filter(m => m.monto < 0 && m.tipo !== 'PAGO_RECIBIDO' && !m.mes_origen);

  const dataPivoteada = {}; 
  const mesesAplicacion = new Set(); 

  debitosNuevos.forEach(mov => {
    if (!dataPivoteada[mov.mes_origen]) dataPivoteada[mov.mes_origen] = {};
    if (!dataPivoteada[mov.mes_origen][mov.tipo]) dataPivoteada[mov.mes_origen][mov.tipo] = [];
    
    dataPivoteada[mov.mes_origen][mov.tipo].push(mov);

    if (mov.mes_aplicacion) mesesAplicacion.add(mov.mes_aplicacion);
  });

  const mesesOrigenOrdenados = Object.keys(dataPivoteada).sort();
  const mesesAplicacionOrdenados = Array.from(mesesAplicacion).sort();

  // 4.B. Construir Cabecera de la Matriz (Dinámica)
  const head = [
    ['Concepto (Mes Origen)', 'Total Base', ...mesesAplicacionOrdenados.map(mes => `Int. ${formatDate(mes)}`), 'Total Deuda Mes']
  ];

  // 4.C. Construir Cuerpo de la Matriz
  const body = [];
  let granTotalBase = 0;
  let granTotalIntereses = 0;
  let granTotalDeuda = 0;
  const totalesPorAplicacion = new Array(mesesAplicacionOrdenados.length).fill(0);

  // 1. Añadir Deuda Histórica (sin mes_origen)
  let totalBaseAntigua = 0;
  debitosAntiguos.forEach(mov => {
      totalBaseAntigua += (Math.abs(mov.monto) - (mov.montoAplicado || 0));
  });
  
  if (totalBaseAntigua > 0) {
      const filaAntigua = [
          'Deuda Histórica (Pre-Sistema)',
          formatCurrency(totalBaseAntigua), // Total Base
          ...new Array(mesesAplicacionOrdenados.length).fill('-'), // No tiene intereses pivotados
          formatCurrency(totalBaseAntigua) // Total Deuda Mes
      ];
      body.push(filaAntigua);
      granTotalBase += totalBaseAntigua;
      granTotalDeuda += totalBaseAntigua;
  }

  // 2. Añadir Deuda Nueva (pivotada)
  for (const mesOrigen of mesesOrigenOrdenados) {
    const tiposDeuda = dataPivoteada[mesOrigen];
    
    Object.keys(tiposDeuda).filter(tipo => tipo.includes('_BASE')).forEach(tipoBase => {
      const fila = [];
      const conceptoBase = tiposDeuda[tipoBase][0].concepto || `Expensas ${mesOrigen}`;
      fila.push(conceptoBase);
      
      const totalBase = tiposDeuda[tipoBase].reduce((sum, m) => sum + (Math.abs(m.monto) - (m.montoAplicado || 0)), 0);
      fila.push(formatCurrency(totalBase));
      granTotalBase += totalBase;
      
      let totalInteresFila = 0;

      // Columnas dinámicas de Intereses
      mesesAplicacionOrdenados.forEach((mesApp, index) => {
        let totalInteresMes = 0;
        
        const intereses10 = tiposDeuda['INTERES_10']?.filter(m => m.mes_aplicacion === mesApp) || [];
        const interesesBNA = tiposDeuda['INTERES_BNA']?.filter(m => m.mes_aplicacion === mesApp) || [];
        
        totalInteresMes += intereses10.reduce((sum, m) => sum + (Math.abs(m.monto) - (m.montoAplicado || 0)), 0);
        totalInteresMes += interesesBNA.reduce((sum, m) => sum + (Math.abs(m.monto) - (m.montoAplicado || 0)), 0);
        
        fila.push(totalInteresMes > 0 ? formatCurrency(totalInteresMes) : '-');
        totalInteresFila += totalInteresMes;
        totalesPorAplicacion[index] += totalInteresMes;
      });
      
      const totalFila = totalBase + totalInteresFila;
      fila.push(formatCurrency(totalFila)); 
      granTotalIntereses += totalInteresFila;
      granTotalDeuda += totalFila;

      body.push(fila);
    });
  }

  // 4.D. Dibujar la Matriz
  if (body.length > 0) {
    autoTable(doc, {
      startY: finalY,
      head: head,
      body: body,
      foot: [ 
        [
          'TOTALES PENDIENTES', 
          formatCurrency(granTotalBase), 
          ...totalesPorAplicacion.map(total => formatCurrency(total)), 
          formatCurrency(granTotalDeuda)
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], fontSize: 8 },
      footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
      }
    });
  } else {
    doc.text("No se encontraron movimientos de deuda para detallar.", 14, finalY);
  }
  finalY = doc.lastAutoTable.finalY;


  // --- 5. PIE DE PÁGINA (En Hoja 2) ---
  finalY += 10;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Este documento es un informe de estado de cuenta y no constituye una factura legal.', 14, finalY);

  // Devolver el BLOB
  return doc.output('blob');
};

// --- FIN CORRECCIÓN 2 ---