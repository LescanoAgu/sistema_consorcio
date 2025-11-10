// src/services/propietariosService.js
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, getDocs,
  runTransaction, doc, Timestamp, where,
  updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { registrarMovimientoFondo } from './fondoService';

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

// --- registrarPago (Sin cambios) ---
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
      const deudasQuery = query(
        ctaCteCollectionRef,
        where("monto", "<", 0),
        where("pagado", "==", false),
        orderBy("fecha", "asc")
      );
      
      const deudasSnapshot = await getDocs(deudasQuery); 
      const deudasRefs = deudasSnapshot.docs.map(d => d.ref);
      
      const deudasDocsEnTransaccion = await Promise.all(
        deudasRefs.map(ref => transaction.get(ref))
      );

      if (deudasDocsEnTransaccion.length > 0) {
        console.log(`Encontradas ${deudasDocsEnTransaccion.length} deudas pendientes para ${unidadId}`);
        
        for (const deudaDoc of deudasDocsEnTransaccion) {
          if (montoRestante <= 0) break;

          const deudaData = deudaDoc.data();
          const montoDeudaTotal = Math.abs(deudaData.monto); 
          const montoDeudaPendiente = montoDeudaTotal - (deudaData.montoAplicado || 0);

          const montoAAplicar = Math.min(montoRestante, montoDeudaPendiente);
          
          if (montoAAplicar > 0) {
            const nuevoMontoAplicado = (deudaData.montoAplicado || 0) + montoAAplicar;
            const estaPagadaCompleta = nuevoMontoAplicado >= montoDeudaTotal - 0.01;

            transaction.update(deudaDoc.ref, {
              montoAplicado: nuevoMontoAplicado,
              pagado: estaPagadaCompleta
            });

            montoRestante -= montoAAplicar;
            
            if (deudaData.tipo && deudaData.tipo.includes('_BASE') && deudaData.desglose && deudaData.desglose.aporteFondo > 0) {
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
        montoAplicado: montoPagado,
        tipo: "PAGO_RECIBIDO"
      });

      // 4. Actualizar el saldo total de la unidad
      transaction.update(unidadRef, { saldo: saldoResultanteUnidad });

      // 5. Actualizar el Fondo de Reserva si recaudamos algo
      if (totalFondoRecaudado > 0) {
        const configDoc = await transaction.get(configRef);
        const saldoActualFondo = configDoc.exists() ? (configDoc.data().saldoFondoReserva || 0) : 0;
        const saldoNuevoFondo = saldoActualFondo + totalFondoRecaudado;

        transaction.update(configRef, { saldoFondoReserva: saldoNuevoFondo });

        transaction.set(doc(collection(db, "historicoFondoReserva")), {
          fecha: fechaTimestamp,
          concepto: `Cobro aporte s/pago ${unidadDoc.data().nombre}`,
          monto: totalFondoRecaudado,
          saldoResultante: saldoNuevoFondo,
          liquidacionId: null,
          gastoId: null
        });
      }
    });

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

// --- FUNCIONES PARA TASA DE MORA ---

const TASA_MORA_DOC_REF = doc(db, "configuracion", "tasas_mora");

export const getTasaMoraProlongada = (callback) => {
  const unsubscribe = onSnapshot(TASA_MORA_DOC_REF, (docSnap) => {
    if (docSnap.exists()) {
      const tasa = docSnap.data().tasaBNA || 0.07;
      callback(tasa);
    } else {
      setDoc(TASA_MORA_DOC_REF, { tasaBNA: 0.07 }, { merge: true });
      callback(0.07);
    }
  }, (error) => {
    console.error("Error al obtener tasa de mora:", error);
    callback(0.07);
  });

  return unsubscribe;
};

export const setTasaMoraProlongada = async (tasaDecimal) => {
  if (typeof tasaDecimal !== 'number' || isNaN(tasaDecimal) || tasaDecimal < 0) {
    throw new Error("La tasa debe ser un número positivo.");
  }
  try {
    await setDoc(TASA_MORA_DOC_REF, { 
      tasaBNA: tasaDecimal, 
      ultimaActualizacion: serverTimestamp() 
    }, { merge: true });
    console.log("Tasa BNA actualizada a:", tasaDecimal);
  } catch (error) {
    console.error("Error al establecer tasa BNA:", error);
    throw new Error("No se pudo actualizar la tasa de mora.");
  }
};


