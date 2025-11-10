// src/services/liquidacionService.js
import { db, storage } from '../config/firebase';
import {
  collection, addDoc, doc, runTransaction,
  serverTimestamp, Timestamp, updateDoc,
  onSnapshot, query, orderBy, where, getDocs,
  getDoc, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getGastosNoLiquidados } from './gastosService';
import { getTodasUnidades } from './propietariosService'; 
import { registrarMovimientoFondo } from './fondoService';

const formatCurrency = (value) => {
  const numValue = Number(value);
  if (isNaN(numValue)) return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(0);
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numValue);
};

// --- CONSTANTES Y HELPERS (sin cambios) ---
const TASA_MORA_1ER_MES = 0.10; 
const getMesAnio = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getNombreMes = (date) => date.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
const generarMovimientosBase = (unidad, desglose, liquidacionId, fechaVenc1, fechaVenc2, pctRecargo, nombreLiquidacion, mesOrigen) => {
    const movimientos = [];
    let montoTotalLiquidadoUnidad = 0;
    
    // 1. Ordinario
    if (desglose.ordinario > 0) {
        montoTotalLiquidadoUnidad += desglose.ordinario;
        movimientos.push({
            monto: -desglose.ordinario,
            concepto: `Exp. Ordinaria ${mesOrigen}`,
            tipo: "ORDINARIA_BASE",
            mes_origen: mesOrigen,
            liquidacionId
        });
    }

    // 2. Fondo de Reserva
    if (desglose.aporteFondo > 0) {
        montoTotalLiquidadoUnidad += desglose.aporteFondo;
        movimientos.push({
            monto: -desglose.aporteFondo,
            concepto: `Aporte Fondo Res. ${mesOrigen}`,
            tipo: "FONDO_BASE",
            mes_origen: mesOrigen,
            liquidacionId
        });
    }

    // 3. Extra Prorrateo
    if (desglose.extraProrrateo > 0) {
        montoTotalLiquidadoUnidad += desglose.extraProrrateo;
        movimientos.push({
            monto: -desglose.extraProrrateo,
            concepto: `Exp. Extra (Prorr) ${mesOrigen}`,
            tipo: "EXTRA_PRORRATEO_BASE",
            mes_origen: mesOrigen,
            liquidacionId
        });
    }
    
    // 4. Extra Específico
    if (desglose.extraEspecifico > 0) {
        montoTotalLiquidadoUnidad += desglose.extraEspecifico;
        movimientos.push({
            monto: -desglose.extraEspecifico,
            concepto: `Exp. Extra (Esp) ${mesOrigen}`,
            tipo: "EXTRA_ESPECIFICA_BASE",
            mes_origen: mesOrigen,
            liquidacionId
        });
    }
    
    // Añadir campos comunes y vencimientos
    if (movimientos.length > 0) {
        movimientos[0].vencimiento1 = fechaVenc1;
        movimientos[0].montoVencimiento1 = montoTotalLiquidadoUnidad;
        movimientos[0].vencimiento2 = fechaVenc2;
        movimientos[0].montoVencimiento2 = montoTotalLiquidadoUnidad * (1 + pctRecargo);
        movimientos[0].desglose = desglose;
    }
    
    return { movimientos, montoTotalLiquidadoUnidad };
};
// --- FIN CONSTANTES Y HELPERS ---


