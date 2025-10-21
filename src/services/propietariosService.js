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