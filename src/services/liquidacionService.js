// src/services/liquidacionService.js
import { db, storage } from '../config/firebase';
import {
  collection, addDoc, doc, runTransaction,
  serverTimestamp, Timestamp, updateDoc,
  onSnapshot, query, orderBy, where, getDocs,
  getDoc // <-- ¡ASEGÚRATE DE IMPORTAR getDoc!
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getGastosNoLiquidados } from './gastosService';
import { getTodasUnidades } from './propietariosService';

// src/services/liquidacionService.js
// ... (otras importaciones como db, storage, collection, doc, getDoc, etc.)

// --- NUEVA VERSIÓN DE calcularPreviewLiquidacion ---
export const calcularPreviewLiquidacion = async (porcentajeFondoReserva) => {
  console.log("Calculando preview con % fondo:", porcentajeFondoReserva); // Log inicial

  // 1. Obtener gastos pendientes
  const { gastos: gastosPendientes, total: _ } = await getGastosNoLiquidados();
  if (gastosPendientes.length === 0) {
    throw new Error("No hay gastos pendientes para liquidar.");
  }
  console.log(`Gastos pendientes encontrados: ${gastosPendientes.length}`); // Log: cuántos gastos hay

  // 2. Obtener saldo inicial del fondo de reserva
  let saldoFondoInicial = 0;
  const configRef = doc(db, "configuracion", "general");
  try {
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data().hasOwnProperty('saldoFondoReserva')) {
      saldoFondoInicial = configSnap.data().saldoFondoReserva || 0;
      console.log("Saldo inicial del fondo:", saldoFondoInicial); // Log: saldo leído
    } else {
      console.warn("Documento 'configuracion/general' o campo 'saldoFondoReserva' no encontrado, asumiendo saldo de fondo 0.");
    }
  } catch (error) {
    console.error("Error al leer saldo del fondo:", error);
    throw new Error("No se pudo obtener el saldo del fondo de reserva.");
  }

  // 3. Clasificar y sumar gastos
  let totalGastosOrdinarios = 0;
  let totalGastosExtraProrrateo = 0;
  let totalGastosExtraUnidades = 0;
  let totalGastosExtraFondo = 0;
  const gastosIncluidos = [];

  gastosPendientes.forEach(gasto => {
    // <-- Log para cada gasto -->
    console.log(`Procesando gasto ${gasto.id}: Tipo=${gasto.tipo}, Distribucion=${gasto.distribucion}, Monto=${gasto.monto}`);
    const montoGasto = Number(gasto.monto) || 0; // Asegurarse que monto es un número

    if (gasto.tipo === 'Ordinario') {
      totalGastosOrdinarios += montoGasto;
      gastosIncluidos.push(gasto);
      console.log(` -> Sumado a Ordinarios. Nuevo total: ${totalGastosOrdinarios}`);
    } else if (gasto.tipo === 'Extraordinario') {
      switch (gasto.distribucion) {
        case 'Prorrateo':
          totalGastosExtraProrrateo += montoGasto;
          gastosIncluidos.push(gasto);
          console.log(` -> Sumado a Extra Prorrateo. Nuevo total: ${totalGastosExtraProrrateo}`);
          break;
        case 'UnidadesEspecificas':
          totalGastosExtraUnidades += montoGasto;
          gastosIncluidos.push(gasto);
          console.log(` -> Sumado a Extra Unidades. Nuevo total: ${totalGastosExtraUnidades}`);
          break;
        case 'FondoDeReserva':
          totalGastosExtraFondo += montoGasto;
          gastosIncluidos.push(gasto);
          console.log(` -> Sumado a Extra Fondo. Nuevo total: ${totalGastosExtraFondo}`);
          break;
        default:
          console.warn(` -> Gasto extraordinario ${gasto.id} con distribución desconocida: ${gasto.distribucion}`);
      }
    } else {
      console.warn(` -> Gasto ${gasto.id} con tipo desconocido: ${gasto.tipo}`);
    }
  });

  console.log("Totales calculados después del bucle:", { totalGastosOrdinarios, totalGastosExtraProrrateo, totalGastosExtraUnidades, totalGastosExtraFondo }); // Log: totales finales

  // 4. Calcular aporte al fondo de reserva (sobre ordinarios)
  const montoFondoReservaCalculado = totalGastosOrdinarios * porcentajeFondoReserva;

  // 5. Calcular total a prorratear general
  const totalAProrratearGeneral = totalGastosOrdinarios + montoFondoReservaCalculado + totalGastosExtraProrrateo;

  // 6. Calcular saldo final estimado del fondo
  const saldoFondoFinal = saldoFondoInicial - totalGastosExtraFondo + montoFondoReservaCalculado;

  // 7. Verificar si el fondo es suficiente
  let errorFondo = '';
  // (Lógica de errorFondo sin cambios...)
   if (saldoFondoFinal < 0) {
    errorFondo = `El Fondo de Reserva quedaría negativo (${formatCurrency(saldoFondoFinal)}). Se necesitan ${formatCurrency(Math.abs(saldoFondoFinal))} adicionales para cubrir los gastos extraordinarios asignados.`;
    console.warn(errorFondo);
  } else if (totalGastosExtraFondo > saldoFondoInicial) {
     errorFondo = `Saldo inicial del Fondo (${formatCurrency(saldoFondoInicial)}) es insuficiente para cubrir los gastos Extraordinarios asignados (${formatCurrency(totalGastosExtraFondo)}).`;
     console.warn(errorFondo);
  }

  // 8. Devolver el objeto completo
  const previewCompleta = {
    gastosIncluidos,
    totalGastosOrdinarios,
    montoFondoReservaCalculado,
    totalGastosExtraProrrateo,
    totalAProrratearGeneral,
    totalGastosExtraUnidades,
    totalGastosExtraFondo,
    saldoFondoInicial,
    saldoFondoFinal,
    errorFondo,
    pctRecargo: 0.10 // Asegúrate que este valor coincida con el estado pctRecargo si es dinámico
  };

  console.log("Preview final a devolver:", previewCompleta); // Log: objeto final
  return previewCompleta;
};

// ... (El resto de liquidacionService.js: ejecutarLiquidacion, uploadCuponPDF, etc.)