export const calcularPreviewLiquidacion = async (consorcioId, porcentajeFondoReserva) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para calcular preview.");
  
  console.log(`Calculando preview para ${consorcioId} con % fondo:`, porcentajeFondoReserva);
  
  // RUTA MODIFICADA (pasa consorcioId)
  const { gastos: gastosPendientes, total: _ } = await getGastosNoLiquidados(consorcioId);
  if (gastosPendientes.length === 0) {
    throw new Error("No hay gastos pendientes para liquidar.");
  }
  
  let saldoFondoInicial = 0;
  // RUTA MODIFICADA
  const configRef = doc(db, `consorcios/${consorcioId}/configuracion`, "general");
  
  try {
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data().hasOwnProperty('saldoFondoReserva')) {
      saldoFondoInicial = configSnap.data().saldoFondoReserva || 0;
      console.log("Saldo inicial del fondo:", saldoFondoInicial);
    } else {
      console.warn(`Documento 'configuracion/general' no encontrado para ${consorcioId}, asumiendo saldo de fondo 0.`);
    }
  } catch (error) {
    console.error("Error al leer saldo del fondo:", error);
    throw new Error("No se pudo obtener el saldo del fondo de reserva.");
  }
  
  // ... (lógica de cálculo de preview no cambia) ...
  let totalGastosOrdinarios = 0;
  let totalGastosExtraProrrateo = 0;
  let totalGastosExtraUnidades = 0;
  let totalGastosExtraFondo = 0;
  const gastosIncluidos = [];
  gastosPendientes.forEach(gasto => {
    const montoGasto = Number(gasto.monto) || 0;
    if (gasto.tipo === 'Ordinario') {
      totalGastosOrdinarios += montoGasto;
      gastosIncluidos.push(gasto);
    } else if (gasto.tipo === 'Extraordinario') {
      switch (gasto.distribucion) {
        case 'Prorrateo':
          totalGastosExtraProrrateo += montoGasto;
          gastosIncluidos.push(gasto);
          break;
        case 'UnidadesEspecificas':
          totalGastosExtraUnidades += montoGasto;
          gastosIncluidos.push(gasto);
          break;
        case 'FondoDeReserva':
          totalGastosExtraFondo += montoGasto;
          gastosIncluidos.push(gasto);
          break;
        default:
          console.warn(` -> Gasto extraordinario ${gasto.id} con distribución desconocida: ${gasto.distribucion}`);
      }
    } else {
      console.warn(` -> Gasto ${gasto.id} con tipo desconocido: ${gasto.tipo}`);
    }
  });
  const montoFondoReservaCalculado = totalGastosOrdinarios * porcentajeFondoReserva;
  const totalAProrratearGeneral = totalGastosOrdinarios + montoFondoReservaCalculado + totalGastosExtraProrrateo;
  const saldoFondoFinal = saldoFondoInicial - totalGastosExtraFondo;
  let errorFondo = '';
   if (totalGastosExtraFondo > saldoFondoInicial) {
     errorFondo = `Saldo inicial del Fondo (${formatCurrency(saldoFondoInicial)}) es insuficiente para cubrir los gastos Extraordinarios asignados (${formatCurrency(totalGastosExtraFondo)}).`;
     console.warn(errorFondo);
   }
  const previewCompleta = {
    gastosIncluidos,
    totalGastosOrdinarios,
    montoFondoReservaCalculado,
    totalGastosExtraProrrateo,
    totalAProrratearGeneral,
    totalGastosExtraUnidades,
    totalGastosExtraFondo,
    saldoFondoInicial,
    saldoFondoFinal: saldoFondoFinal,
    errorFondo,
    pctRecargo: TASA_MORA_1ER_MES 
  };
  console.log("Preview final a devolver:", previewCompleta);
  return previewCompleta;
};


