// Arriba de todo en propietariosService.js
import { db } from '../config/firebase';
import { 
  collection, addDoc, serverTimestamp, 
  onSnapshot, query, orderBy, getDocs, 
  runTransaction, doc, Timestamp, where // <-- Asegúrate de tener runTransaction, doc, Timestamp y where
} from 'firebase/firestore';/**
 * Guarda una nueva unidad (propietario/depto) en Firestore
 * @param {object} unidadData - Datos { nombre, propietario, porcentaje }
 */
export const crearUnidad = async (unidadData) => {
  const { nombre, propietario, porcentaje } = unidadData;

  const nuevaUnidad = {
    nombre, // Ej: "Departamento 1"
    propietario, // Ej: "Rubén Gonzalez"
    porcentaje: parseFloat(porcentaje), // Guardamos como número
    saldo: 0, // El estado de cuenta, empieza en 0
    createdAt: serverTimestamp()
  };

  try {
    // Usamos una nueva colección llamada 'unidades'
    const docRef = await addDoc(collection(db, "unidades"), nuevaUnidad);
    console.log("Unidad registrada con ID: ", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error al guardar la unidad: ", error);
    throw new Error('No se pudo guardar la unidad.');
  }
};

/**
 * Obtiene las unidades en tiempo real, ordenadas por nombre
 * @param {function} callback - Función que se llamará con los datos
 * @returns {function} - Función para desuscribirse
 */
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

export const getTodasUnidades = async () => {
  const q = query(collection(db, "unidades"));
  const querySnapshot = await getDocs(q);
  
  const unidades = [];
  querySnapshot.forEach((doc) => {
    unidades.push({ id: doc.id, ...doc.data() });
  });
  return unidades;
};

// ... (después de la función getTodasUnidades)

/**
 * Aplica intereses moratorios a todas las unidades con saldo negativo.
 * @param {number} tasaMensual - La Tasa Efectiva Mensual (ej: 0.05 para 5%)
 * @param {string} concepto - El nombre para el registro (ej: "Interés Mora Oct-2025")
 */
export const aplicarInteresesMoratorios = async (tasaMensual, concepto) => {
  if (!tasaMensual || tasaMensual <= 0) {
    throw new Error("La tasa de interés debe ser un número positivo.");
  }
  if (!concepto || concepto.trim() === '') {
    throw new Error("El concepto para el registro es obligatorio.");
  }

  // 1. Buscamos solo las unidades que son deudoras (saldo < 0)
  const q = query(collection(db, "unidades"), where("saldo", "<", 0));
  const deudoresSnapshot = await getDocs(q);

  if (deudoresSnapshot.empty) {
    console.log("No se encontraron deudores.");
    return { unidadesActualizadas: 0, totalInteres: 0 };
  }

  let unidadesActualizadas = 0;
  let totalInteres = 0;

  try {
    // 2. Usamos una transacción para actualizar todos los deudores
    await runTransaction(db, async (transaction) => {
      
      for (const unidadDoc of deudoresSnapshot.docs) {
        const unidadRef = unidadDoc.ref;
        const unidadData = unidadDoc.data();
        const saldoAnterior = unidadData.saldo;

        // 3. Cálculo del interés
        // El saldo es negativo (ej: -1000). El interés se calcula sobre el valor absoluto.
        // El monto del interés también es negativo (ej: -50), ya que incrementa la deuda.
        const montoInteres = - (Math.abs(saldoAnterior) * tasaMensual);
        const saldoResultante = saldoAnterior + montoInteres; // Ej: -1000 + (-50) = -1050

        // 4. Actualizar el saldo de la unidad
        transaction.update(unidadRef, {
          saldo: saldoResultante
        });

        // 5. Crear el registro en la cuenta corriente
        const ctaCteRef = doc(collection(db, `unidades/${unidadDoc.id}/cuentaCorriente`));
        const itemCtaCte = {
          fecha: Timestamp.now(),
          concepto: concepto,
          monto: montoInteres, // Monto negativo
          saldoResultante: saldoResultante,
          liquidacionId: null, // No pertenece a una liquidación
          unidadId: unidadDoc.id
        };
        transaction.set(ctaCteRef, itemCtaCte);

        unidadesActualizadas++;
        totalInteres += montoInteres;
      }
    }); // --- FIN DE LA TRANSACCIÓN ---

    console.log(`Intereses aplicados a ${unidadesActualizadas} unidades.`);
    return { unidadesActualizadas, totalInteres };

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN DE INTERESES! ", error);
    throw new Error(`Error al aplicar intereses: ${error.message}`);
  }
};

// ... (después de la función aplicarInteresesMoratorios)

/**
 * Registra un pago para una unidad específica, actualizando su saldo y cuenta corriente.
 * @param {string} unidadId - ID de la unidad que realiza el pago.
 * @param {number} montoPagado - El monto positivo del pago.
 * @param {string} fechaPago - La fecha del pago (formato 'AAAA-MM-DD').
 * @param {string} conceptoPago - Descripción o referencia del pago.
 */
export const registrarPago = async (unidadId, montoPagado, fechaPago, conceptoPago) => {
  if (!unidadId) {
    throw new Error("Se requiere el ID de la unidad.");
  }
  if (!montoPagado || montoPagado <= 0) {
    throw new Error("El monto pagado debe ser un número positivo.");
  }
  if (!fechaPago) {
    throw new Error("La fecha de pago es obligatoria.");
  }
  if (!conceptoPago || conceptoPago.trim() === '') {
    throw new Error("El concepto del pago es obligatorio.");
  }

  // Convertimos la fecha string a Timestamp de Firebase para guardar
  // Aseguramos que se guarde como el inicio del día en UTC para consistencia
  const fechaTimestamp = Timestamp.fromDate(new Date(`${fechaPago}T00:00:00Z`));

  const unidadRef = doc(db, "unidades", unidadId);

  try {
    // Usamos una transacción para asegurar la atomicidad
    await runTransaction(db, async (transaction) => {
      // 1. Leer el saldo actual de la unidad DENTRO de la transacción
      const unidadDoc = await transaction.get(unidadRef);
      if (!unidadDoc.exists()) {
        throw new Error(`La unidad con ID ${unidadId} no existe.`);
      }
      const saldoAnterior = unidadDoc.data().saldo;

      // 2. Calcular el nuevo saldo (sumamos el pago)
      const saldoResultante = saldoAnterior + montoPagado; // Ej: -5000 + 2000 = -3000

      // 3. Actualizar el saldo de la unidad
      transaction.update(unidadRef, {
        saldo: saldoResultante
      });

      // 4. Crear el registro positivo en la cuenta corriente
      const ctaCteRef = doc(collection(db, `unidades/${unidadId}/cuentaCorriente`));
      const itemCtaCte = {
        fecha: fechaTimestamp, // Usamos el Timestamp de la fecha del pago
        concepto: conceptoPago,
        monto: montoPagado, // Monto positivo
        saldoResultante: saldoResultante,
        liquidacionId: null, // No pertenece a una liquidación
        unidadId: unidadId
        // No hay campos de vencimiento para un pago
      };
      transaction.set(ctaCteRef, itemCtaCte);
    }); // --- FIN DE LA TRANSACCIÓN ---

    console.log(`Pago de ${montoPagado} registrado para unidad ${unidadId}`);
    // No necesitamos devolver nada especial aquí, si no hay error, funcionó.

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN DE PAGO! ", error);
    throw new Error(`Error al registrar el pago: ${error.message}`);
  }
};

// ... (después de la función registrarPago)

/**
 * Obtiene los datos de una unidad específica y su historial de cuenta corriente.
 * @param {string} unidadId - ID de la unidad a consultar.
 * @param {function} callback - Función que se llamará con los datos { unidad, movimientos }.
 * @returns {function} - Función para desuscribirse del listener de la Cta. Cte.
 */
export const getCuentaCorriente = (unidadId, callback) => {
  if (!unidadId) {
    console.error("Se requiere unidadId para getCuentaCorriente");
    // Llama al callback con error o datos vacíos
    callback(null, new Error("Falta el ID de la unidad."));
    return () => {}; // Devuelve una función vacía para desuscripción
  }

  let unidadData = null;
  let unsubscribeUnidad = null;
  let unsubscribeMovimientos = null;

  // 1. Listener para los datos de la unidad (por si cambia el saldo mientras vemos la Cta Cte)
  const unidadRef = doc(db, "unidades", unidadId);
  unsubscribeUnidad = onSnapshot(unidadRef, (docSnap) => {
    if (docSnap.exists()) {
      unidadData = { id: docSnap.id, ...docSnap.data() };
      // Si ya tenemos los movimientos, llamamos al callback
      // Esto asegura que si cambia el saldo, se actualice la vista
      if (movimientosData !== null) {
          callback({ unidad: unidadData, movimientos: movimientosData });
      }
    } else {
      console.error(`Unidad con ID ${unidadId} no encontrada.`);
      callback(null, new Error(`Unidad no encontrada.`));
    }
  }, (error) => {
    console.error("Error al obtener datos de la unidad:", error);
    callback(null, error);
  });


  // 2. Listener para los movimientos de la cuenta corriente, ordenados por fecha ASCENDENTE
  let movimientosData = null; // Variable para guardar temporalmente los movimientos
  const ctaCteCollection = collection(db, `unidades/${unidadId}/cuentaCorriente`);
  const q = query(ctaCteCollection, orderBy("fecha", "asc")); // Ordenamos por fecha

  unsubscribeMovimientos = onSnapshot(q, (querySnapshot) => {
    const movimientos = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convertimos el Timestamp de Firebase a objeto Date de JS para facilitar el formato
      const fechaJS = data.fecha ? data.fecha.toDate() : null;
      movimientos.push({
        id: doc.id,
        ...data,
        fecha: fechaJS // Sobrescribimos fecha con el objeto Date
      });
    });
    movimientosData = movimientos; // Guardamos los movimientos

    // Si ya tenemos los datos de la unidad, llamamos al callback
    if (unidadData) {
        callback({ unidad: unidadData, movimientos: movimientosData });
    }

  }, (error) => {
    console.error("Error al obtener movimientos de Cta. Cte.:", error);
    callback(null, error);
  });

  // 3. Devolvemos una función que cancela AMBAS suscripciones
  return () => {
    if (unsubscribeUnidad) unsubscribeUnidad();
    if (unsubscribeMovimientos) unsubscribeMovimientos();
  };
};