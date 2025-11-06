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

export const calcularPreviewLiquidacion = async (porcentajeFondoReserva) => {
  console.log("Calculando preview con % fondo:", porcentajeFondoReserva);

  // 1. Obtener gastos pendientes
  const { gastos: gastosPendientes, total: _ } = await getGastosNoLiquidados();
  if (gastosPendientes.length === 0) {
    throw new Error("No hay gastos pendientes para liquidar.");
  }
  console.log(`Gastos pendientes encontrados: ${gastosPendientes.length}`);

  // 2. Obtener saldo inicial del fondo de reserva
  let saldoFondoInicial = 0;
  const configRef = doc(db, "configuracion", "general");
  try {
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data().hasOwnProperty('saldoFondoReserva')) {
      saldoFondoInicial = configSnap.data().saldoFondoReserva || 0;
      console.log("Saldo inicial del fondo:", saldoFondoInicial);
    } else {
      console.warn("Documento 'configuracion/general' o campo 'saldoFondoReserva' no encontrado, asumiendo saldo de fondo 0.");
    }
  } catch (error) {
    console.error("Error al leer saldo del fondo:", error);
    throw new Error("No se pudo obtener el saldo del fondo de reserva.");
  }

  // 3. Clasificar y sumar gastos
  let totalGastosOrdinarios = 0;
  let totalGastosExtraProrrateo = 0;
  let totalGastosExtraUnidades = 0;
  let totalGastosExtraFondo = 0;
  const gastosIncluidos = [];

  gastosPendientes.forEach(gasto => {
    console.log(`Procesando gasto ${gasto.id}: Tipo=${gasto.tipo}, Distribucion=${gasto.distribucion}, Monto=${gasto.monto}`);
    const montoGasto = Number(gasto.monto) || 0;

    if (gasto.tipo === 'Ordinario') {
      totalGastosOrdinarios += montoGasto;
      gastosIncluidos.push(gasto);
      console.log(` -> Sumado a Ordinarios. Nuevo total: ${totalGastosOrdinarios}`);
    } else if (gasto.tipo === 'Extraordinario') {
      switch (gasto.distribucion) {
        case 'Prorrateo':
          totalGastosExtraProrrateo += montoGasto;
          gastosIncluidos.push(gasto);
          console.log(` -> Sumado a Extra Prorrateo. Nuevo total: ${totalGastosExtraProrrateo}`);
          break;
        case 'UnidadesEspecificas':
          totalGastosExtraUnidades += montoGasto;
          gastosIncluidos.push(gasto);
          console.log(` -> Sumado a Extra Unidades. Nuevo total: ${totalGastosExtraUnidades}`);
          break;
        case 'FondoDeReserva':
          totalGastosExtraFondo += montoGasto;
          gastosIncluidos.push(gasto);
          console.log(` -> Sumado a Extra Fondo. Nuevo total: ${totalGastosExtraFondo}`);
          break;
        default:
          console.warn(` -> Gasto extraordinario ${gasto.id} con distribución desconocida: ${gasto.distribucion}`);
      }
    } else {
      console.warn(` -> Gasto ${gasto.id} con tipo desconocido: ${gasto.tipo}`);
    }
  });

  console.log("Totales calculados después del bucle:", { totalGastosOrdinarios, totalGastosExtraProrrateo, totalGastosExtraUnidades, totalGastosExtraFondo });

  // 4. Calcular aporte al fondo de reserva (sobre ordinarios)
  const montoFondoReservaCalculado = totalGastosOrdinarios * porcentajeFondoReserva;

  // 5. Calcular total a prorratear general
  const totalAProrratearGeneral = totalGastosOrdinarios + montoFondoReservaCalculado + totalGastosExtraProrrateo;

  // 6. Calcular saldo final estimado del fondo
  // EL APORTE (montoFondoReservaCalculado) YA NO SE SUMA AQUÍ
  const saldoFondoFinal = saldoFondoInicial - totalGastosExtraFondo;

  // 7. Verificar si el fondo es suficiente
  let errorFondo = '';
   if (totalGastosExtraFondo > saldoFondoInicial) {
     errorFondo = `Saldo inicial del Fondo (${formatCurrency(saldoFondoInicial)}) es insuficiente para cubrir los gastos Extraordinarios asignados (${formatCurrency(totalGastosExtraFondo)}).`;
     console.warn(errorFondo);
   }


  // 8. Devolver el objeto completo
  const previewCompleta = {
    gastosIncluidos,
    totalGastosOrdinarios,
    montoFondoReservaCalculado, // El aporte A FACTURAR
    totalGastosExtraProrrateo,
    totalAProrratearGeneral,
    totalGastosExtraUnidades,
    totalGastosExtraFondo, // El gasto A EJECUTAR
    saldoFondoInicial,
    saldoFondoFinal: saldoFondoFinal, // <-- Devolvemos el saldo real (solo con egresos)
    errorFondo,
    pctRecargo: 0.10 // Valor fijo
  };

  console.log("Preview final a devolver:", previewCompleta);
  return previewCompleta;
};


