// src/services/fondoService.js
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy,
  getDocs, deleteDoc
} from 'firebase/firestore';

/**
 * Registra un nuevo movimiento en el historial del fondo de reserva DE UN CONSORCIO.
 * @param {string} consorcioId ID del consorcio.
 * @param {string} concepto Descripción (Ej: "Aporte Liq. Nov/25" o "Gasto Bomba de Agua")
 * @param {number} monto Monto del movimiento (Positivo para ingresos, Negativo para egresos)
 * @param {number} saldoResultante El saldo final del fondo después de este movimiento.
 * @param {string|null} liquidacionId ID de la liquidación (si es un aporte)
 * @param {string|null} gastoId ID del gasto (si es un egreso)
 */
export const registrarMovimientoFondo = async (consorcioId, concepto, monto, saldoResultante, liquidacionId = null, gastoId = null, facturaURL = null) => {
  if (!consorcioId) {
    console.error("Error: consorcioId es requerido para registrar movimiento de fondo.");
    return; // No registrar si no hay consorcio
  }
  
  try {
    const nuevoMovimiento = {
      fecha: serverTimestamp(),
      concepto,
      monto,
      saldoResultante,
      liquidacionId,
      gastoId,
      facturaURL: facturaURL || null
    };
    
    // RUTA MODIFICADA: apunta a la sub-colección del consorcio
    const historialCollectionRef = collection(db, `consorcios/${consorcioId}/historicoFondoReserva`);
    
    await addDoc(historialCollectionRef, nuevoMovimiento);
    console.log("Movimiento de fondo registrado en consorcio:", consorcioId, concepto, monto);
  } catch (error) {
    console.error("Error al registrar movimiento de fondo:", error);
    // No lanzamos error para no frenar la liquidación/gasto si esto falla
  }
};

/**
 * Obtiene el historial de movimientos del fondo (de un consorcio) en tiempo real.
 * @param {string} consorcioId ID del consorcio.
 * @param {function} callback Función que recibe los movimientos.
 * @returns {function} Función para desuscribirse.
 */
export const getHistorialFondo = (consorcioId, callback) => {
  if (!consorcioId) {
    callback([], new Error("consorcioId no fue provisto a getHistorialFondo"));
    return () => {}; // Devuelve una función de desuscripción vacía
  }
  
  // RUTA MODIFICADA
  const historialCollectionRef = collection(db, `consorcios/${consorcioId}/historicoFondoReserva`);
  const q = query(historialCollectionRef, orderBy("fecha", "desc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const movimientos = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      movimientos.push({
        id: doc.id,
        ...data,
        fecha: data.fecha ? data.fecha.toDate() : new Date() // Convertir Timestamp
      });
    });
    callback(movimientos);
  }, (error) => {
    console.error("Error al obtener historial del fondo:", error);
    callback([], error);
  });

  return unsubscribe;
};

/**
 * Borra todos los documentos de la colección 'historicoFondoReserva' DE UN CONSORCIO.
 * @param {string} consorcioId ID del consorcio.
 */
export const resetearHistorialFondo = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para resetear historial.");
  
  console.warn(`Iniciando reseteo del Historial del Fondo de Reserva para consorcio ${consorcioId}...`);
  
  // RUTA MODIFICADA
  const historialCollection = collection(db, `consorcios/${consorcioId}/historicoFondoReserva`);
  const historialSnapshot = await getDocs(historialCollection);
  let contadorBorrados = 0;
  let contadorErrores = 0;

  if (historialSnapshot.empty) {
    console.log("No hay movimientos en el historial del fondo para borrar.");
    return 0;
  }

  const promesasDelete = historialSnapshot.docs.map(async (movDoc) => {
    try {
      await deleteDoc(movDoc.ref);
      contadorBorrados++;
    } catch (error) {
      console.error(`Error borrando movimiento ${movDoc.id}:`, error);
      contadorErrores++;
    }
  });

  await Promise.all(promesasDelete);

  console.warn(`Reseteo del Historial del Fondo completado. Borrados: ${contadorBorrados}, Errores: ${contadorErrores}`);
  if (contadorErrores > 0) {
    throw new Error(`Ocurrieron ${contadorErrores} errores al borrar el historial del fondo.`);
  }
  return contadorBorrados;
};