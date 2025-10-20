// Por ahora, este servicio solo importa la función de gastos
import { getGastosNoLiquidados } from './gastosService';
import { db } from '../config/firebase';
import { 
  collection, addDoc, doc, runTransaction, 
  serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { getGastosNoLiquidados } from './gastosService';
import { getTodasUnidades } from './propietariosService';

/**
 * Calcula una previsualización de la liquidación
 * @param {number} porcentajeFondo - El % de fondo de reserva (ej: 0.03 para 3%)
 * @returns {object} - { gastos, totalGastos, montoFondo, totalAProrratear }
 */
export const calcularPreviewLiquidacion = async (porcentajeFondo) => {
  // 1. Obtener gastos pendientes y su total
  const { gastos, total: totalGastos } = await getGastosNoLiquidados();

  if (gastos.length === 0) {
    throw new Error("No hay gastos pendientes para liquidar.");
  }

  // 2. Calcular el fondo (basado en tu planilla "Planilla General.csv")
  const montoFondo = totalGastos * porcentajeFondo;
  
  // 3. Calcular el total final a dividir entre propietarios
  const totalAProrratear = totalGastos + montoFondo;

  return {
    gastos, // La lista de gastos que se incluirán
    totalGastos, // Suma de gastos
    montoFondo,  // Monto del fondo
    totalAProrratear // Total a dividir
  };
};

/**
 * Ejecuta la liquidación, actualiza saldos y marca gastos
 * @param {object} params - { nombre, fechaVenc1, pctRecargo, fechaVenc2 }
 * @param {object} preview - { gastos, totalAProrratear, ... }
 */
export const ejecutarLiquidacion = async (params, preview) => {
  const { nombre, fechaVenc1, pctRecargo, fechaVenc2 } = params;
  const { gastos, totalGastos, montoFondo, totalAProrratear } = preview;
  
  // 1. Obtener una lista fresca de todas las unidades
  const unidades = await getTodasUnidades();
  
  // 2. Validar que los porcentajes sumen 100% (o 1.0)
  const sumaPorcentajes = unidades.reduce((acc, u) => acc + u.porcentaje, 0);
  if (Math.abs(1 - sumaPorcentajes) > 0.0001) { // Tolerancia a decimales
    throw new Error(`La suma de porcentajes no es 1 (100%). Suma actual: ${(sumaPorcentajes * 100).toFixed(4)}%`);
  }
  
  // 3. Crear el nuevo documento de Liquidación
  const liquidacionRef = collection(db, "liquidaciones");
  const nuevaLiquidacion = {
    nombre,
    totalGastos,
    montoFondo,
    totalAProrratear,
    fechaCreada: serverTimestamp(),
    gastosIds: gastos.map(g => g.id), // Guardamos los IDs de los gastos
    unidadesIds: unidades.map(u => u.id) // Guardamos los IDs de las unidades
  };
  const liquidacionDoc = await addDoc(liquidacionRef, nuevaLiquidacion);
  const liquidacionId = liquidacionDoc.id;

  // 4. Iniciar una TRANSACCIÓN para actualizar todo
  try {
    await runTransaction(db, async (transaction) => {
      // --- A. Actualizar todos los GASTOS ---
      // (Marcar como 'liquidados' con el ID de esta liquidación)
      for (const gasto of gastos) {
        const gastoRef = doc(db, "gastos", gasto.id);
        transaction.update(gastoRef, { 
          liquidacionId: liquidacionId,
          liquidadoEn: nombre
        });
      }

      // --- B. Actualizar todas las UNIDADES (saldos) ---
      // Y crear un "item de cuenta corriente" para cada una
      for (const unidad of unidades) {
        // Calcular la deuda de esta unidad
        const montoAPagar = totalAProrratear * unidad.porcentaje;
        
        // El saldo actual de la unidad
        const unidadRef = doc(db, "unidades", unidad.id);
        const unidadDoc = await transaction.get(unidadRef);
        if (!unidadDoc.exists()) {
          throw new Error(`La unidad ${unidad.nombre} no existe.`);
        }
        const saldoAnterior = unidadDoc.data().saldo;
        
        // Actualizar el saldo (saldo negativo es deuda)
        transaction.update(unidadRef, {
          saldo: saldoAnterior - montoAPagar // AUMENTAMOS LA DEUDA
        });

        // --- C. Crear el "item de cuenta corriente" ---
        // (Esto es clave para el historial de deudas y pagos)
        const ctaCteRef = doc(collection(db, `unidades/${unidad.id}/cuentaCorriente`));
        const itemCtaCte = {
          fecha: Timestamp.now(),
          concepto: `Expensa ${nombre}`,
          monto: -montoAPagar, // Negativo porque es una deuda
          saldoResultante: saldoAnterior - montoAPagar,
          liquidacionId: liquidacionId,
          vencimiento1: fechaVenc1,
          montoVencimiento1: montoAPagar,
          vencimiento2: fechaVenc2,
          montoVencimiento2: montoAPagar * (1 + pctRecargo)
        };
        transaction.set(ctaCteRef, itemCtaCte);
      }
    }); // --- FIN DE LA TRANSACCIÓN ---
    
    console.log("¡Liquidación completada exitosamente!");
    return { liquidacionId, unidades };

  } catch (error) {
    // Si algo falla, Firebase revierte todo automáticamente
    console.error("¡FALLÓ LA TRANSACCIÓN! ", error);
    // (Opcional: borrar el documento 'liquidacion' que creamos)
    throw new Error(`Error al ejecutar la transacción: ${error.message}`);
  }
};