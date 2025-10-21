import { db } from '../config/firebase';
import { 
  collection, addDoc, doc, runTransaction, 
  serverTimestamp, Timestamp 
} from 'firebase/firestore';
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


// --- ejecutarLiquidacion (VERSIÓN CORREGIDA) ---
export const ejecutarLiquidacion = async (params, preview) => {
  // Aquí había un pequeño error de variable, lo corregí (fechaVenc2)
  const { nombre, fechaVenc1, pctRecargo, fechaVenc2 } = params;
  const { gastos, totalGastos, montoFondo, totalAProrratear } = preview;
  
  const unidades = await getTodasUnidades();
  
  const sumaPorcentajes = unidades.reduce((acc, u) => acc + u.porcentaje, 0);
  if (Math.abs(1 - sumaPorcentajes) > 0.0001) {
    throw new Error(`La suma de porcentajes no es 1 (100%). Suma actual: ${(sumaPorcentajes * 100).toFixed(4)}%`);
  }
  
  const liquidacionRef = collection(db, "liquidaciones");
  const nuevaLiquidacion = {
    nombre,
    totalGastos,
    montoFondo,
    totalAProrratear,
    fechaCreada: serverTimestamp(),
    gastosIds: gastos.map(g => g.id),
    unidadesIds: unidades.map(u => u.id)
  };
  const liquidacionDoc = await addDoc(liquidacionRef, nuevaLiquidacion);
  const liquidacionId = liquidacionDoc.id;

  const itemsCtaCteGenerados = []; 

  try {
    // --- INICIA LA TRANSACCIÓN CORREGIDA ---
    await runTransaction(db, async (transaction) => {
      
      // --- PASO 1: TODAS LAS LECTURAS (READS) PRIMERO ---
      const saldosUnidades = []; // Aquí guardamos los saldos que leímos
      
      for (const unidad of unidades) {
        const unidadRef = doc(db, "unidades", unidad.id);
        const unidadDoc = await transaction.get(unidadRef); // <-- LECTURA
        if (!unidadDoc.exists()) {
          throw new Error(`La unidad ${unidad.nombre} no existe.`);
        }
        const saldoAnterior = unidadDoc.data().saldo;
        
        // Guardamos los datos leídos para usarlos después
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
        transaction.update(gastoRef, { // <-- ESCRITURA
          liquidacionId: liquidacionId,
          liquidadoEn: nombre
        });
      }

      // B. Actualizar UNIDADES y Cta. Cte.
      for (const dataUnidad of saldosUnidades) {
        const { unidadRef, saldoAnterior, unidad } = dataUnidad;
        const montoAPagar = totalAProrratear * unidad.porcentaje;
        
        // 1. Actualizar el saldo
        transaction.update(unidadRef, { // <-- ESCRITURA
          saldo: saldoAnterior - montoAPagar
        });

        // 2. Crear el "item de cuenta corriente"
        const ctaCteRef = doc(collection(db, `unidades/${unidad.id}/cuentaCorriente`));
        const itemCtaCte = {
          fecha: Timestamp.now(),
          concepto: `Expensa ${nombre}`,
          monto: -montoAPagar,
          saldoResultante: saldoAnterior - montoAPagar,
          liquidacionId: liquidacionId,
          vencimiento1: fechaVenc1,
          montoVencimiento1: montoAPagar,
          vencimiento2: fechaVenc2,
          montoVencimiento2: montoAPagar * (1 + pctRecargo),
          unidadId: unidad.id 
        };
        transaction.set(ctaCteRef, itemCtaCte); // <-- ESCRITURA
        
        itemsCtaCteGenerados.push(itemCtaCte);
      }
    }); // --- FIN DE LA TRANSACCIÓN ---
    
    console.log("¡Liquidación completada exitosamente!");
    return { liquidacionId, unidades, itemsCtaCteGenerados };

  } catch (error) {
    console.error("¡FALLÓ LA TRANSACCIÓN! ", error);
    throw new Error(`Error al ejecutar la transacción: ${error.message}`);
  }
};