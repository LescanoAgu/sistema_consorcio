// src/services/propietariosService.js
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, getDocs,
  runTransaction, doc, Timestamp, where,
  updateDoc, deleteDoc, setDoc // <-- Asegurarse que setDoc esté importado
} from 'firebase/firestore';
import { registrarMovimientoFondo } from './fondoService'; // <-- Importamos el servicio del fondo

// --- crearUnidad (Sin cambios) ---
export const crearUnidad = async (unidadData) => {
  const { nombre, propietario, porcentaje } = unidadData;
  const nuevaUnidad = {
    nombre,
    propietario,
    porcentaje: parseFloat(porcentaje),
    saldo: 0,
    createdAt: serverTimestamp()
  };
  try {
    const docRef = await addDoc(collection(db, "unidades"), nuevaUnidad);
    console.log("Unidad registrada con ID: ", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error al guardar la unidad: ", error);
    throw new Error('No se pudo guardar la unidad.');
  }
};

// --- getUnidades (Sin cambios) ---
export const getUnidades = (callback) => {
  const q = query(collection(db, "unidades"), orderBy("nombre", "asc"));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const unidades = [];
    querySnapshot.forEach((doc) => {
      unidades.push({ id: doc.id, ...doc.data() });
    });
    callback(unidades);
  });
  return unsubscribe;
};

// --- getTodasUnidades (Sin cambios) ---
export const getTodasUnidades = async () => {
  const q = query(collection(db, "unidades"));
  const querySnapshot = await getDocs(q);
  const unidades = [];
  querySnapshot.forEach((doc) => {
    unidades.push({ id: doc.id, ...doc.data() });
  });
  return unidades;
};

// --- aplicarInteresesMoratorios (Sin cambios) ---
export const aplicarInteresesMoratorios = async (tasaMensual, concepto) => {
    if (!tasaMensual || tasaMensual <= 0) throw new Error("La tasa de interés debe ser un número positivo.");
    if (!concepto || concepto.trim() === '') throw new Error("El concepto para el registro es obligatorio.");

    const q = query(collection(db, "unidades"), where("saldo", "<", 0));
    const deudoresSnapshot = await getDocs(q); // Esta consulta necesita un índice (crear desde el error de consola)

    if (deudoresSnapshot.empty) {
        console.log("No se encontraron deudores.");
        return { unidadesActualizadas: 0, totalInteres: 0 };
    }

    let unidadesActualizadas = 0;
    let totalInteres = 0;

    try {
        await runTransaction(db, async (transaction) => {
            for (const unidadDoc of deudoresSnapshot.docs) {
                const unidadRef = unidadDoc.ref;
                const unidadData = unidadDoc.data();
                const saldoAnterior = unidadData.saldo;
                const montoInteres = - (Math.abs(saldoAnterior) * tasaMensual);
                const saldoResultante = saldoAnterior + montoInteres;

                transaction.update(unidadRef, { saldo: saldoResultante });

                const ctaCteRef = doc(collection(db, `unidades/${unidadDoc.id}/cuentaCorriente`));
                const itemCtaCte = {
                    fecha: Timestamp.now(), concepto, monto: montoInteres, saldoResultante,
                    liquidacionId: null, unidadId: unidadDoc.id,
                    desglose: { ordinario: 0, extraProrrateo: 0, extraEspecifico: 0, aporteFondo: 0 },
                    pagado: false, // Las deudas por interés nacen pendientes
                    montoAplicado: 0
                };
                transaction.set(ctaCteRef, itemCtaCte);

                unidadesActualizadas++;
                totalInteres += montoInteres;
            }
        });
        console.log(`Intereses aplicados a ${unidadesActualizadas} unidades.`);
        return { unidadesActualizadas, totalInteres };
    } catch (error) {
        console.error("¡FALLÓ LA TRANSACCIÓN DE INTERESES! ", error);
        throw new Error(`Error al aplicar intereses: ${error.message}`);
    }
};

