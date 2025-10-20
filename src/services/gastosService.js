import { db, storage } from '../config/firebase';
import { 
  collection, addDoc, serverTimestamp, 
  onSnapshot, query, orderBy, where, getDocs 
} from 'firebase/firestore'; // <-- ASEGÚRATE DE IMPORTAR 'where' y 'getDocs'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Sube un archivo a Firebase Storage y devuelve la URL
 */
const uploadFactura = async (file) => {
  const storageRef = ref(storage, `facturas/${Date.now()}-${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

/**
 * Guarda un nuevo documento de gasto en Firestore
 */
export const crearGasto = async (gastoData) => {
  const { fecha, concepto, proveedor, monto, facturaFile } = gastoData;

  let facturaURL = '';
  if (facturaFile) {
    try {
      facturaURL = await uploadFactura(facturaFile);
    } catch (error) {
      console.error("Error al subir la factura: ", error);
      throw new Error('No se pudo subir el archivo.');
    }
  }

  // Preparamos el objeto para guardar
  const nuevoGasto = {
    fecha,
    concepto,
    proveedor,
    monto: parseFloat(monto),
    facturaURL,
    createdAt: serverTimestamp(),
    liquidacionId: null, // <-- ESTE ES EL CAMPO NUEVO
    liquidadoEn: null    // <-- ESTE ES EL CAMPO NUEVO
  };

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
 */
export const getGastos = (callback) => {
  const q = query(collection(db, "gastos"), orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const gastos = [];
    querySnapshot.forEach((doc) => {
      gastos.push({ id: doc.id, ...doc.data() });
    });
    callback(gastos);
  });

  return unsubscribe;
};

// --- ¡FUNCIÓN NUEVA! ---
/**
 * Obtiene solo los gastos que AÚN NO han sido liquidados
 * (liquidacionId es null)
 */
export const getGastosNoLiquidados = async () => {
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