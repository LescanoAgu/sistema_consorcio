// src/services/propietariosService.js
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, getDocs,
  runTransaction, doc, Timestamp, where, // <-- Asegúrate que Timestamp esté
  updateDoc, deleteDoc, setDoc,
  writeBatch, increment // <-- ¡IMPORTAR ESTOS DOS!
} from 'firebase/firestore';
import { registrarMovimientoFondo } from './fondoService';

// --- crearUnidad (sin cambios) ---
export const crearUnidad = async (consorcioId, unidadData) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para crear unidad.");
  
  const { nombre, propietario, porcentaje } = unidadData;
  const nuevaUnidad = {
    nombre,
    propietario,
    porcentaje: parseFloat(porcentaje),
    saldo: 0,
    createdAt: serverTimestamp()
  };
  try {
    const unidadesCollectionRef = collection(db, `consorcios/${consorcioId}/unidades`);
    const docRef = await addDoc(unidadesCollectionRef, nuevaUnidad);
    
    console.log("Unidad registrada con ID: ", docRef.id, "en consorcio:", consorcioId);
    return docRef;
  } catch (error) {
    console.error("Error al guardar la unidad: ", error);
    throw new Error('No se pudo guardar la unidad.');
  }
};

// --- getUnidades (sin cambios) ---
export const getUnidades = (consorcioId, callback) => {
  if (!consorcioId) {
    callback([], new Error("consorcioId no fue provisto a getUnidades"));
    return () => {};
  }
  
  const unidadesCollectionRef = collection(db, `consorcios/${consorcioId}/unidades`);
  const q = query(unidadesCollectionRef, orderBy("nombre", "asc"));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const unidades = [];
    querySnapshot.forEach((doc) => {
      unidades.push({ id: doc.id, ...doc.data() });
    });
    callback(unidades);
  }, (error) => {
      console.error(`Error obteniendo unidades para consorcio ${consorcioId}:`, error);
      callback([], error);
  });
  return unsubscribe;
};

// --- getTodasUnidades (sin cambios) ---
export const getTodasUnidades = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para getTodasUnidades.");
  
  const q = query(collection(db, `consorcios/${consorcioId}/unidades`));
  const querySnapshot = await getDocs(q);
  const unidades = [];
  querySnapshot.forEach((doc) => {
    unidades.push({ id: doc.id, ...doc.data() });
  });
  return unidades;
};

