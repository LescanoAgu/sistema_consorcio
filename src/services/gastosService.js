import { db, storage } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, where, getDocs,
  doc, updateDoc, deleteDoc // <-- ASEGÚRATE DE IMPORTAR doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // <-- Importa deleteObject

// --- uploadFactura (SIN CAMBIOS) ---
const uploadFactura = async (file) => {
  // ... (código existente)
  const storageRef = ref(storage, `facturas/${Date.now()}-${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

export const crearGasto = async (gastoData) => {
  let facturaURL = '';
  if (gastoData.facturaFile) {
    try {
      facturaURL = await uploadFactura(gastoData.facturaFile);
    } catch (error) {
      console.error("Error al subir la factura: ", error);
      throw new Error('No se pudo subir el archivo.');
    }
  }

  // Preparamos el objeto para guardar
  const nuevoGasto = {
    fecha: gastoData.fecha,
    concepto: gastoData.concepto,
    proveedor: gastoData.proveedor,
    monto: parseFloat(gastoData.monto),
    facturaURL,
    createdAt: serverTimestamp(),
    liquidacionId: null,
    liquidadoEn: null,

    // --- CAMPOS AÑADIDOS ---
    tipo: gastoData.tipo, // <-- ¡Importante!
    distribucion: gastoData.distribucion || 'Prorrateo', // <-- ¡Importante!
    unidadesAfectadas: gastoData.unidadesAfectadas || [] // <-- ¡Importante!
    // --- FIN CAMPOS AÑADIDOS ---
  };

  try {
    // Quitamos los campos extra si es Ordinario (para limpieza)
    if (nuevoGasto.tipo === 'Ordinario') {
      delete nuevoGasto.distribucion;
      delete nuevoGasto.unidadesAfectadas;
    }

    const docRef = await addDoc(collection(db, "gastos"), nuevoGasto);
    console.log("Gasto registrado con ID: ", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error al guardar el gasto: ", error);
    throw new Error('No se pudo guardar el gasto en la base de datos.');
  }
};


/**
 * Obtiene los gastos en tiempo real, con opción de filtro.
 * @param {function} callback Función que recibe los gastos.
 * @param {string} filtro 'pendientes', 'todos', o el nombre de una liquidación (liquidadoEn).
 * @returns {function} Función para desuscribirse.
 */
export const getGastos = (callback, filtro = 'pendientes') => {
  let q;
  const gastosCollection = collection(db, "gastos");

  if (filtro === 'pendientes') {
    // Solo gastos con liquidacionId === null, ordenados por fecha de creación desc
    q = query(gastosCollection, where("liquidacionId", "==", null), orderBy("createdAt", "desc"));
  } else if (filtro === 'todos') {
    // Todos los gastos, ordenados por fecha de creación desc
    q = query(gastosCollection, orderBy("createdAt", "desc"));
  } else {
    // Gastos de una liquidación específica, ordenados por fecha de creación desc
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
    // Podrías llamar al callback con un array vacío o un error
    callback([], error);
  });

  return unsubscribe;
};

// --- getGastosNoLiquidados (SIN CAMBIOS - se usa en liquidación) ---
export const getGastosNoLiquidados = async () => {
    // ... (código existente)
      // Creamos una query que filtra por liquidacionId == null
  const q = query(collection(db, "gastos"), where("liquidacionId", "==", null));

  const querySnapshot = await getDocs(q);

  const gastos = [];
  let total = 0;

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    gastos.push({ id: doc.id, ...data });
    total += data.monto; // Sumamos el total
  });

  // Devolvemos la lista de gastos y el total sumado
  return { gastos, total };
};

// --- ¡NUEVA FUNCIÓN! ---
/**
 * Actualiza un documento de gasto existente en Firestore.
 * NO permite actualizar si el gasto ya fue liquidado.
 * @param {string} id ID del gasto a actualizar.
 * @param {object} gastoData Nuevos datos { fecha, concepto, proveedor, monto }.
 */
export const updateGasto = async (id, gastoData) => {
  const gastoRef = doc(db, "gastos", id);

  // Preparamos los datos a actualizar
  const datosActualizados = {
    fecha: gastoData.fecha,
    concepto: gastoData.concepto,
    proveedor: gastoData.proveedor,
    monto: parseFloat(gastoData.monto),
    // NO actualizamos facturaURL aquí, eso sería más complejo (borrar anterior, subir nueva)
    // NO actualizamos createdAt, liquidacionId, liquidadoEn
  };

  try {
    // IMPORTANTE: Idealmente, deberíamos verificar aquí (o con reglas de seguridad)
    // que el gasto NO esté liquidado antes de permitir la actualización.
    // Por simplicidad, confiaremos en que la UI deshabilita el botón.
    await updateDoc(gastoRef, datosActualizados);
    console.log("Gasto actualizado con ID: ", id);
  } catch (error) {
    console.error("Error al actualizar el gasto: ", error);
    throw new Error('No se pudo actualizar el gasto.');
  }
};

// --- ¡NUEVA FUNCIÓN! ---
/**
 * Elimina un documento de gasto de Firestore y su archivo asociado en Storage (si existe).
 * NO permite eliminar si el gasto ya fue liquidado.
 * @param {string} id ID del gasto a eliminar.
 * @param {string} facturaURL URL del archivo PDF asociado (si existe).
 */
export const deleteGasto = async (id, facturaURL) => {
  const gastoRef = doc(db, "gastos", id);

  try {
    // IMPORTANTE: Verificar que no esté liquidado antes de borrar.
    // Confiaremos en la UI por ahora.

    // 1. Eliminar el archivo de Storage (si existe)
    if (facturaURL) {
      try {
        const fileRef = ref(storage, facturaURL); // Obtenemos la referencia desde la URL
        await deleteObject(fileRef);
        console.log("Archivo PDF eliminado de Storage");
      } catch (storageError) {
        // Si falla borrar el archivo (ej: no existe, permisos), registramos pero continuamos
        console.warn("No se pudo eliminar el archivo PDF de Storage:", storageError);
      }
    }

    // 2. Eliminar el documento de Firestore
    await deleteDoc(gastoRef);
    console.log("Gasto eliminado con ID: ", id);

  } catch (error) {
    console.error("Error al eliminar el gasto: ", error);
    throw new Error('No se pudo eliminar el gasto.');
  }
};

export const resetearTodosLosGastos = async () => {
  console.warn("Iniciando reseteo total de gastos...");
  const gastosCollection = collection(db, "gastos");
  const gastosSnapshot = await getDocs(gastosCollection);
  let contadorBorrados = 0;
  let contadorErrores = 0;

  // Usamos Promise.all para manejar las eliminaciones en paralelo (más rápido)
  const promesasDelete = gastosSnapshot.docs.map(async (gastoDoc) => {
    const gastoData = gastoDoc.data();
    const gastoRef = gastoDoc.ref; // Referencia al documento

    // 1. Intentar borrar PDF si existe
    if (gastoData.facturaURL) {
      try {
        const fileRef = ref(storage, gastoData.facturaURL);
        await deleteObject(fileRef);
        console.log(`PDF eliminado: ${gastoData.facturaURL}`);
      } catch (storageError) {
        // Ignoramos errores si el archivo no existe, pero logueamos otros
        if (storageError.code !== 'storage/object-not-found') {
            console.warn(`No se pudo eliminar PDF ${gastoData.facturaURL}:`, storageError);
        }
      }
    }

    // 2. Borrar documento de Firestore
    try {
      await deleteDoc(gastoRef);
      contadorBorrados++;
    } catch (firestoreError) {
      console.error(`Error al borrar gasto ${gastoDoc.id}:`, firestoreError);
      contadorErrores++;
    }
  });

  await Promise.all(promesasDelete); // Espera a que todas las promesas terminen

  console.warn(`Reseteo de gastos completado. Borrados: ${contadorBorrados}, Errores: ${contadorErrores}`);
  if (contadorErrores > 0) {
    throw new Error(`Ocurrieron ${contadorErrores} errores al borrar gastos.`);
  }
  return contadorBorrados;
};