// --- ¡APLICAR INTERÉS MANUAL! ---

/**
 * Aplica un cargo de interés manual a la cta cte de una unidad.
 * Es transaccional.
 */
export const aplicarInteresManual = async (unidadId, mesOrigen, montoInteres, tipoInteres, conceptoManual, tasaAplicada, parentId = null) => {
  if (!unidadId || !mesOrigen || !montoInteres || !tipoInteres || !conceptoManual) {
    throw new Error("Faltan datos para aplicar el interés.");
  }
  if (montoInteres <= 0) {
    throw new Error("El monto del interés debe ser un número positivo.");
  }

  const unidadRef = doc(db, "unidades", unidadId);
  const ctaCteRef = doc(collection(db, `unidades/${unidadId}/cuentaCorriente`));
  const montoDebito = -Math.abs(montoInteres); // El interés es un débito
  const mesAplicacion = new Date().toISOString().substring(0, 7); // YYYY-MM

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Leer saldo actual de la unidad
      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) throw new Error("La unidad no existe.");
      
      const saldoAnterior = unidadDoc.data().saldo || 0;
      const saldoResultante = saldoAnterior + montoDebito;

      // 2. Crear el nuevo movimiento de interés
      const nuevoMovimientoInteres = {
        fecha: Timestamp.now(),
        concepto: conceptoManual,
        monto: montoDebito,
        saldoResultante: saldoResultante,
        
        liquidacionId: null, // Es manual
        unidadId: unidadId,
        
        tipo: tipoInteres,
        mes_origen: mesOrigen,
        mes_aplicacion: mesAplicacion,
        tasa_aplicada: tasaAplicada || null,
        parentId: parentId, // Vincula al movimiento padre
        
        pagado: false,
        montoAplicado: 0
      };

      // 3. Escribir el nuevo movimiento
      transaction.set(ctaCteRef, nuevoMovimientoInteres);
      
      // 4. Actualizar el saldo principal de la unidad
      transaction.update(unidadRef, { saldo: saldoResultante });
    });
    
    console.log(`Interés manual registrado para ${unidadId}.`);
    
  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN (Interés Manual)! ", error);
    throw new Error(`Error al registrar el interés: ${error.message}`);
  }
};

/**
 * Elimina un movimiento de débito (interés o base) que no haya sido pagado.
 * Es transaccional.
 */
export const eliminarMovimientoDebito = async (unidadId, movimientoId) => {
  if (!unidadId || !movimientoId) {
    throw new Error("Faltan IDs para eliminar el movimiento.");
  }

  const unidadRef = doc(db, "unidades", unidadId);
  const ctaCteRef = doc(db, `unidades/${unidadId}/cuentaCorriente`, movimientoId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Leer el movimiento a borrar
      const movDoc = await transaction.get(ctaCteRef);
      if (!movDoc.exists()) throw new Error("El movimiento a eliminar no existe.");
      
      const movData = movDoc.data();
      
      // 2. Validar que no esté pagado
      if (movData.pagado === true || (movData.montoAplicado || 0) > 0) {
        throw new Error("No se puede eliminar un movimiento que ya tiene pagos aplicados.");
      }
      
      // 3. Validar que sea un débito (monto < 0)
      if (movData.monto >= 0) {
        throw new Error("No se puede eliminar un movimiento de crédito (pago).");
      }

      // 4. Leer el saldo actual de la unidad
      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) throw new Error("La unidad no existe.");
      
      const saldoAnterior = unidadDoc.data().saldo || 0;
      // Revertimos el débito (sumamos el valor absoluto)
      const saldoResultante = saldoAnterior + Math.abs(movData.monto); 

      // 5. Eliminar el movimiento
      transaction.delete(ctaCteRef);
      
      // 6. Actualizar el saldo principal de la unidad
      transaction.update(unidadRef, { saldo: saldoResultante });
    });
    
    console.log(`Movimiento ${movimientoId} eliminado exitosamente de ${unidadId}.`);

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN (Eliminar Movimiento)! ", error);
    throw new Error(`Error al eliminar: ${error.message}`);
  }
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