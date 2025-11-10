// src/services/gastosService.js
import { db, storage } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, where, getDocs,
  doc, updateDoc, deleteDoc, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
// No necesitamos registrarMovimientoFondo aquí, eso se hace en liquidacionService

const uploadFactura = async (consorcioId, file) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para subir factura.");
  // Agregamos el consorcioId a la ruta de Storage para evitar colisiones
  const storageRef = ref(storage, `consorcios/${consorcioId}/facturas/${Date.now()}-${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

export const crearGasto = async (consorcioId, gastoData) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para crear gasto.");
  
  let facturaURL = '';
  if (gastoData.facturaFile) {
    try {
      facturaURL = await uploadFactura(consorcioId, gastoData.facturaFile);
    } catch (error) {
      console.error("Error al subir la factura: ", error);
      throw new Error('No se pudo subir el archivo.');
    }
  }

  const nuevoGasto = {
    fecha: gastoData.fecha,
    concepto: gastoData.concepto,
    proveedor: gastoData.proveedor,
    monto: parseFloat(gastoData.monto),
    facturaURL,
    createdAt: serverTimestamp(),
    liquidacionId: null,
    liquidadoEn: null,
    tipo: gastoData.tipo,
    distribucion: gastoData.distribucion || 'Prorrateo',
    unidadesAfectadas: gastoData.unidadesAfectadas || []
  };

  try {
    if (nuevoGasto.tipo === 'Ordinario') {
      delete nuevoGasto.distribucion;
      delete nuevoGasto.unidadesAfectadas;
    }

    // RUTA MODIFICADA
    const gastosCollectionRef = collection(db, `consorcios/${consorcioId}/gastos`);
    const docRef = await addDoc(gastosCollectionRef, nuevoGasto);
    console.log("Gasto registrado con ID: ", docRef.id, "en consorcio:", consorcioId);

    // NOTA: La lógica de descontar del fondo de reserva al *crear* el gasto se eliminó.
    // El fondo SÓLO debe descontarse al *ejecutar la liquidación* que incluye ese gasto.
    // Esto previene inconsistencias si el gasto se borra antes de liquidar.
    // El 'gastoService' solo crea el gasto; 'liquidacionService' maneja la contabilidad.

    return docRef;
  } catch (error) {
     console.error("Error al crear gasto:", error);
     throw new Error('No se pudo registrar el gasto.');
  }
};


/**
 * Obtiene los gastos (de un consorcio) en tiempo real.
 * @param {string} consorcioId ID del consorcio.
 * @param {function} callback Función que recibe los gastos.
 * @param {string} filtro 'pendientes', 'todos', o el nombre de una liquidación.
 * @returns {function} Función para desuscribirse.
 */
export const getGastos = (consorcioId, callback, filtro = 'pendientes') => {
  if (!consorcioId) {
    callback([], new Error("consorcioId no fue provisto a getGastos"));
    return () => {};
  }
  
  let q;
  // RUTA MODIFICADA
  const gastosCollection = collection(db, `consorcios/${consorcioId}/gastos`);

  if (filtro === 'pendientes') {
    q = query(gastosCollection, where("liquidacionId", "==", null), orderBy("createdAt", "desc"));
  } else if (filtro === 'todos') {
    q = query(gastosCollection, orderBy("createdAt", "desc"));
  } else {
    q = query(gastosCollection, where("liquidadoEn", "==", filtro), orderBy("createdAt", "desc"));
  }

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const gastos = [];
    querySnapshot.forEach((doc) => {
      gastos.push({ id: doc.id, ...doc.data() });
    });
    callback(gastos);
  }, (error) => {
    console.error("Error al obtener gastos:", error);
    callback([], error);
  });

  return unsubscribe;
};

// --- getGastosNoLiquidados ---
export const getGastosNoLiquidados = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para getGastosNoLiquidados.");

  // RUTA MODIFICADA
  const q = query(collection(db, `consorcios/${consorcioId}/gastos`), where("liquidacionId", "==", null));

  const querySnapshot = await getDocs(q);

  const gastos = [];
  let total = 0;

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    gastos.push({ id: doc.id, ...data });
    total += data.monto;
  });

  return { gastos, total };
};

// --- updateGasto ---
export const updateGasto = async (consorcioId, id, gastoData) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para updateGasto.");

  // RUTA MODIFICADA
  const gastoRef = doc(db, `consorcios/${consorcioId}/gastos`, id);

  const datosActualizados = {
    fecha: gastoData.fecha,
    concepto: gastoData.concepto,
    proveedor: gastoData.proveedor,
    monto: parseFloat(gastoData.monto),
    // Tipo, Distribucion y UnidadesAfectadas también deberían poder editarse
    tipo: gastoData.tipo,
    distribucion: gastoData.distribucion || 'Prorrateo',
    unidadesAfectadas: gastoData.unidadesAfectadas || []
  };
  
  // Limpieza si es Ordinario
  if (datosActualizados.tipo === 'Ordinario') {
      delete datosActualizados.distribucion;
      delete datosActualizados.unidadesAfectadas;
  }

  try {
    // Verificación (opcional pero recomendada):
    const gastoSnap = await getDoc(gastoRef);
    if (gastoSnap.exists() && gastoSnap.data().liquidacionId) {
        throw new Error("No se puede modificar un gasto que ya ha sido liquidado.");
    }

    await updateDoc(gastoRef, datosActualizados);
    console.log("Gasto actualizado con ID: ", id);
  } catch (error) {
    console.error("Error al actualizar el gasto: ", error);
    throw new Error(`No se pudo actualizar el gasto: ${error.message}`);
  }
};

// --- deleteGasto ---
export const deleteGasto = async (consorcioId, id, facturaURL) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para deleteGasto.");
  
  // RUTA MODIFICADA
  const gastoRef = doc(db, `consorcios/${consorcioId}/gastos`, id);

  try {
    // Verificación:
    const gastoSnap = await getDoc(gastoRef);
    if (gastoSnap.exists() && gastoSnap.data().liquidacionId) {
        throw new Error("No se puede eliminar un gasto que ya ha sido liquidado.");
    }
    
    // 1. Eliminar el archivo de Storage (si existe)
    if (facturaURL) {
      try {
        const fileRef = ref(storage, facturaURL);
        await deleteObject(fileRef);
        console.log("Archivo PDF eliminado de Storage");
      } catch (storageError) {
        if (storageError.code === 'storage/object-not-found') {
            console.warn("El archivo PDF no se encontró en Storage (quizás ya fue borrado).");
        } else {
            console.warn("No se pudo eliminar el archivo PDF de Storage:", storageError);
        }
      }
    }

    // 2. Eliminar el documento de Firestore
    await deleteDoc(gastoRef);
    console.log("Gasto eliminado con ID: ", id);

  } catch (error) {
    console.error("Error al eliminar el gasto: ", error);
    throw new Error(`No se pudo eliminar el gasto: ${error.message}`);
  }
};

// --- resetearTodosLosGastos ---
export const resetearTodosLosGastos = async (consorcioId) => {
  if (!consorcioId) throw new Error("consorcioId es requerido para resetear gastos.");
  
  console.warn(`Iniciando reseteo total de gastos para consorcio ${consorcioId}...`);
  
  // RUTA MODIFICADA
  const gastosCollection = collection(db, `consorcios/${consorcioId}/gastos`);
  const gastosSnapshot = await getDocs(gastosCollection);
  let contadorBorrados = 0;
  let contadorErrores = 0;

  const promesasDelete = gastosSnapshot.docs.map(async (gastoDoc) => {
    const gastoData = gastoDoc.data();
    const gastoRef = gastoDoc.ref;

    if (gastoData.facturaURL) {
      try {
        const fileRef = ref(storage, gastoData.facturaURL);
        await deleteObject(fileRef);
        console.log(`PDF eliminado: ${gastoData.facturaURL}`);
      } catch (storageError) {
        if (storageError.code !== 'storage/object-not-found') {
            console.warn(`No se pudo eliminar PDF ${gastoData.facturaURL}:`, storageError);
        }
      }
    }

    try {
      await deleteDoc(gastoRef);
      contadorBorrados++;
    } catch (firestoreError) {
      console.error(`Error al borrar gasto ${gastoDoc.id}:`, firestoreError);
      contadorErrores++;
    }
  });

  await Promise.all(promesasDelete);

  console.warn(`Reseteo de gastos completado. Borrados: ${contadorBorrados}, Errores: ${contadorErrores}`);
  if (contadorErrores > 0) {
    throw new Error(`Ocurrieron ${contadorErrores} errores al borrar gastos.`);
  }
  return contadorBorrados;
};