// --- registrarPago (¡CORREGIDO!) ---
export const registrarPago = async (consorcioId, unidadId, montoPagado, fechaPago, conceptoPago) => {
  if (!consorcioId) throw new Error("Se requiere el ID del consorcio.");
  if (!unidadId) throw new Error("Se requiere el ID de la unidad.");
  if (!montoPagado || montoPagado <= 0) throw new Error("El monto pagado debe ser un número positivo.");
  if (!fechaPago) throw new Error("La fecha de pago es obligatoria.");
  if (!conceptoPago || conceptoPago.trim() === '') throw new Error("El concepto del pago es obligatorio.");

  const fechaTimestamp = Timestamp.fromDate(new Date(`${fechaPago}T00:00:00Z`));
  
  const unidadRef = doc(db, `consorcios/${consorcioId}/unidades`, unidadId);
  const configRef = doc(db, `consorcios/${consorcioId}/configuracion`, "general");
  const ctaCteCollectionRef = collection(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`);
  
  // 1. Ejecutar la CONSULTA de deudas AFUERA de la transacción.
  const deudasQuery = query(
    ctaCteCollectionRef,
    where("monto", "<", 0),
    where("pagado", "==", false),
    orderBy("fecha", "asc")
  );
  const deudasSnapshot = await getDocs(deudasQuery);
  const deudasRefs = deudasSnapshot.docs.map(d => d.ref);

  try {
    await runTransaction(db, async (transaction) => {
      let montoRestante = montoPagado;
      let totalFondoRecaudado = 0;
      let conceptosDeudasPagadas = [];

      // --- INICIO BLOQUE DE LECTURAS ---
      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) throw new Error(`La unidad con ID ${unidadId} no existe.`);
      const saldoAnteriorUnidad = unidadDoc.data().saldo;
      
      const configDoc = await transaction.get(configRef);
      const saldoActualFondo = configDoc.exists() ? (configDoc.data().saldoFondoReserva || 0) : 0;
      
      const deudasDocsEnTransaccion = await Promise.all(
        deudasRefs.map(ref => transaction.get(ref))
      );
      // --- FIN BLOQUE DE LECTURAS ---

      // --- INICIO BLOQUE DE ESCRITURAS ---
      if (deudasDocsEnTransaccion.length > 0) {
        for (const deudaDoc of deudasDocsEnTransaccion) {
          if (montoRestante <= 0) break;
          const deudaData = deudaDoc.data();
          if (deudaData) { 
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
        }
      }

      const saldoResultanteUnidad = saldoAnteriorUnidad + montoPagado;
      const ctaCtePagoRef = doc(ctaCteCollectionRef);
      
      let conceptoFinalPago = conceptoPago;
      if (conceptosDeudasPagadas.length > 0) {
         conceptoFinalPago = `${conceptoPago} (Aplica a: ${conceptosDeudasPagadas.slice(0, 2).join(', ')}${conceptosDeudasPagadas.length > 2 ? ', ...' : ''})`;
      }

      transaction.set(ctaCtePagoRef, {
        fecha: fechaTimestamp,
        concepto: conceptoFinalPago,
        monto: montoPagado,
        saldoResultante: saldoResultanteUnidad,
        liquidacionId: null,
        unidadId: unidadId,
        pagado: true,
        montoAplicado: montoPagado,
        tipo: "PAGO_RECIBIDO"
      });

      transaction.update(unidadRef, { saldo: saldoResultanteUnidad });

      if (totalFondoRecaudado > 0) {
        const saldoNuevoFondo = saldoActualFondo + totalFondoRecaudado;
        transaction.update(configRef, { saldoFondoReserva: saldoNuevoFondo });

        const historialFondoRef = doc(collection(db, `consorcios/${consorcioId}/historicoFondoReserva`));
        transaction.set(historialFondoRef, {
          fecha: fechaTimestamp,
          concepto: `Cobro aporte s/pago ${unidadDoc.data().nombre}`,
          monto: totalFondoRecaudado,
          saldoResultante: saldoNuevoFondo,
          liquidacionId: null,
          gastoId: null
        });
      }
      // --- FIN BLOQUE DE ESCRITURAS ---
    });

    console.log(`Pago de ${montoPagado} registrado y aplicado para unidad ${unidadId}`);
  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN DE PAGO! ", error);
    throw new Error(`Error al registrar el pago: ${error.message}`);
  }
};

// --- getCuentaCorriente (sin cambios) ---
export const getCuentaCorriente = (consorcioId, unidadId, callback) => {
    if (!consorcioId) {
        callback(null, new Error("Falta el ID del consorcio."));
        return () => {};
    }
    if (!unidadId) {
        callback(null, new Error("Falta el ID de la unidad."));
        return () => {};
    }
    
    let unidadData = null, movimientosData = null;
    let unsubscribeUnidad = null, unsubscribeMovimientos = null;

    const unidadRef = doc(db, `consorcios/${consorcioId}/unidades`, unidadId);
    
    unsubscribeUnidad = onSnapshot(unidadRef, (docSnap) => {
        if (docSnap.exists()) {
            unidadData = { id: docSnap.id, ...docSnap.data() };
            if (movimientosData !== null) callback({ unidad: unidadData, movimientos: movimientosData });
        } else {
            callback(null, new Error(`Unidad no encontrada.`));
        }
    }, (error) => callback(null, error));

    const ctaCteCollection = collection(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`);
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

// --- getSaldoFondoActual (sin cambios) ---
export const getSaldoFondoActual = (consorcioId, callback) => {
  if (!consorcioId) {
    callback(0, new Error("consorcioId no fue provisto a getSaldoFondoActual"));
    return () => {};
  }
  
  const configRef = doc(db, `consorcios/${consorcioId}/configuracion`, "general");

  const unsubscribe = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const saldo = docSnap.data().saldoFondoReserva || 0;
      callback(saldo, null);
    } else {
      console.warn(`Documento 'configuracion/general' no encontrado para consorcio ${consorcioId}.`);
      callback(0, null);
    }
  }, (error) => {
    console.error("Error al obtener saldo del fondo:", error);
    callback(0, error);
  });

  return unsubscribe;
};

