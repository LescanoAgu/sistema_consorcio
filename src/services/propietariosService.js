// src/services/propietariosService.js
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, getDocs,
  runTransaction, doc, Timestamp, where,
  updateDoc, deleteDoc // Asegúrate que updateDoc y deleteDoc estén importados
} from 'firebase/firestore';

// --- crearUnidad ---
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

// --- getUnidades ---
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

// --- getTodasUnidades ---
export const getTodasUnidades = async () => {
  const q = query(collection(db, "unidades"));
  const querySnapshot = await getDocs(q);
  const unidades = [];
  querySnapshot.forEach((doc) => {
    unidades.push({ id: doc.id, ...doc.data() });
  });
  return unidades;
};

// --- aplicarInteresesMoratorios ---
export const aplicarInteresesMoratorios = async (tasaMensual, concepto) => {
    if (!tasaMensual || tasaMensual <= 0) throw new Error("La tasa de interés debe ser un número positivo.");
    if (!concepto || concepto.trim() === '') throw new Error("El concepto para el registro es obligatorio.");

    const q = query(collection(db, "unidades"), where("saldo", "<", 0));
    const deudoresSnapshot = await getDocs(q);

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
                    liquidacionId: null, unidadId: unidadDoc.id
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

// --- registrarPago ---
export const registrarPago = async (unidadId, montoPagado, fechaPago, conceptoPago) => {
    if (!unidadId) throw new Error("Se requiere el ID de la unidad.");
    if (!montoPagado || montoPagado <= 0) throw new Error("El monto pagado debe ser un número positivo.");
    if (!fechaPago) throw new Error("La fecha de pago es obligatoria.");
    if (!conceptoPago || conceptoPago.trim() === '') throw new Error("El concepto del pago es obligatorio.");

    const fechaTimestamp = Timestamp.fromDate(new Date(`${fechaPago}T00:00:00Z`));
    const unidadRef = doc(db, "unidades", unidadId);

    try {
        await runTransaction(db, async (transaction) => {
            const unidadDoc = await transaction.get(unidadRef);
            if (!unidadDoc.exists()) throw new Error(`La unidad con ID ${unidadId} no existe.`);
            const saldoAnterior = unidadDoc.data().saldo;
            const saldoResultante = saldoAnterior + montoPagado;

            transaction.update(unidadRef, { saldo: saldoResultante });

            const ctaCteRef = doc(collection(db, `unidades/${unidadId}/cuentaCorriente`));
            const itemCtaCte = {
                fecha: fechaTimestamp, concepto: conceptoPago, monto: montoPagado, saldoResultante,
                liquidacionId: null, unidadId: unidadId
            };
            transaction.set(ctaCteRef, itemCtaCte);
        });
        console.log(`Pago de ${montoPagado} registrado para unidad ${unidadId}`);
    } catch (error) {
        console.error("¡FALLÓ LA TRANSACCIÓN DE PAGO! ", error);
        throw new Error(`Error al registrar el pago: ${error.message}`);
    }
};

// --- getCuentaCorriente ---
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

// --- FUNCIÓN DE RESETEO (con más logging) ---
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
    console.log(` -> Procesando unidad: ${unidadDoc.id} (${unidadDoc.data().nombre || 'Sin nombre'})`); // Añadido fallback por si nombre no existe

    try {
      // 1. Resetear saldo a 0
      console.log(`    Intentando poner saldo a 0 para ${unidadDoc.id}`);
      await updateDoc(unidadRef, { saldo: 0 });
      console.log(`    Saldo reseteado para ${unidadDoc.id}`);
      unidadesActualizadas++;

      // 2. Borrar subcolección cuentaCorriente
      const ctaCteCollectionRef = collection(db, `unidades/${unidadDoc.id}/cuentaCorriente`); // Renombrado para claridad
      const ctaCteSnapshot = await getDocs(ctaCteCollectionRef);
      console.log(`    Encontrados ${ctaCteSnapshot.docs.length} movimientos en Cta. Cte. para borrar en ${unidadDoc.id}.`);

      // Borrado secuencial para evitar posibles problemas de concurrencia masiva (más lento pero más seguro)
      for (const movDoc of ctaCteSnapshot.docs) {
          try {
              await deleteDoc(movDoc.ref);
              movimientosBorrados++;
          } catch (deleteMovError) {
              console.error(`      ERROR borrando movimiento ${movDoc.id} de unidad ${unidadDoc.id}:`, deleteMovError);
              contadorErrores++;
          }
      }
      // Alternativa con Promise.all (más rápido, pero puede fallar si hay demasiados documentos)
      /*
      const promesasDeleteMovimientos = ctaCteSnapshot.docs.map(async (movDoc) => {
        try {
          await deleteDoc(movDoc.ref);
          movimientosBorrados++;
        } catch (deleteMovError) {
          console.error(`      ERROR borrando movimiento ${movDoc.id} de unidad ${unidadDoc.id}:`, deleteMovError);
          contadorErrores++;
        }
      });
      await Promise.all(promesasDeleteMovimientos);
      */
      console.log(`    Movimientos borrados para ${unidadDoc.id}`);

    } catch (unidadError) {
      console.error(`  ERROR reseteando unidad ${unidadDoc.id}:`, unidadError);
      contadorErrores++;
    }
  });

  await Promise.all(promesasResetUnidad); // Espera a que todas las unidades terminen

  console.warn(` Reseteo de unidades completado. Saldos actualizados: ${unidadesActualizadas}, Movimientos borrados: ${movimientosBorrados}, Errores: ${contadorErrores}`);
  if (contadorErrores > 0) {
    throw new Error(`Ocurrieron ${contadorErrores} errores al resetear unidades/cta cte.`);
  }
  return { unidadesActualizadas, movimientosBorrados };
};
  
export const resetearFondoReserva = async () => {
  console.warn("Reseteando Saldo Fondo de Reserva a 0...");
  const configRef = doc(db, "configuracion", "general");
  try {
    // Usamos setDoc con merge: true para crear el documento si no existe,
    // o actualizarlo si ya existe.
    await setDoc(configRef, { saldoFondoReserva: 0 }, { merge: true });
    console.log("Saldo Fondo de Reserva reseteado a 0.");
    return 1; // 1 documento actualizado/creado
  } catch (error) {
    console.error("Error al resetear fondo de reserva:", error);
    throw new Error("No se pudo resetear el Fondo de Reserva.");
  }
};