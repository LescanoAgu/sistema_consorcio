// src/pages/admin/LiquidacionPage.jsx

import React, { useState } from 'react';
import { calcularPreviewLiquidacion, ejecutarLiquidacion } from '../../services/liquidacionService';
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
    if (!preview) {
      setError("Primero debes calcular la previsualización.");
      return;
    }
    
    if (!nombre || !fechaVenc1 || !fechaVenc2) {
      setError("Completa todos los campos del período (Nombre y Fechas).");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const params = {
        nombre,
        fechaVenc1,
        pctRecargo: parseFloat(pctRecargo) / 100,
        fechaVenc2,
      };

      // --- 2. OBTENEMOS LOS DATOS DE VUELTA ---
      const { liquidacionId, unidades, itemsCtaCteGenerados } = 
        await ejecutarLiquidacion(params, preview);

      alert(`¡Liquidación "${nombre}" generada! 
        Actualizados ${unidades.length} saldos. 
        Generando PDFs...`);

      // ¡AQUÍ ES DONDE GENERAREMOS LOS PDFs! (próximo paso)
      const liquidacionData = {
        nombre: nombre,
        totalGastos: preview.totalGastos,
        montoFondo: preview.montoFondo,
        totalAProrratear: preview.totalAProrratear
      };      
      // Recorremos las unidades y generamos un PDF para cada una
      for (const unidad of unidades) {
        // Buscamos el item de CtaCte que le corresponde
        const itemCtaCte = itemsCtaCteGenerados.find(item => item.unidadId === unidad.id);
        
        if (itemCtaCte) {
          // ¡Llamamos al generador!
          generarPDFLiquidacion(
            unidad, 
            liquidacionData, 
            preview.gastos, 
            itemCtaCte
          );
        }
      }
      // Limpiamos todo para la próxima liquidación
      setPreview(null);
      setNombre('');
      setFechaVenc1('');
      setFechaVenc2('');
      setError('');

    } catch (err) {
      // Si la transacción falla, mostramos el error
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


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
            />
          </div>
          <div style={styles.field}>
            <label>% Fondo Reserva</label>
            <input
              type="number"
              value={pctFondo}
              onChange={(e) => setPctFondo(e.target.value)}
              style={styles.input}
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
            />
          </div>
          <div style={styles.field}>
            <label>% Recargo 2do Venc.</label>
            <input
              type="number"
              value={pctRecargo}
              onChange={(e) => setPctRecargo(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label>Fecha 2do Vencimiento</label>
            <input
              type="date"
              value={fechaVenc2}
              onChange={(e) => setFechaVenc2(e.target.value)}
              style={styles.input}
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
          <button onClick={handleEjecutar} disabled={loading} style={{...styles.button, background: 'green'}}>
            {loading ? 'Procesando...' : '2. Confirmar y Generar PDFs'}
          </button>
        </div>
      )}
    </div>
  );
}

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