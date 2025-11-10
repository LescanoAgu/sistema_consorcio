// src/services/fondoService.js
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy,
  getDocs, deleteDoc // <-- Asegurarse que getDocs y deleteDoc estén
} from 'firebase/firestore';

/**
 * Registra un nuevo movimiento en el historial del fondo de reserva.
 * @param {string} concepto Descripción (Ej: "Aporte Liq. Nov/25" o "Gasto Bomba de Agua")
 * @param {number} monto Monto del movimiento (Positivo para ingresos, Negativo para egresos)
 * @param {number} saldoResultante El saldo final del fondo después de este movimiento.
 * @param {string|null} liquidacionId ID de la liquidación (si es un aporte)
 * @param {string|null} gastoId ID del gasto (si es un egreso)
 */
export const registrarMovimientoFondo = async (concepto, monto, saldoResultante, liquidacionId = null, gastoId = null, facturaURL = null) => {
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
    await addDoc(collection(db, "historicoFondoReserva"), nuevoMovimiento);
    console.log("Movimiento de fondo registrado:", concepto, monto);
  } catch (error) {
    console.error("Error al registrar movimiento de fondo:", error);
    // No lanzamos error para no frenar la liquidación/gasto si esto falla
  }
};

/**
 * Obtiene el historial de movimientos del fondo en tiempo real.
 * @param {function} callback Función que recibe los movimientos.
 * @returns {function} Función para desuscribirse.
 */
export const getHistorialFondo = (callback) => {
  const q = query(collection(db, "historicoFondoReserva"), orderBy("fecha", "desc"));

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

// --- ¡NUEVA FUNCIÓN AÑADIDA! ---
/**
 * Borra todos los documentos de la colección 'historicoFondoReserva'.
 */
export const resetearHistorialFondo = async () => {
  console.warn("Iniciando reseteo del Historial del Fondo de Reserva...");
  const historialCollection = collection(db, "historicoFondoReserva");
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