// --- Tasas de Mora (sin cambios) ---
const getTasaMoraDocRef = (consorcioId) => doc(db, `consorcios/${consorcioId}/configuracion`, "tasas_mora");
export const getTasaMoraProlongada = (consorcioId, callback) => {
  if (!consorcioId) {
    callback(0.07, new Error("consorcioId no fue provisto a getTasaMoraProlongada"));
    return () => {};
  }
  const TASA_MORA_DOC_REF = getTasaMoraDocRef(consorcioId);
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
export const setTasaMoraProlongada = async (consorcioId, tasaDecimal) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para setTasaMoraProlongada.");
  if (typeof tasaDecimal !== 'number' || isNaN(tasaDecimal) || tasaDecimal < 0) {
    throw new Error("La tasa debe ser un número positivo.");
  }
  const TASA_MORA_DOC_REF = getTasaMoraDocRef(consorcioId);
  try {
    await setDoc(TASA_MORA_DOC_REF, { 
      tasaBNA: tasaDecimal, 
      ultimaActualizacion: serverTimestamp() 
    }, { merge: true });
    console.log(`Tasa BNA actualizada a: ${tasaDecimal} para consorcio ${consorcioId}`);
  } catch (error) {
    console.error("Error al establecer tasa BNA:", error);
    throw new Error("No se pudo actualizar la tasa de mora.");
  }
};

// --- aplicarInteresManual (sin cambios) ---
export const aplicarInteresManual = async (consorcioId, unidadId, mesOrigen, montoInteres, tipoInteres, conceptoManual, tasaAplicada, parentId = null) => {
  if (!consorcioId) throw new Error("consorcioId es requerido.");
  if (!unidadId || !mesOrigen || !montoInteres || !tipoInteres || !conceptoManual) {
    throw new Error("Faltan datos para aplicar el interés.");
  }
  if (montoInteres <= 0) {
    throw new Error("El monto del interés debe ser un número positivo.");
  }

  const unidadRef = doc(db, `consorcios/${consorcioId}/unidades`, unidadId);
  const ctaCteRef = doc(collection(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`));
  
  const montoDebito = -Math.abs(montoInteres);
  const mesAplicacion = new Date().toISOString().substring(0, 7);

  try {
    await runTransaction(db, async (transaction) => {
      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) throw new Error("La unidad no existe.");
      
      const saldoAnterior = unidadDoc.data().saldo || 0;
      const saldoResultante = saldoAnterior + montoDebito;

      const nuevoMovimientoInteres = {
        fecha: Timestamp.now(),
        concepto: conceptoManual,
        monto: montoDebito,
        saldoResultante: saldoResultante,
        liquidacionId: null,
        unidadId: unidadId,
        tipo: tipoInteres,
        mes_origen: mesOrigen,
        mes_aplicacion: mesAplicacion,
        tasa_aplicada: tasaAplicada || null,
        parentId: parentId,
        pagado: false,
        montoAplicado: 0
      };

      transaction.set(ctaCteRef, nuevoMovimientoInteres);
      transaction.update(unidadRef, { saldo: saldoResultante });
    });
    
    console.log(`Interés manual registrado para ${unidadId} en consorcio ${consorcioId}.`);
    
  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN (Interés Manual)! ", error);
    throw new Error(`Error al registrar el interés: ${error.message}`);
  }
};

// --- eliminarMovimientoDebito (sin cambios) ---
export const eliminarMovimientoDebito = async (consorcioId, unidadId, movimientoId) => {
  if (!consorcioId || !unidadId || !movimientoId) {
    throw new Error("Faltan IDs para eliminar el movimiento.");
  }

  const unidadRef = doc(db, `consorcios/${consorcioId}/unidades`, unidadId);
  const ctaCteRef = doc(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`, movimientoId);

  try {
    await runTransaction(db, async (transaction) => {
      const movDoc = await transaction.get(ctaCteRef);
      if (!movDoc.exists()) throw new Error("El movimiento a eliminar no existe.");
      
      const movData = movDoc.data();
      
      if (movData.pagado === true || (movData.montoAplicado || 0) > 0) {
        throw new Error("No se puede eliminar un movimiento que ya tiene pagos aplicados.");
      }
      if (movData.monto >= 0) {
        throw new Error("No se puede eliminar un movimiento de crédito (pago).");
      }

      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) throw new Error("La unidad no existe.");
      
      const saldoAnterior = unidadDoc.data().saldo || 0;
      const saldoResultante = saldoAnterior + Math.abs(movData.monto); 

      transaction.delete(ctaCteRef);
      transaction.update(unidadRef, { saldo: saldoResultante });
    });
    
    console.log(`Movimiento ${movimientoId} eliminado de ${unidadId} en consorcio ${consorcioId}.`);

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN (Eliminar Movimiento)! ", error);
    throw new Error(`Error al eliminar: ${error.message}`);
  }
};