// --- registrarPago (¡NUEVA VERSIÓN INTELIGENTE!) ---
export const registrarPago = async (unidadId, montoPagado, fechaPago, conceptoPago) => {
  if (!unidadId) throw new Error("Se requiere el ID de la unidad.");
  if (!montoPagado || montoPagado <= 0) throw new Error("El monto pagado debe ser un número positivo.");
  if (!fechaPago) throw new Error("La fecha de pago es obligatoria.");
  if (!conceptoPago || conceptoPago.trim() === '') throw new Error("El concepto del pago es obligatorio.");

  const fechaTimestamp = Timestamp.fromDate(new Date(`${fechaPago}T00:00:00Z`));
  const unidadRef = doc(db, "unidades", unidadId);
  const configRef = doc(db, "configuracion", "general");
  const ctaCteCollectionRef = collection(db, `unidades/${unidadId}/cuentaCorriente`);

  try {
    await runTransaction(db, async (transaction) => {
      let montoRestante = montoPagado;
      let totalFondoRecaudado = 0;
      let conceptosDeudasPagadas = [];

      // 1. Leer saldo actual de la unidad
      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) throw new Error(`La unidad con ID ${unidadId} no existe.`);
      const saldoAnteriorUnidad = unidadDoc.data().saldo;

      // 2. Buscar deudas pendientes (monto < 0) y no pagadas, ordenadas por fecha
      // IMPORTANTE: Esta consulta requiere un índice compuesto.
      // (Crear desde el error de consola si aparece)
      const deudasQuery = query(
        ctaCteCollectionRef,
        where("monto", "<", 0),
        where("pagado", "==", false),
        orderBy("fecha", "asc")
      );
      
      // Leemos las deudas FUERA de la transacción
      const deudasSnapshot = await getDocs(deudasQuery); 
      const deudasRefs = deudasSnapshot.docs.map(d => d.ref);
      
      // Volvemos a leerlas DENTRO de la transacción para poder actualizarlas
      const deudasDocsEnTransaccion = await Promise.all(
        deudasRefs.map(ref => transaction.get(ref))
      );

      if (deudasDocsEnTransaccion.length > 0) {
        console.log(`Encontradas ${deudasDocsEnTransaccion.length} deudas pendientes para ${unidadId}`);
        
        for (const deudaDoc of deudasDocsEnTransaccion) {
          if (montoRestante <= 0) break; // Si ya aplicamos todo el pago, salimos

          const deudaData = deudaDoc.data();
          const montoDeudaTotal = Math.abs(deudaData.monto);
          const montoDeudaPendiente = montoDeudaTotal - (deudaData.montoAplicado || 0);

          // Determinar cuánto de este pago se aplica a esta deuda
          const montoAAplicar = Math.min(montoRestante, montoDeudaPendiente);
          
          if (montoAAplicar > 0) {
            const nuevoMontoAplicado = (deudaData.montoAplicado || 0) + montoAAplicar;
            const estaPagadaCompleta = nuevoMontoAplicado >= montoDeudaTotal - 0.01; // Margen de centavos

            transaction.update(deudaDoc.ref, {
              montoAplicado: nuevoMontoAplicado,
              pagado: estaPagadaCompleta
            });

            montoRestante -= montoAAplicar;
            
            // Registrar fondo recaudado (basado en proporción pagada)
            if (deudaData.desglose && deudaData.desglose.aporteFondo > 0) {
              // Proporción del AporteFondo que se está pagando
              const proporcionPagada = montoAAplicar / montoDeudaTotal;
              const fondoRecaudadoEstaDeuda = (deudaData.desglose.aporteFondo || 0) * proporcionPagada;
              totalFondoRecaudado += fondoRecaudadoEstaDeuda;
            }
            conceptosDeudasPagadas.push(deudaData.concepto);
          }
        }
      } else {
        console.log(`No se encontraron deudas pendientes para ${unidadId}. El pago se aplica como saldo a favor.`);
      }

      // 3. Crear el registro del pago (Crédito)
      const saldoResultanteUnidad = saldoAnteriorUnidad + montoPagado;
      const ctaCtePagoRef = doc(collection(db, `unidades/${unidadId}/cuentaCorriente`));
      
      let conceptoFinalPago = conceptoPago;
      if (conceptosDeudasPagadas.length > 0) {
         // Acortamos el concepto si paga muchas deudas
         conceptoFinalPago = `${conceptoPago} (Aplica a: ${conceptosDeudasPagadas.slice(0, 2).join(', ')}${conceptosDeudasPagadas.length > 2 ? ', ...' : ''})`;
      }

      transaction.set(ctaCtePagoRef, {
        fecha: fechaTimestamp,
        concepto: conceptoFinalPago,
        monto: montoPagado, // Positivo
        saldoResultante: saldoResultanteUnidad,
        liquidacionId: null,
        unidadId: unidadId,
        pagado: true,
        montoAplicado: montoPagado
      });

      // 4. Actualizar el saldo total de la unidad
      transaction.update(unidadRef, { saldo: saldoResultanteUnidad });

      // 5. Actualizar el Fondo de Reserva si recaudamos algo
      if (totalFondoRecaudado > 0) {
        console.log(`Recaudados ${totalFondoRecaudado} para el fondo de reserva.`);
        const configDoc = await transaction.get(configRef); // Leer config DENTRO de la tx
        const saldoActualFondo = configDoc.exists() ? (configDoc.data().saldoFondoReserva || 0) : 0;
        const saldoNuevoFondo = saldoActualFondo + totalFondoRecaudado;

        // a. Actualizar el saldo general
        transaction.update(configRef, { saldoFondoReserva: saldoNuevoFondo });

        // b. Registrar el INGRESO en el historial del fondo
        transaction.set(doc(collection(db, "historicoFondoReserva")), {
          fecha: fechaTimestamp, // Usar la fecha del pago
          concepto: `Cobro aporte s/pago ${unidadDoc.data().nombre}`,
          monto: totalFondoRecaudado, // Positivo
          saldoResultante: saldoNuevoFondo,
          liquidacionId: null,
          gastoId: null
        });
      }
    }); // --- FIN DE LA TRANSACCIÓN ---

    console.log(`Pago de ${montoPagado} registrado y aplicado para unidad ${unidadId}`);
  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN DE PAGO! ", error);
    throw new Error(`Error al registrar el pago: ${error.message}`);
  }
};

