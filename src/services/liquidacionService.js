// src/services/liquidacionService.js
import { db, storage } from '../config/firebase';
import {
  collection, addDoc, doc, runTransaction,
  serverTimestamp, Timestamp, updateDoc,
  onSnapshot, query, orderBy, where, getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getGastosNoLiquidados } from './gastosService';
import { getTodasUnidades } from './propietariosService';

// --- calcularPreviewLiquidacion (SIN CAMBIOS) ---
export const calcularPreviewLiquidacion = async (porcentajeFondo) => {
  const { gastos, total: totalGastos } = await getGastosNoLiquidados();
  if (gastos.length === 0) {
    throw new Error("No hay gastos pendientes para liquidar.");
  }
  const montoFondo = totalGastos * porcentajeFondo;
  const totalAProrratear = totalGastos + montoFondo;
  return {
    gastos,
    totalGastos,
    montoFondo,
    totalAProrratear
  };
};


// --- ejecutarLiquidacion (VERSIÓN MODIFICADA) ---
export const ejecutarLiquidacion = async (params, preview) => {
  
  const { nombre, fechaVenc1, pctRecargo, fechaVenc2 } = params;
  const { gastos, totalGastos, montoFondo, totalAProrratear } = preview;
  
  const unidades = await getTodasUnidades();
  
  const sumaPorcentajes = unidades.reduce((acc, u) => acc + u.porcentaje, 0);
  if (Math.abs(1 - sumaPorcentajes) > 0.0001) {
    throw new Error(`La suma de porcentajes no es 1 (100%). Suma actual: ${(sumaPorcentajes * 100).toFixed(4)}%`);
  }
  
  // 1. Preparamos el documento de liquidación
  const liquidacionRef = collection(db, "liquidaciones");
  const nuevaLiquidacion = {
    nombre,
    totalGastos,
    montoFondo,
    totalAProrratear,
    fechaCreada: serverTimestamp(),
    gastosIds: gastos.map(g => g.id),
    unidadesIds: unidades.map(u => u.id)
    // El 'detalleUnidades' AHORA se agregará desde LiquidacionPage
  };
  
  // 2. Creamos el documento principal Y OBTENEMOS SU ID
  const liquidacionDoc = await addDoc(liquidacionRef, nuevaLiquidacion);
  const liquidacionId = liquidacionDoc.id;

  // 3. Preparamos los arrays que se llenarán en la transacción
  const itemsCtaCteGenerados = []; 
  const detalleUnidades = []; // <--- Array para el snapshot (que se devolverá)

  try {
    // --- 4. INICIA LA TRANSACCIÓN ---
    await runTransaction(db, async (transaction) => {
      
      // --- PASO 1: TODAS LAS LECTURAS (READS) PRIMERO ---
      const saldosUnidades = []; 
      
      for (const unidad of unidades) {
        const unidadRef = doc(db, "unidades", unidad.id);
        const unidadDoc = await transaction.get(unidadRef); // <-- LECTURA
        if (!unidadDoc.exists()) {
          throw new Error(`La unidad ${unidad.nombre} no existe.`);
        }
        const saldoAnterior = unidadDoc.data().saldo;
        
        saldosUnidades.push({ 
          unidadRef: unidadRef, 
          saldoAnterior: saldoAnterior,
          unidad: unidad 
        });
      }

      // --- PASO 2: TODAS LAS ESCRITURAS (WRITES) DESPUÉS ---
      
      // A. Actualizar GASTOS
      for (const gasto of gastos) {
        const gastoRef = doc(db, "gastos", gasto.id);
        transaction.update(gastoRef, { 
          liquidacionId: liquidacionId,
          liquidadoEn: nombre
        });
      }

      // B. Actualizar UNIDADES y Cta. Cte.
      for (const dataUnidad of saldosUnidades) {
        const { unidadRef, saldoAnterior, unidad } = dataUnidad;
        const montoAPagar = totalAProrratear * unidad.porcentaje;
        const saldoResultante = saldoAnterior - montoAPagar;
        
        // 1. Actualizar el saldo de la unidad
        transaction.update(unidadRef, { 
          saldo: saldoResultante
        });

        // 2. Crear el "item de cuenta corriente"
        const ctaCteRef = doc(collection(db, `unidades/${unidad.id}/cuentaCorriente`));
        const itemCtaCte = {
          fecha: Timestamp.now(),
          concepto: `Expensa ${nombre}`,
          monto: -montoAPagar,
          saldoResultante: saldoResultante,
          liquidacionId: liquidacionId,
          vencimiento1: fechaVenc1,
          montoVencimiento1: montoAPagar,
          vencimiento2: fechaVenc2,
          montoVencimiento2: montoAPagar * (1 + pctRecargo),
          unidadId: unidad.id 
        };
        transaction.set(ctaCteRef, itemCtaCte); 
        
        // 3. Guardar la data para el return (con el ID)
        itemsCtaCteGenerados.push({
          ...itemCtaCte,
          id: ctaCteRef.id
        });
        
        // 4. GUARDAR EL SNAPSHOT para el doc. principal
        detalleUnidades.push({
          unidadId: unidad.id,
          nombre: unidad.nombre,
          propietario: unidad.propietario,
          porcentaje: unidad.porcentaje,
          saldoAnterior: saldoAnterior,
          montoLiquidado: -montoAPagar,
          saldoResultante: saldoResultante
          // cuponURL se agregará en LiquidacionPage
        });
      }
    }); // --- FIN DE LA TRANSACCIÓN ---
    
    // --- 5. YA NO SE ACTUALIZA EL DOC. LIQUIDACIÓN AQUÍ ---
    // (Esta línea fue eliminada)
    
    console.log("¡Transacción de liquidación completada!");
    
    // <-- DEVOLVEMOS EL SNAPSHOT 'detalleUnidades'
    return { liquidacionId, unidades, itemsCtaCteGenerados, detalleUnidades };

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN! ", error);
    // TODO: Si la transacción falla, podríamos borrar el doc de liquidación que creamos?
    // Por ahora, solo lanzamos el error.
    throw new Error(`Error al ejecutar la transacción: ${error.message}`);
  }
};