// --- ejecutarLiquidacion ---
export const ejecutarLiquidacion = async (consorcioId, params, preview) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para ejecutar liquidación.");

  const { nombre, fechaVenc1, pctRecargo, fechaVenc2 } = params;
  const { gastosIncluidos, saldoFondoInicial, totalGastosExtraFondo } = preview;

  const fechaActualLiquidacion = new Date();
  const mesActualLiquidacion = getMesAnio(fechaActualLiquidacion);
  const fechaActualTimestamp = Timestamp.now();
  
  const saldoFondoFinalReal = saldoFondoInicial - totalGastosExtraFondo;

  // RUTA MODIFICADA (pasa consorcioId)
  const unidades = await getTodasUnidades(consorcioId);
  const sumaPorcentajes = unidades.reduce((acc, u) => acc + u.porcentaje, 0);
  if (Math.abs(1 - sumaPorcentajes) > 0.0001) {
    throw new Error(`La suma de porcentajes no es 1 (100%). Suma actual: ${(sumaPorcentajes * 100).toFixed(4)}%`);
  }

  // 1. Preparamos el documento de liquidación
  // RUTA MODIFICADA
  const liquidacionRef = collection(db, `consorcios/${consorcioId}/liquidaciones`);
  const nuevaLiquidacion = {
    nombre,
    fechaCreada: serverTimestamp(),
    totalGastosOrdinarios: preview.totalGastosOrdinarios,
    montoFondoReservaCalculado: preview.montoFondoReservaCalculado,
    totalGastosExtraProrrateo: preview.totalGastosExtraProrrateo,
    totalAProrratearGeneral: preview.totalAProrratearGeneral,
    totalGastosExtraUnidades: preview.totalGastosExtraUnidades,
    totalGastosExtraFondo,
    saldoFondoInicial,
    saldoFondoFinal: saldoFondoFinalReal,
    gastosIds: gastosIncluidos.map(g => g.id),
    unidadesIds: unidades.map(u => u.id),
    comentarios: params.comentarios || ""
  };

  // 2. Creamos el documento principal
  const liquidacionDoc = await addDoc(liquidacionRef, nuevaLiquidacion);
  const liquidacionId = liquidacionDoc.id;

  // 3. Preparamos arrays
  const itemsCtaCteGenerados = [];
  const detalleUnidades = [];
  const gastosEspecificos = gastosIncluidos.filter(g => 
      g.tipo === 'Extraordinario' && g.distribucion === 'UnidadesEspecificas'
  );

  try {
    // --- 4. INICIA LA TRANSACCIÓN ---
    await runTransaction(db, async (transaction) => {

      // --- PASO 1: LEER SALDOS UNIDADES Y CONFIGURACIÓN ---
      const saldosUnidades = [];
      for (const unidad of unidades) {
        // RUTA MODIFICADA
        const unidadRef = doc(db, `consorcios/${consorcioId}/unidades`, unidad.id);
        const unidadDoc = await transaction.get(unidadRef);
        if (!unidadDoc.exists()) throw new Error(`La unidad ${unidad.nombre} no existe.`);
        saldosUnidades.push({ unidadRef, saldoAnterior: unidadDoc.data().saldo, unidad });
      }

      // RUTA MODIFICADA
      const configRef = doc(db, `consorcios/${consorcioId}/configuracion`, "general");
      const configDoc = await transaction.get(configRef);
      
      // --- PASO 2: ESCRIBIR DATOS ---
      
      // A. Actualizar GASTOS
      for (const gasto of gastosIncluidos) {
        // RUTA MODIFICADA
        const gastoRef = doc(db, `consorcios/${consorcioId}/gastos`, gasto.id);
        transaction.update(gastoRef, { liquidacionId, liquidadoEn: nombre });
      }

      // B. Actualizar UNIDADES y Cta. Cte.
      for (const dataUnidad of saldosUnidades) {
        const { unidadRef, saldoAnterior, unidad } = dataUnidad;
        let saldoAcumulado = saldoAnterior;

        // 1. Calcular Desglose (No usa transacciones)
        // ... (lógica de cálculo de desglose no cambia) ...
        const montoOrdProrrateado = (preview.totalGastosOrdinarios || 0) * unidad.porcentaje;
        const montoAporteFondo = (preview.montoFondoReservaCalculado || 0) * unidad.porcentaje;
        const montoExtraProrrateo = (preview.totalGastosExtraProrrateo || 0) * unidad.porcentaje;
        let montoEspecifico = 0;
        for (const gasto of gastosEspecificos) {
          if (gasto.unidadesAfectadas && gasto.unidadesAfectadas.includes(unidad.id)) {
            const cantidadUnidadesAfectadas = gasto.unidadesAfectadas.length;
            if (cantidadUnidadesAfectadas > 0) {
              montoEspecifico += (Number(gasto.monto) / cantidadUnidadesAfectadas);
            }
          }
        }
        const desglose = {
            ordinario: montoOrdProrrateado,
            extraProrrateo: montoExtraProrrateo,
            extraEspecifico: montoEspecifico,
            aporteFondo: montoAporteFondo
        };
        
        // 2. Postear movimientos base
        const { movimientos: movimientosBase, montoTotalLiquidadoUnidad: totalBaseLiquidado } = generarMovimientosBase(
            unidad, desglose, liquidacionId, fechaVenc1, fechaVenc2, pctRecargo, nombre, mesActualLiquidacion
        );
        let totalBaseLiquidadoUnidad = 0;

        for (const mov of movimientosBase) {
            // RUTA MODIFICADA
            const ctaCteRef = doc(collection(db, `consorcios/${consorcioId}/unidades/${unidad.id}/cuentaCorriente`));
            
            mov.fecha = fechaActualTimestamp; 
            mov.saldoResultante = saldoAcumulado + mov.monto;
            mov.unidadId = unidad.id;
            mov.pagado = false;
            mov.montoAplicado = 0;
            
            transaction.set(ctaCteRef, mov);
            saldoAcumulado += mov.monto;
            totalBaseLiquidadoUnidad += Math.abs(mov.monto);

            itemsCtaCteGenerados.push({ ...mov, id: ctaCteRef.id });
        }

        // 3. Guardar data para snapshot
        // ... (lógica de detalleUnidades no cambia) ...
        detalleUnidades.push({
            unidadId: unidad.id,
            nombre: unidad.nombre,
            propietario: unidad.propietario,
            porcentaje: unidad.porcentaje,
            saldoAnterior: saldoAnterior,
            montoLiquidadoOrdinario: -desglose.ordinario,
            montoLiquidadoFondo: -desglose.aporteFondo,
            montoLiquidadoExtraProrrateo: -desglose.extraProrrateo,
            montoLiquidadoExtraEspecifico: -desglose.extraEspecifico,
            montoLiquidadoInteres: 0, 
            montoLiquidado: -totalBaseLiquidadoUnidad,
            saldoResultante: saldoAcumulado
        });
        
        // 4. Actualizar saldo unidad FINAL
        transaction.update(unidadRef, { saldo: saldoAcumulado });
      }
      
      // C. Actualizar Saldo del Fondo de Reserva
      if (configDoc.exists()) {
           transaction.update(configRef, { saldoFondoReserva: saldoFondoFinalReal });
       } else {
            transaction.set(configRef, { saldoFondoReserva: saldoFondoFinalReal || 0 });
       }

       // D. Registrar Movimientos del Fondo
       const gastosDeFondo = gastosIncluidos.filter (g => g.distribucion === 'FondoDeReserva' );
       let saldoAcumuladoFondo = saldoFondoInicial; 

       for (const gasto of gastosDeFondo){
         saldoAcumuladoFondo -= gasto.monto;
         
         // RUTA MODIFICADA
         const historialFondoRef = doc(collection(db, `consorcios/${consorcioId}/historicoFondoReserva`));
         transaction.set(historialFondoRef, {
            fecha: Timestamp.now(),
            concepto : gasto.concepto, 
            monto: -gasto.monto,
            saldoResultante: saldoAcumuladoFondo,
            liquidacionId: liquidacionId,
            gastoId: gasto.id,
            facturaURL: gasto.facturaURL || null
         });
       }

    });
    // --- FIN DE LA TRANSACCIÓN ---

    console.log(`¡Transacción de liquidación ${liquidacionId} completada para consorcio ${consorcioId}!`);
    return { liquidacionId, unidades, itemsCtaCteGenerados, detalleUnidades };

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN! ", error);
    throw new Error(`Error al ejecutar la transacción: ${error.message}`);
  }
};


