// src/services/liquidacionService.js
import { db, storage } from '../config/firebase';
import {
  collection, addDoc, doc, runTransaction,
  serverTimestamp, Timestamp, updateDoc,
  onSnapshot, query, orderBy, where, getDocs,
  getDoc // <-- Importación clave
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getGastosNoLiquidados } from './gastosService';
import { getTodasUnidades } from './propietariosService';

// --- Helper de formato (para la advertencia del fondo) ---
const formatCurrency = (value) => {
  const numValue = Number(value);
  if (isNaN(numValue)) return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(0);
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numValue);
};

// --- NUEVA VERSIÓN DE calcularPreviewLiquidacion ---
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
  const saldoFondoFinal = saldoFondoInicial - totalGastosExtraFondo + montoFondoReservaCalculado;

  // 7. Verificar si el fondo es suficiente
  let errorFondo = '';
   if (saldoFondoFinal < 0) {
    errorFondo = `El Fondo de Reserva quedaría negativo (${formatCurrency(saldoFondoFinal)}). Se necesitan ${formatCurrency(Math.abs(saldoFondoFinal))} adicionales para cubrir los gastos extraordinarios asignados.`;
    console.warn(errorFondo);
  } else if (totalGastosExtraFondo > saldoFondoInicial) {
     errorFondo = `Saldo inicial del Fondo (${formatCurrency(saldoFondoInicial)}) es insuficiente para cubrir los gastos Extraordinarios asignados (${formatCurrency(totalGastosExtraFondo)}).`;
     console.warn(errorFondo);
  }

  // 8. Devolver el objeto completo
  const previewCompleta = {
    gastosIncluidos,
    totalGastosOrdinarios,
    montoFondoReservaCalculado,
    totalGastosExtraProrrateo,
    totalAProrratearGeneral,
    totalGastosExtraUnidades,
    totalGastosExtraFondo,
    saldoFondoInicial,
    saldoFondoFinal,
    errorFondo,
    pctRecargo: 0.10 // Valor fijo por ahora, puedes tomarlo de params si lo mueves
  };

  console.log("Preview final a devolver:", previewCompleta);
  return previewCompleta;
};


// --- ejecutarLiquidacion (LA QUE FALTABA) ---
export const ejecutarLiquidacion = async (params, preview) => {

  const { nombre, fechaVenc1, pctRecargo, fechaVenc2 } = params;
  const {
    gastosIncluidos,
    totalAProrratearGeneral,
    totalGastosOrdinarios,
    montoFondoReservaCalculado,
    saldoFondoInicial, saldoFondoFinal,
    totalGastosExtraProrrateo, totalGastosExtraUnidades, totalGastosExtraFondo
  } = preview;

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
    saldoFondoFinal,
    gastosIds: gastosIncluidos.map(g => g.id),
    unidadesIds: unidades.map(u => u.id)
  };

  // 2. Creamos el documento principal
  const liquidacionDoc = await addDoc(liquidacionRef, nuevaLiquidacion);
  const liquidacionId = liquidacionDoc.id;

  // 3. Preparamos arrays
  const itemsCtaCteGenerados = [];
  const detalleUnidades = [];

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
         transaction.set(configRef, { saldoFondoReserva: saldoFondoFinal || 0 });
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

        const montoProrrateado = totalAProrratearGeneral * unidad.porcentaje;
        const montoEspecifico = gastosIncluidos
            .filter(g => g.tipo === 'Extraordinario' && g.distribucion === 'UnidadesEspecificas' && g.unidadesAfectadas?.includes(unidad.id))
            .reduce((sum, g) => sum + g.monto, 0);

        const montoTotalLiquidadoUnidad = montoProrrateado + montoEspecifico;
        const saldoResultante = saldoAnterior - montoTotalLiquidadoUnidad;

        // 1. Actualizar saldo unidad
        transaction.update(unidadRef, { saldo: saldoResultante });

        // 2. Crear item Cta. Cte.
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
          unidadId: unidad.id
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
          montoLiquidadoOrdinario: -(totalGastosOrdinarios * unidad.porcentaje),
          montoLiquidadoFondo: -(montoFondoReservaCalculado * unidad.porcentaje),
          montoLiquidadoExtraProrrateo: -(totalGastosExtraProrrateo * unidad.porcentaje),
          montoLiquidadoExtraEspecifico: -montoEspecifico,
          montoLiquidado: -montoTotalLiquidadoUnidad,
          saldoResultante: saldoResultante
        });
      }

       // C. Actualizar Saldo del Fondo de Reserva
       if (configDoc.exists()) {
           transaction.update(configRef, { saldoFondoReserva: saldoFondoFinal });
       }
    }); // --- FIN DE LA TRANSACCIÓN ---

    console.log("¡Transacción de liquidación completada!");
    return { liquidacionId, unidades, itemsCtaCteGenerados, detalleUnidades };

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN! ", error);
    throw new Error(`Error al ejecutar la transacción: ${error.message}`);
  }
};


// --- uploadCuponPDF (LA QUE FALTABA) ---
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

// --- guardarURLCupon (LA QUE FALTABA) ---
export const guardarURLCupon = async (unidadId, ctaCteId, url) => {
  const ctaCteRef = doc(db, `unidades/${unidadId}/cuentaCorriente`, ctaCteId);
  
  await updateDoc(ctaCteRef, {
    cuponURL: url 
  });
  console.log(`URL guardada para ctaCteId: ${ctaCteId}`);
};

// --- getLiquidaciones (LA QUE FALTABA) ---
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