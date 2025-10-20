import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
/**
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