// --- ejecutarLiquidacion (VERSIÓN ALINEADA A LA NUEVA LÓGICA) ---
export const ejecutarLiquidacion = async (params, preview) => {

  const { nombre, fechaVenc1, pctRecargo, fechaVenc2 } = params;
  const {
    gastosIncluidos,
    totalAProrratearGeneral,
    totalGastosOrdinarios,
    montoFondoReservaCalculado, // Aporte (a facturar)
    saldoFondoInicial, 
    // saldoFondoFinal, // Se recalcula
    totalGastosExtraProrrateo,
    totalGastosExtraFondo // Gasto (Egreso real)
  } = preview;

  // Recalculamos el saldo final real aquí
  const saldoFondoFinalReal = saldoFondoInicial - totalGastosExtraFondo;

  const unidades = await getTodasUnidades();
  const sumaPorcentajes = unidades.reduce((acc, u) => acc + u.porcentaje, 0);
  if (Math.abs(1 - sumaPorcentajes) > 0.0001) {
    throw new Error(`La suma de porcentajes no es 1 (100%). Suma actual: ${(sumaPorcentajes * 100).toFixed(4)}%`);
  }

  // 1. Preparamos el documento de liquidación
  const liquidacionRef = collection(db, "liquidaciones");
  const nuevaLiquidacion = {
    nombre,
    fechaCreada: serverTimestamp(),
    totalGastosOrdinarios,
    montoFondoReservaCalculado,
    totalGastosExtraProrrateo,
    totalAProrratearGeneral,
    totalGastosExtraUnidades,
    totalGastosExtraFondo,
    saldoFondoInicial,
    saldoFondoFinal: saldoFondoFinalReal, // Guardamos el saldo real post-egresos
    gastosIds: gastosIncluidos.map(g => g.id),
    unidadesIds: unidades.map(u => u.id),
    comentarios: params.comentarios || "" // Guardamos los comentarios
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

      // --- PASO 1: LEER DATOS ---
      const saldosUnidades = [];
      for (const unidad of unidades) {
        const unidadRef = doc(db, "unidades", unidad.id);
        const unidadDoc = await transaction.get(unidadRef);
        if (!unidadDoc.exists()) throw new Error(`La unidad ${unidad.nombre} no existe.`);
        saldosUnidades.push({ unidadRef, saldoAnterior: unidadDoc.data().saldo, unidad });
      }

      const configRef = doc(db, "configuracion", "general");
      const configDoc = await transaction.get(configRef);
      if (!configDoc.exists()) {
         console.warn("Documento 'configuracion/general' no encontrado en transacción, se creará.");
         transaction.set(configRef, { saldoFondoReserva: saldoFondoFinalReal || 0 });
      }
      
      // --- PASO 2: ESCRIBIR DATOS ---
      
      // A. Actualizar GASTOS
      for (const gasto of gastosIncluidos) {
        const gastoRef = doc(db, "gastos", gasto.id);
        transaction.update(gastoRef, {
          liquidacionId: liquidacionId,
          liquidadoEn: nombre
        });
      }

      // B. Actualizar UNIDADES y Cta. Cte.
      for (const dataUnidad of saldosUnidades) {
        const { unidadRef, saldoAnterior, unidad } = dataUnidad;

        // Desglose
        const montoOrdProrrateado = (totalGastosOrdinarios || 0) * unidad.porcentaje;
        const montoAporteFondo = (montoFondoReservaCalculado || 0) * unidad.porcentaje;
        const montoExtraProrrateado = (totalGastosExtraProrrateo || 0) * unidad.porcentaje;
        let montoEspecifico = 0;
        for (const gasto of gastosEspecificos) {
          if (gasto.unidadesAfectadas && gasto.unidadesAfectadas.includes(unidad.id)) {
            const cantidadUnidadesAfectadas = gasto.unidadesAfectadas.length;
            if (cantidadUnidadesAfectadas > 0) {
              montoEspecifico += (Number(gasto.monto) / cantidadUnidadesAfectadas);
            }
          }
        }
        
        const montoTotalLiquidadoUnidad = montoOrdProrrateado + montoAporteFondo + montoExtraProrrateo + montoEspecifico;
        const saldoResultante = saldoAnterior - montoTotalLiquidadoUnidad;

        // 1. Actualizar saldo unidad
        transaction.update(unidadRef, { saldo: saldoResultante });

        // 2. Crear item Cta. Cte. (CON DESGLOSE)
        const ctaCteRef = doc(collection(db, `unidades/${unidad.id}/cuentaCorriente`));
        const itemCtaCte = {
          fecha: Timestamp.now(),
          concepto: `Expensa ${nombre}`,
          monto: -montoTotalLiquidadoUnidad,
          saldoResultante: saldoResultante,
          liquidacionId: liquidacionId,
          vencimiento1: fechaVenc1,
          montoVencimiento1: montoTotalLiquidadoUnidad,
          vencimiento2: fechaVenc2,
          montoVencimiento2: montoTotalLiquidadoUnidad * (1 + pctRecargo),
          unidadId: unidad.id,
          desglose: {
            ordinario: montoOrdProrrateado,
            extraProrrateo: montoExtraProrrateado,
            extraEspecifico: montoEspecifico,
            aporteFondo: montoAporteFondo
          },
          montoAplicado: 0,
          pagado: false
        };
        transaction.set(ctaCteRef, itemCtaCte);

        // 3. Guardar data para return
        itemsCtaCteGenerados.push({ ...itemCtaCte, id: ctaCteRef.id });

        // 4. Guardar data para snapshot
        detalleUnidades.push({
          unidadId: unidad.id,
          nombre: unidad.nombre,
          propietario: unidad.propietario,
          porcentaje: unidad.porcentaje,
          saldoAnterior: saldoAnterior,
          montoLiquidadoOrdinario: -montoOrdProrrateado,
          montoLiquidadoFondo: -montoAporteFondo,
          montoLiquidadoExtraProrrateo: -montoExtraProrrateado,
          montoLiquidadoExtraEspecifico: -montoEspecifico,
          montoLiquidado: -montoTotalLiquidadoUnidad,
          saldoResultante: saldoResultante
        });
      }

       // C. Actualizar Saldo del Fondo de Reserva (SOLO EGRESOS)
       if (configDoc.exists()) {
           transaction.update(configRef, { saldoFondoReserva: saldoFondoFinalReal });
       } else {
            transaction.set(configRef, { saldoFondoReserva: saldoFondoFinalReal || 0 });
       }

       // D. Registrar Movimientos del Fondo (SOLO EGRESOS)
       
       // 1. (El bloque de INGRESO fue removido)
       
       // 2. Registrar los EGRESOS
       const gastosDeFondo = gastosIncluidos.filter (g => g.distribucion === 'FondoDeReserva' );
       let saldoAcumulado = saldoFondoInicial; 

       for (const gasto of gastosDeFondo){
         saldoAcumulado -= gasto.monto;
         
         transaction.set(doc(collection(db, "historicoFondoReserva")),{
            fecha: Timestamp.now(),
            // --- ¡BUG CORREGIDO! Ya no se añade "Gasto:" ---
            concepto : gasto.concepto, 
            monto: -gasto.monto,
            saldoResultante: saldoAcumulado,
            liquidacionId: liquidacionId,
            gastoId: gasto.id
         });
       }
       // --- FIN LÓGICA MODIFICADA ---

    }); // --- FIN DE LA TRANSACCIÓN ---

    console.log("¡Transacción de liquidación completada!");
    return { liquidacionId, unidades, itemsCtaCteGenerados, detalleUnidades };

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN! ", error);
    throw new Error(`Error al ejecutar la transacción: ${error.message}`);
  }
};