// --- (Las funciones de uploadPDF y guardarURL no cambian) ---

/**
 * Sube un cupón PDF (Blob) a Storage
 * @param {Blob} pdfBlob El archivo PDF generado
 * @param {string} liquidacionNombre El nombre de la liquidación (Ej: "Octubre 2025")
 * @param {string} unidadNombre El nombre de la unidad (Ej: "Departamento 1")
 * @returns {string} La URL de descarga
 */
export const uploadCuponPDF = async (pdfBlob, liquidacionNombre, unidadNombre) => {
  // Limpiamos nombres para que sean aptos para URL/Storage
  const safeLiquidacionNombre = liquidacionNombre.replace(/ /g, '_');
  const safeUnidadNombre = unidadNombre.replace(/ /g, '_');
  
  const fileName = `expensa-${safeLiquidacionNombre}-${safeUnidadNombre}.pdf`;
  // Lo guardamos en una carpeta por liquidación para mantener el orden
  const storageRef = ref(storage, `liquidaciones/${safeLiquidacionNombre}/${fileName}`);
  
  console.log(`Subiendo cupón: ${fileName}`);
  const snapshot = await uploadBytes(storageRef, pdfBlob);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

/**
 * Guarda la URL del cupón en el item de Cta. Cte. correspondiente
 * @param {string} unidadId ID de la unidad (para la ruta)
 * @param {string} ctaCteId ID del documento en la subcolección cuentaCorriente
 * @param {string} url La URL de descarga del PDF
 */
export const guardarURLCupon = async (unidadId, ctaCteId, url) => {
  // Armamos la referencia directa al documento en la subcolección
  const ctaCteRef = doc(db, `unidades/${unidadId}/cuentaCorriente`, ctaCteId);
  
  // ---> ESTA PARTE FALTABA <---
  // Actualizamos ese documento específico con la nueva URL
  await updateDoc(ctaCteRef, {
    cuponURL: url 
  });
  console.log(`URL guardada para ctaCteId: ${ctaCteId}`);
  // ---> FIN DE LO QUE FALTABA <---
};

// --- ¡NUEVA FUNCIÓN! ---
/**
 * Obtiene todas las liquidaciones en tiempo real, ordenadas por fecha de creación descendente.
 * @param {function} callback - Función que se llamará con la lista de liquidaciones.
 * @returns {function} - Función para desuscribirse del listener.
 */
export const getLiquidaciones = (callback) => {
  const q = query(collection(db, "liquidaciones"), orderBy("fechaCreada", "desc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const liquidaciones = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convertimos el Timestamp a Date para mostrarlo
      const fechaJS = data.fechaCreada ? data.fechaCreada.toDate() : null;
      liquidaciones.push({
        id: doc.id,
        ...data,
        fechaCreada: fechaJS // Sobrescribimos con objeto Date
      });
    });
    callback(liquidaciones);
  }, (error) => {
    console.error("Error al obtener liquidaciones:", error);
    callback([], error); // Llama al callback con array vacío y error
  });

  return unsubscribe;
};