// --- uploadCuponPDF ---
export const uploadCuponPDF = async (consorcioId, pdfBlob, liquidacionNombre, unidadNombre) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para subir PDF.");
  
  const safeLiquidacionNombre = liquidacionNombre.replace(/ /g, '_');
  const safeUnidadNombre = unidadNombre.replace(/ /g, '_');
  
  const fileName = `expensa-${safeLiquidacionNombre}-${safeUnidadNombre}.pdf`;
  // RUTA MODIFICADA (Storage)
  const storageRef = ref(storage, `consorcios/${consorcioId}/liquidaciones/${safeLiquidacionNombre}/${fileName}`);
  
  console.log(`Subiendo cupón: ${fileName} a ${consorcioId}`);
  const snapshot = await uploadBytes(storageRef, pdfBlob);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

// --- guardarURLCupon ---
export const guardarURLCupon = async (consorcioId, unidadId, ctaCteId, url) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para guardar URL.");

  // RUTA MODIFICADA
  const ctaCteRef = doc(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`, ctaCteId);
  
  await updateDoc(ctaCteRef, {
    cuponURL: url 
  });
  console.log(`URL guardada para ctaCteId: ${ctaCteId}`);
};

// --- getLiquidaciones ---
export const getLiquidaciones = (consorcioId, callback) => {
  if (!consorcioId) {
    callback([], new Error("consorcioId no fue provisto a getLiquidaciones"));
    return () => {};
  }
  
  // RUTA MODIFICADA
  const liquidacionesCollectionRef = collection(db, `consorcios/${consorcioId}/liquidaciones`);
  const q = query(liquidacionesCollectionRef, orderBy("fechaCreada", "desc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const liquidaciones = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const fechaJS = data.fechaCreada ? data.fechaCreada.toDate() : null;
      liquidaciones.push({
        id: doc.id,
        ...data,
        fechaCreada: fechaJS
      });
    });
    callback(liquidaciones);
  }, (error) => {
    console.error("Error al obtener liquidaciones:", error);
    callback([], error);
  });

  return unsubscribe;
};

// --- resetearTodasLasLiquidaciones ---
export const resetearTodasLasLiquidaciones = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para resetear liquidaciones.");

  console.warn(`Iniciando reseteo total de Liquidaciones para consorcio ${consorcioId}...`);

  // RUTA MODIFICADA
  const liquidacionesCollection = collection(db, `consorcios/${consorcioId}/liquidaciones`);
  const liquidacionesSnapshot = await getDocs(liquidacionesCollection);
  let contadorBorrados = 0;
  let contadorErrores = 0;

  if (liquidacionesSnapshot.empty) {
    console.log("No hay documentos de liquidación para borrar.");
    return 0;
  }

  // NOTA: Borrar los PDFs de Storage asociados a esta liquidación
  // requeriría lógica adicional (listar archivos en la carpeta de storage),
  // por ahora solo borramos los documentos de Firestore.

  const promesasDelete = liquidacionesSnapshot.docs.map(async (liqDoc) => {
    try {
      await deleteDoc(liqDoc.ref);
      contadorBorrados++;
    } catch (error) {
      console.error(`Error borrando liquidación ${liqDoc.id}:`, error);
      contadorErrores++;
    }
  });

  await Promise.all(promesasDelete);

  console.warn(`Reseteo de Liquidaciones completado. Borrados: ${contadorBorrados}, Errores: ${contadorErrores}`);
  if (contadorErrores > 0) {
    throw new Error(`Ocurrieron ${contadorErrores} errores al borrar liquidaciones.`);
  }
  return contadorBorrados;
};