// --- resetearSaldosUnidades (sin cambios) ---
export const resetearSaldosUnidades = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para resetear saldos.");
  
  console.warn(`Iniciando reseteo total de saldos y ctas corrientes para consorcio ${consorcioId}...`);
  
  const unidadesCollection = collection(db, `consorcios/${consorcioId}/unidades`);
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

      const ctaCteCollectionRef = collection(db, `consorcios/${consorcioId}/unidades/${unidadDoc.id}/cuentaCorriente`);
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

// --- resetearFondoReserva (sin cambios) ---
export const resetearFondoReserva = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para resetear fondo.");

  console.warn(`Reseteando Saldo Fondo de Reserva a 0 para consorcio ${consorcioId}...`);
  
  const configRef = doc(db, `consorcios/${consorcioId}/configuracion`, "general");
  try {
    await setDoc(configRef, { saldoFondoReserva: 0 }, { merge: true });
    console.log("Saldo Fondo de Reserva reseteado a 0.");
    return 1;
  } catch (error) {
    console.error("Error al resetear fondo de reserva:", error);
    throw new Error("No se pudo resetear el Fondo de Reserva.");
  }
};

// --- getDeudasPendientes (sin cambios) ---
export const getDeudasPendientes = async (consorcioId, unidadId) => {
  if (!consorcioId || !unidadId) {
    throw new Error("Faltan IDs de consorcio o unidad.");
  }
  
  const ctaCteCollectionRef = collection(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`);
  
  const q = query(
    ctaCteCollectionRef,
    where("pagado", "==", false),
    where("monto", "<", 0),
    orderBy("fecha", "asc")
  );

  const querySnapshot = await getDocs(q);
  
  const deudas = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    deudas.push({ 
        id: doc.id, 
        ...data, 
        fecha: data.fecha?.toDate()
    });
  });

  return deudas;
};

// --- crearUnidadesBatch (sin cambios) ---
export const crearUnidadesBatch = async (consorcioId, unidades) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para crear unidades batch.");
  if (!unidades || unidades.length === 0) throw new Error("La lista de unidades está vacía.");

  const batch = writeBatch(db);
  const unidadesCollectionRef = collection(db, `consorcios/${consorcioId}/unidades`);
  let unidadesProcesadas = 0;

  unidades.forEach((unidad) => {
    const porcentajeNum = parseFloat(String(unidad.porcentaje).replace(',', '.'));
    if (!unidad.nombre || !unidad.propietario || isNaN(porcentajeNum)) {
      console.warn("Omitiendo fila inválida:", unidad);
      return; 
    }

    const newUnidadRef = doc(unidadesCollectionRef);
    
    const nuevaUnidad = {
      nombre: String(unidad.nombre),
      propietario: String(unidad.propietario),
      porcentaje: porcentajeNum,
      saldo: 0,
      createdAt: serverTimestamp()
    };

    batch.set(newUnidadRef, nuevaUnidad);
    unidadesProcesadas++;
  });

  if (unidadesProcesadas === 0) {
    throw new Error("No se encontraron unidades válidas para procesar.");
  }

  try {
    await batch.commit();
    console.log(`¡Batch completado! ${unidadesProcesadas} unidades creadas.`);
    return unidadesProcesadas;
  } catch (error) {
    console.error("Error al ejecutar el batch de unidades:", error);
    throw new Error(`No se pudieron guardar las unidades: ${error.message}`);
  }
};

// --- ¡NUEVA FUNCIÓN! Cargar Deudas Históricas ---
/**
 * Carga movimientos históricos (débitos) a la cuenta corriente de una unidad.
 * Estos movimientos deben incluir mes_origen y se marcan como no pagados.
 * @param {string} consorcioId ID del consorcio.
 * @param {string} unidadId ID de la unidad.
 * @param {Array<object>} movimientos Lista de movimientos ({fecha, concepto, monto, mes_origen}).
 */
export const cargarMovimientosHistoricosBatch = async (consorcioId, unidadId, movimientos) => {
  if (!consorcioId || !unidadId) throw new Error("IDs de consorcio o unidad requeridos.");
  if (!movimientos || movimientos.length === 0) throw new Error("La lista de movimientos está vacía.");

  const batch = writeBatch(db);
  const unidadRef = doc(db, `consorcios/${consorcioId}/unidades`, unidadId);
  const ctaCteCollectionRef = collection(db, `consorcios/${consorcioId}/unidades/${unidadId}/cuentaCorriente`);

  let totalDebito = 0;
  let movimientosProcesados = 0;

  try {
    for (const mov of movimientos) {
      // Aseguramos que el monto sea un débito (negativo)
      const montoDebito = -Math.abs(parseFloat(String(mov.monto).replace(',', '.')));
      
      // Validar la fila
      if (isNaN(montoDebito) || montoDebito >= 0 || !mov.mes_origen || !mov.fecha || !mov.concepto) {
        console.warn("Omitiendo movimiento histórico inválido (faltan datos o monto es 0):", mov);
        continue;
      }
      
      // Validar formato de fecha (simple)
      let fechaTimestamp;
      try {
         // Intentar parsear la fecha. Excel a veces devuelve números de serie.
         // Esta es una conversión simple, puede necesitar ajustes si Excel exporta fechas raras.
         let date = new Date(mov.fecha);
         if (isNaN(date.getTime())) {
             // Si falla, intentar parsear como YYYY-MM-DD
             const parts = String(mov.fecha).split('-');
             if (parts.length === 3) {
                date = new Date(parts[0], parts[1] - 1, parts[2]); // Asume formato YYYY-MM-DD
             } else {
                 throw new Error('Formato de fecha no reconocido.');
             }
         }
         fechaTimestamp = Timestamp.fromDate(date);
      } catch (dateError) {
          console.warn(`Fecha inválida omitida (${mov.fecha}):`, mov);
          continue;
      }
      
      const ctaCteRef = doc(ctaCteCollectionRef); // Nuevo doc ID
      
      const nuevoMovimiento = {
        fecha: fechaTimestamp,
        concepto: `DEUDA HISTÓRICA: ${mov.concepto}`,
        monto: montoDebito,
        saldoResultante: null, // El saldo se actualizará al final, no por movimiento
        liquidacionId: null,
        unidadId: unidadId,
        tipo: 'DEUDA_HISTORICA', // Tipo específico para identificarlo
        mes_origen: mov.mes_origen, // Ejemplo: "2025-02"
        pagado: false,
        montoAplicado: 0
      };

      batch.set(ctaCteRef, nuevoMovimiento);
      totalDebito += montoDebito;
      movimientosProcesados++;
    }
    
    if (movimientosProcesados === 0) {
      throw new Error("No se encontraron movimientos de deuda válidos para procesar.");
    }
    
    // 2. Ejecutar batch para insertar movimientos
    await batch.commit();

    // 3. Actualizar SALDO FINAL de la unidad con un update separado
    // Usamos 'increment' para sumar de forma segura el débito total al saldo existente.
    await updateDoc(unidadRef, { 
        saldo: increment(totalDebito) 
    });

    console.log(`¡Batch completado! ${movimientosProcesados} movimientos históricos cargados. Saldo de unidad actualizado en ${totalDebito}.`);
    return movimientosProcesados;
    
  } catch (error) {
    console.error("Error al ejecutar el batch de movimientos históricos:", error);
    throw new Error(`No se pudieron guardar los movimientos históricos: ${error.message}`);
  }
};