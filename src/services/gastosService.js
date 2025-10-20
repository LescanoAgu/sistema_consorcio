import { db, storage } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onSnapshot, query, orderBy } from 'firebase/firestore';

/**
 * Sube un archivo a Firebase Storage y devuelve la URL
 * @param {File} file - El archivo PDF de la factura
 * @returns {Promise<string>} - La URL de descarga del archivo
 */
const uploadFactura = async (file) => {
  // 1. Crear una referencia única para el archivo
  // Ej: 'facturas/1697818485232-factura-luz.pdf'
  const storageRef = ref(storage, `facturas/${Date.now()}-${file.name}`);

  // 2. Subir el archivo
  const snapshot = await uploadBytes(storageRef, file);

  // 3. Obtener la URL de descarga
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

/**
 * Guarda un nuevo documento de gasto en Firestore
 * @param {object} gastoData - Los datos del formulario
 */
export const crearGasto = async (gastoData) => {
  const { fecha, concepto, proveedor, monto, facturaFile } = gastoData;

  // 1. Subir la factura PDF primero
  let facturaURL = '';
  if (facturaFile) {
    try {
      facturaURL = await uploadFactura(facturaFile);
    } catch (error) {
      console.error("Error al subir la factura: ", error);
      throw new Error('No se pudo subir el archivo.');
    }
  }

  // 2. Preparar el objeto para guardar en Firestore
  const nuevoGasto = {
    fecha,
    concepto,
    proveedor,
    monto: parseFloat(monto), // Aseguramos que sea un número
    facturaURL, // El link al PDF en Storage
    createdAt: serverTimestamp() // La fecha de carga
    // Más adelante le agregaremos 'expensaId' para saber a qué mes pertenece
  };

  // 3. Guardar en la colección 'gastos'
  try {
    const docRef = await addDoc(collection(db, "gastos"), nuevoGasto);
    console.log("Gasto registrado con ID: ", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error al guardar el gasto: ", error);
    throw new Error('No se pudo guardar el gasto en la base de datos.');
  }
};

/**
 * Obtiene los gastos en tiempo real y los ordena por fecha de creación
 * @param {function} callback - Función que se llamará con los nuevos datos
 * @returns {function} - Función para desuscribirse del listener
 */
export const getGastos = (callback) => {
  // 1. Creamos una "query" (consulta) a la colección 'gastos'
  // 2. Usamos 'orderBy' para que los más nuevos aparezcan primero
  const q = query(collection(db, "gastos"), orderBy("createdAt", "desc"));

  // 3. onSnapshot "escucha" cambios en esa consulta
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const gastos = [];
    querySnapshot.forEach((doc) => {
      // Tomamos los datos y les añadimos el ID del documento
      gastos.push({ id: doc.id, ...doc.data() });
    });
    // 4. Llamamos al callback (que estará en nuestro componente) con la lista
    callback(gastos);
  });

  // Devolvemos la función para "apagar" el listener
  return unsubscribe;
};