// --- OTRAS FUNCIONES (Sin cambios) ---

export const uploadCuponPDF = async (pdfBlob, liquidacionNombre, unidadNombre) => {
  const safeLiquidacionNombre = liquidacionNombre.replace(/ /g, '_');
  const safeUnidadNombre = unidadNombre.replace(/ /g, '_');
  
  const fileName = `expensa-${safeLiquidacionNombre}-${safeUnidadNombre}.pdf`;
  const storageRef = ref(storage, `liquidaciones/${safeLiquidacionNombre}/${fileName}`);
  
  console.log(`Subiendo cupón: ${fileName}`);
  const snapshot = await uploadBytes(storageRef, pdfBlob);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

export const guardarURLCupon = async (unidadId, ctaCteId, url) => {
  const ctaCteRef = doc(db, `unidades/${unidadId}/cuentaCorriente`, ctaCteId);
  
  await updateDoc(ctaCteRef, {
    cuponURL: url 
  });
  console.log(`URL guardada para ctaCteId: ${ctaCteId}`);
};

export const getLiquidaciones = (callback) => {
  const q = query(collection(db, "liquidaciones"), orderBy("fechaCreada", "desc"));

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

export const resetearTodasLasLiquidaciones = async () => {
  console.warn("Iniciando reseteo total de Liquidaciones (documentos)...");

  const liquidacionesCollection = collection(db, "liquidaciones");
  const liquidacionesSnapshot = await getDocs(liquidacionesCollection);
  let contadorBorrados = 0;
  let contadorErrores = 0;

  if (liquidacionesSnapshot.empty) {
    console.log("No hay documentos de liquidación para borrar.");
    return 0;
  }

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