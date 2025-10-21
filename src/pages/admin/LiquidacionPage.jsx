import React, { useState } from 'react';
import {
  calcularPreviewLiquidacion,
  ejecutarLiquidacion,
  uploadCuponPDF,
  guardarURLCupon
} from '../../services/liquidacionService';
import { generarPDFLiquidacion } from '../../utils/pdfGenerator';

function LiquidacionPage() {
  // --- Estados del Formulario ---
  const [nombre, setNombre] = useState(''); // Ej: "Octubre 2025"
  const [pctFondo, setPctFondo] = useState('3'); // 3% por defecto
  const [fechaVenc1, setFechaVenc1] = useState('');
  const [pctRecargo, setPctRecargo] = useState('10'); // 10% por defecto
  const [fechaVenc2, setFechaVenc2] = useState('');

  // --- Estados de la App ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // Aquí guardamos la preview

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  // --- PASO 1: Calcular la Preview ---
  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPreview(null);

    try {
      const porcentajeFondo = parseFloat(pctFondo) / 100;
      if (isNaN(porcentajeFondo)) {
        throw new Error("El % de Fondo de Reserva es inválido.");
      }

      // Llamamos al servicio
      const previewData = await calcularPreviewLiquidacion(porcentajeFondo);
      setPreview(previewData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 2: Ejecutar (¡AHORA SÍ HACE ALGO!) ---
  const handleEjecutar = async () => {
    // ---- VALIDACIONES INICIALES ----
    if (!preview) {
      setError("Primero debes calcular la previsualización.");
      return;
    }
    
    if (!nombre || !fechaVenc1 || !fechaVenc2) {
      setError("Completa todos los campos del período (Nombre y Fechas).");
      return;
    }
    // ---- FIN VALIDACIONES ----

    setLoading(true); // Ponemos loading al inicio
    setError(''); // Limpiamos errores previos

    try {
      const params = {
        nombre,
        fechaVenc1,
        pctRecargo: parseFloat(pctRecargo) / 100,
        fechaVenc2,
      };

      // --- 1. EJECUTAR LA TRANSACCIÓN (Esto no cambia) ---
      // itemsCtaCteGenerados AHORA CONTIENE EL ".id" gracias al paso anterior
      const { liquidacionId, unidades, itemsCtaCteGenerados } =
        await ejecutarLiquidacion(params, preview);


      // --- 2. GENERAR Y SUBIR PDFs (NUEVO FLUJO) ---

      // Preparamos los datos comunes de la liquidación
      const liquidacionData = {
        nombre: nombre,
        totalGastos: preview.totalGastos,
        montoFondo: preview.montoFondo,
        totalAProrratear: preview.totalAProrratear
      };

      // Mostramos un "cargando" más específico
      // Usamos setError para mostrar el progreso
      setError(`Liquidación "${nombre}" guardada. Generando y subiendo PDFs... (0/${unidades.length})`);

      let contador = 0;
      // Recorremos las unidades para generar, subir y actualizar
      // Usamos un 'for...of' para poder usar 'await' dentro
      for (const unidad of unidades) {
        // Buscamos el itemCtaCte que le corresponde
        const itemCtaCte = itemsCtaCteGenerados.find(item => item.unidadId === unidad.id);

        // Verificamos que tengamos el item Y el ID del documento
        if (itemCtaCte && itemCtaCte.id) {

          // A. Generar el PDF (ahora devuelve un Blob)
          const pdfBlob = generarPDFLiquidacion(
            unidad,
            liquidacionData,
            preview.gastos,
            itemCtaCte
          );

          // B. Subir el Blob a Firebase Storage
          const downloadURL = await uploadCuponPDF(
            pdfBlob,
            nombre, // "Octubre 2025"
            unidad.nombre // "Departamento 1"
          );

          // C. Guardar la URL en el doc de Cta. Cte.
          await guardarURLCupon(
            unidad.id,        // ID de la unidad (para la ruta)
            itemCtaCte.id,    // ID del documento de CtaCte
            downloadURL
          );

          contador++;
          setError(`Generando y subiendo PDFs... (${contador}/${unidades.length})`);
        }
      }

      // 4. ¡Todo listo! Limpiamos el formulario
      alert(`¡Proceso completado! Se generaron y subieron ${contador} cupones PDF.`);
      setPreview(null);
      setNombre('');
      setFechaVenc1('');
      setFechaVenc2('');
      setError('');

    } catch (err) {
      // Si la transacción o la subida de PDFs falla, mostramos el error
      console.error("Error al ejecutar liquidación o subir PDFs:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false); // Quitamos loading al final, ya sea éxito o error
    }
  }; // <--- Cierre de handleEjecutar (la llave extra fue eliminada)

  // AHORA EL RETURN ESTÁ CORRECTAMENTE DENTRO DE LiquidacionPage
  return (
    <div>
      <h2>Módulo de Liquidación de Expensas</h2>

      {/* --- Formulario de Parámetros --- */}
      <form onSubmit={handlePreview} style={styles.formContainer}>
        <h3>1. Parámetros del Período</h3>

        {/* Fila 1 */}
        <div style={styles.row}>
          <div style={styles.field}>
            <label>Nombre Período</label>
            <input
              type="text"
              placeholder="Ej: Octubre 2025"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={styles.input}
              required // Agregado required
            />
          </div>
          <div style={styles.field}>
            <label>% Fondo Reserva</label>
            <input
              type="number"
              value={pctFondo}
              onChange={(e) => setPctFondo(e.target.value)}
              style={styles.input}
              required // Agregado required
            />
          </div>
        </div>

        {/* Fila 2 */}
        <div style={styles.row}>
          <div style={styles.field}>
            <label>Fecha 1er Vencimiento</label>
            <input
              type="date"
              value={fechaVenc1}
              onChange={(e) => setFechaVenc1(e.target.value)}
              style={styles.input}
              required // Agregado required
            />
          </div>
          <div style={styles.field}>
            <label>% Recargo 2do Venc.</label>
            <input
              type="number"
              value={pctRecargo}
              onChange={(e) => setPctRecargo(e.target.value)}
              style={styles.input}
              required // Agregado required
            />
          </div>
          <div style={styles.field}>
            <label>Fecha 2do Vencimiento</label>
            <input
              type="date"
              value={fechaVenc2}
              onChange={(e) => setFechaVenc2(e.target.value)}
              style={styles.input}
              required // Agregado required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Calculando...' : '1. Calcular Previsualización'}
        </button>
      </form>

      {/* --- Zona de Error --- */}
      {error && <p style={styles.error}>{error}</p>}

      {/* --- Zona de Previsualización --- */}
      {preview && (
        <div style={styles.previewContainer}>
          <h3>2. Previsualización (Cálculo)</h3>
          <p>Se incluirán <strong>{preview.gastos.length}</strong> gastos pendientes.</p>
          <hr/>
          <p style={styles.totalRow}>
            <span>Total Gastos Ordinarios:</span>
            <strong>{formatCurrency(preview.totalGastos)}</strong>
          </p>
          <p style={styles.totalRow}>
            <span>(+) Fondo de Reserva ({pctFondo}%):</span>
            <strong>{formatCurrency(preview.montoFondo)}</strong>
          </p>
          <hr/>
          <p style={{...styles.totalRow, fontSize: '1.2em'}}>
            <span>TOTAL A PRORRATEAR:</span>
            <strong>{formatCurrency(preview.totalAProrratear)}</strong>
          </p>
          <hr/>
          <button onClick={handleEjecutar} disabled={loading || !nombre || !fechaVenc1 || !fechaVenc2} style={{...styles.button, background: 'green'}}>
            {loading ? 'Procesando...' : '2. Confirmar y Generar PDFs'}
          </button>
        </div>
      )}
    </div>
  );
} // <--- Cierre de la función LiquidacionPage


// --- Estilos para la página ---
const styles = {
  formContainer: { padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' },
  previewContainer: { padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', marginTop: '20px' },
  row: { display: 'flex', gap: '20px', marginBottom: '15px' },
  field: { flex: 1, display: 'flex', flexDirection: 'column' },
  input: { width: '100%', padding: '8px', boxSizing: 'border-box' },
  button: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', border: 'none', color: 'white', background: '#007bff' },
  error: { color: 'red', fontWeight: 'bold' },
  totalRow: { display: 'flex', justifyContent: 'space-between', margin: '10px 0' }
};

export default LiquidacionPage;