// --- getCuentaCorriente (Sin cambios) ---
export const getCuentaCorriente = (unidadId, callback) => {
    if (!unidadId) {
        callback(null, new Error("Falta el ID de la unidad."));
        return () => {};
    }
    let unidadData = null, movimientosData = null;
    let unsubscribeUnidad = null, unsubscribeMovimientos = null;

    const unidadRef = doc(db, "unidades", unidadId);
    unsubscribeUnidad = onSnapshot(unidadRef, (docSnap) => {
        if (docSnap.exists()) {
            unidadData = { id: docSnap.id, ...docSnap.data() };
            if (movimientosData !== null) callback({ unidad: unidadData, movimientos: movimientosData });
        } else {
            callback(null, new Error(`Unidad no encontrada.`));
        }
    }, (error) => callback(null, error));

    const ctaCteCollection = collection(db, `unidades/${unidadId}/cuentaCorriente`);
    const q = query(ctaCteCollection, orderBy("fecha", "asc"));
    unsubscribeMovimientos = onSnapshot(q, (querySnapshot) => {
        const movimientos = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            movimientos.push({ id: doc.id, ...data, fecha: data.fecha?.toDate() });
        });
        movimientosData = movimientos;
        if (unidadData) callback({ unidad: unidadData, movimientos: movimientosData });
    }, (error) => callback(null, error));

    return () => {
        if (unsubscribeUnidad) unsubscribeUnidad();
        if (unsubscribeMovimientos) unsubscribeMovimientos();
    };
};

// --- getSaldoFondoActual (Sin cambios) ---
export const getSaldoFondoActual = (callback) => {
  const configRef = doc(db, "configuracion", "general");

  const unsubscribe = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const saldo = docSnap.data().saldoFondoReserva || 0;
      callback(saldo, null);
    } else {
      console.warn("Documento 'configuracion/general' no encontrado.");
      callback(0, null);
    }
  }, (error) => {
    console.error("Error al obtener saldo del fondo:", error);
    callback(0, error);
  });

  return unsubscribe;
};

// --- resetearSaldosUnidades (Sin cambios) ---
export const resetearSaldosUnidades = async () => {
  console.warn(" Iniciando reseteo total de saldos y cuentas corrientes...");
  const unidadesCollection = collection(db, "unidades");
  const unidadesSnapshot = await getDocs(unidadesCollection);
  let unidadesActualizadas = 0;
  let movimientosBorrados = 0;
  let contadorErrores = 0;

  console.log(` > Encontradas ${unidadesSnapshot.docs.length} unidades para resetear.`);

  const promesasResetUnidad = unidadesSnapshot.docs.map(async (unidadDoc) => {
    const unidadRef = unidadDoc.ref;
    console.log(` -> Procesando unidad: ${unidadDoc.id} (${unidadDoc.data().nombre || 'Sin nombre'})`);

    try {
      await updateDoc(unidadRef, { saldo: 0 });
      unidadesActualizadas++;

      const ctaCteCollectionRef = collection(db, `unidades/${unidadDoc.id}/cuentaCorriente`);
      const ctaCteSnapshot = await getDocs(ctaCteCollectionRef);
      console.log(`    Encontrados ${ctaCteSnapshot.docs.length} movimientos en Cta. Cte. para borrar en ${unidadDoc.id}.`);

      for (const movDoc of ctaCteSnapshot.docs) {
          try {
              await deleteDoc(movDoc.ref);
              movimientosBorrados++;
          } catch (deleteMovError) {
              console.error(`      ERROR borrando movimiento ${movDoc.id} de unidad ${unidadDoc.id}:`, deleteMovError);
              contadorErrores++;
          }
      }
    } catch (unidadError) {
      console.error(`  ERROR reseteando unidad ${unidadDoc.id}:`, unidadError);
      contadorErrores++;
    }
  });

  await Promise.all(promesasResetUnidad);

  console.warn(` Reseteo de unidades completado. Saldos actualizados: ${unidadesActualizadas}, Movimientos borrados: ${movimientosBorrados}, Errores: ${contadorErrores}`);
  if (contadorErrores > 0) {
    throw new Error(`Ocurrieron ${contadorErrores} errores al resetear unidades/cta cte.`);
  }
  return { unidadesActualizadas, movimientosBorrados };
};

// --- resetearFondoReserva (Sin cambios) ---
export const resetearFondoReserva = async () => {
  console.warn("Reseteando Saldo Fondo de Reserva a 0...");
  const configRef = doc(db, "configuracion", "general");
  try {
    await setDoc(configRef, { saldoFondoReserva: 0 }, { merge: true });
    console.log("Saldo Fondo de Reserva reseteado a 0.");
    return 1;
  } catch (error) {
    console.error("Error al resetear fondo de reserva:", error);
    throw new Error("No se pudo resetear el Fondo de Reserva.");
  }
};