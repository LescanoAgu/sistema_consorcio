// src/pages/admin/LiquidacionPage.jsx
import React, { useState } from 'react';
import {
  calcularPreviewLiquidacion,
  ejecutarLiquidacion, 
  uploadCuponPDF,
  guardarURLCupon
} from '../../services/liquidacionService';
import { generarPDFLiquidacion } from '../../utils/pdfGenerator';

// --- IMPORTACIONES DE MUI ---
import {
  Box, Button, TextField, Typography, Paper, Alert,
  CircularProgress, Grid, Divider
} from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

// <-- AÑADIMOS IMPORTACIONES DE FIRESTORE -->
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase'; // <-- Importar db

const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

function LiquidacionPage() {
  // --- Estados del Formulario ---
  const [nombre, setNombre] = useState(''); // Ej: "Octubre 2025"
  const [pctFondo, setPctFondo] = useState('3'); // 3% por defecto
  const [fechaVenc1, setFechaVenc1] = useState('');
  const [pctRecargo, setPctRecargo] = useState('10'); // 10% por defecto
  const [fechaVenc2, setFechaVenc2] = useState('');

  // --- Estados de la App ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // Errores generales
  const [previewError, setPreviewError] = useState(''); 
  const [preview, setPreview] = useState(null); 

  // --- PASO 1: Calcular la Preview (USANDO TU LÓGICA ANTERIOR) ---
  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPreviewError('');
    setPreview(null);

    try {
      const porcentajeFondo = parseFloat(pctFondo) / 100;
      if (isNaN(porcentajeFondo)) {
        throw new Error("El % de Fondo de Reserva es inválido.");
      }

      // *** NOTA: Asumo que tu backend (calcularPreviewLiquidacion) fue actualizado
      // para devolver la estructura que implementamos en el paso anterior
      // (ej: totalGastosOrdinarios, saldoFondoInicial, etc.)
      const previewData = await calcularPreviewLiquidacion(porcentajeFondo);
      setPreview(previewData);

      if (previewData.errorFondo) {
        setPreviewError(previewData.errorFondo);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 2: Ejecutar (MODIFICADO) ---
  const handleEjecutar = async () => {
    // ---- VALIDACIONES INICIALES (NO CAMBIAN) ----
    if (!preview) {
      setError("Primero debes calcular la previsualización.");
      return;
    }
    if (previewError) {
        if (!window.confirm(`ADVERTENCIA:\n${previewError}\n\n¿Desea continuar y generar la liquidación de todas formas?`)) {
            return;
        }
    }
    if (!nombre || !fechaVenc1 || !fechaVenc2) {
      setError("Completa todos los campos del período (Nombre y Fechas).");
      return;
    }
    // ---- FIN VALIDACIONES ----

    setLoading(true); 
    setError(''); 
    setPreviewError(''); 
    
    let liquidacionIdParaCatch = null; // Para poder revertir si falla

    try {
      const params = {
        nombre,
        fechaVenc1,
        pctRecargo: parseFloat(pctRecargo) / 100,
        fechaVenc2,
      };

      // --- 1. EJECUTAR LA TRANSACCIÓN (MODIFICADO) ---
      // <-- Ahora capturamos 'detalleUnidades' y 'liquidacionId'
      const { liquidacionId, unidades, itemsCtaCteGenerados, detalleUnidades } =
        await ejecutarLiquidacion(params, preview);
      
      liquidacionIdParaCatch = liquidacionId; // Guardamos ID por si falla

      // --- 2. GENERAR Y SUBIR PDFs (MODIFICADO) ---

      // Asumo que 'preview.gastos' (del handlePreview) es la lista de gastos
      // Si actualizaste el backend, quizás sea 'preview.gastosIncluidos'
      const gastosParaPDF = preview.gastos || preview.gastosIncluidos || [];
      
      // Los datos para el PDF ahora usan la preview completa
      const liquidacionData = {
        nombre: nombre,
        ...preview
      };

      setError(`Liquidación "${nombre}" guardada. Generando y subiendo PDFs... (0/${unidades.length})`);

      let contador = 0;
      for (const unidad of unidades) {
        const itemCtaCte = itemsCtaCteGenerados.find(item => item.unidadId === unidad.id);

        if (itemCtaCte && itemCtaCte.id) {

          // A. Generar el PDF (ahora devuelve un Blob)
          const pdfBlob = generarPDFLiquidacion(
            unidad,
            liquidacionData, // Pasamos la preview completa
            gastosParaPDF,   // Pasamos la lista de gastos
            itemCtaCte
          );

          // B. Subir el Blob a Firebase Storage
          const downloadURL = await uploadCuponPDF(
            pdfBlob,
            nombre, 
            unidad.nombre 
          );

          // C. Guardar la URL en el doc de Cta. Cte.
          await guardarURLCupon(
            unidad.id,
            itemCtaCte.id,
            downloadURL
          );

          // <-- ¡NUEVO! Actualizar el snapshot local 'detalleUnidades' -->
          const detalle = detalleUnidades.find(d => d.unidadId === unidad.id);
          if (detalle) {
            detalle.cuponURL = downloadURL; // Añadimos la URL al objeto
          }
          // <-- Fin nuevo paso -->

          contador++;
          setError(`Generando y subiendo PDFs... (${contador}/${unidades.length})`);
        }
      }

      // --- 3. ACTUALIZAR EL DOC. LIQUIDACIÓN CON EL SNAPSHOT COMPLETO ---
      // <-- ¡NUEVO! Guardamos el snapshot CON las URLs -->
      console.log("Guardando snapshot final con URLs en el documento de liquidación...");
      const liquidacionDocRef = doc(db, "liquidaciones", liquidacionId);
      await updateDoc(liquidacionDocRef, {
        detalleUnidades: detalleUnidades // <-- Ahora este array contiene las cuponURL
      });
      console.log("Snapshot final guardado.");
      // <-- Fin nuevo paso -->


      // 4. ¡Todo listo! Limpiamos el formulario
      alert(`¡Proceso completado! Se generaron y subieron ${contador} cupones PDF.`);
      setPreview(null);
      setNombre('');
      setFechaVenc1('');
      setFechaVenc2('');
      setError('');

    } catch (err) {
      console.error("Error al ejecutar liquidación o subir PDFs:", err);
      setError(`Error: ${err.message}`);
      // Aquí podrías implementar la lógica de borrado si falla
      // if (liquidacionIdParaCatch) { ... }
    } finally {
      setLoading(false); 
    }
  }; // <--- Cierre de handleEjecutar

  // --- RENDER CON MUI (Asumiendo que aplicaste mi sugerencia anterior) ---
  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Módulo de Liquidación de Expensas
      </Typography>

      {/* --- Formulario de Parámetros --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. Parámetros del Período
        </Typography>
        <Box component="form" onSubmit={handlePreview}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Nombre Período"
                placeholder="Ej: Octubre 2025"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="% Fondo Reserva (s/Ord.)"
                type="number"
                value={pctFondo}
                onChange={(e) => setPctFondo(e.target.value)}
                fullWidth
                required
                InputProps={{ inputProps: { step: '0.1' } }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Fecha 1er Vencimiento"
                type="date"
                value={fechaVenc1}
                onChange={(e) => setFechaVenc1(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="% Recargo 2do Venc."
                type="number"
                value={pctRecargo}
                onChange={(e) => setPctRecargo(e.target.value)}
                fullWidth
                required
                InputProps={{ inputProps: { step: '0.1' } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Fecha 2do Vencimiento"
                type="date"
                value={fechaVenc2}
                onChange={(e) => setFechaVenc2(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained" disabled={loading} fullWidth size="large">
                {loading ? <CircularProgress size={24} /> : '1. Calcular Previsualización'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* --- Zona de Error General --- */}
      {error && (
          <Alert severity={loading ? "info" : "error"} sx={{ mt: 2 }}> 
             {error}
          </Alert>
      )}

      {/* --- Zona de Previsualización (Asumiendo mi código anterior) --- */}
      {preview && !error && (
        <Paper sx={{ p: 3, mt: 2, background: '#f9f9f9' }}>
          <Typography variant="h6" gutterBottom>
            2. Previsualización del Cálculo
          </Typography>
          
          {previewError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                  {previewError}
              </Alert>
          )}

          {/* Si estás usando la PREVIEW VIEJA (antes de mi sugerencia anterior) */}
          {/* Descomenta esto y comenta la sección de Grid de abajo */}
          {/*
          <TotalRow label="Total Gastos Ordinarios:" value={preview.totalGastos} />
          <TotalRow label={`(+) Fondo de Reserva (${pctFondo}%):`} value={preview.montoFondo} />
          <Divider sx={{ my: 1 }} />
          <TotalRow label="TOTAL A PRORRATEAR:" value={preview.totalAProrratear} isTotal />
          */}

          {/* Si estás usando la PREVIEW NUEVA (con mi sugerencia anterior) */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>Desglose de Gastos y Aportes</Typography>
              <TotalRow label="Total Gastos Ordinarios:" value={preview.totalGastosOrdinarios} />
              <TotalRow label={`(+) Aporte Fondo Reserva (${pctFondo}%):`} value={preview.montoFondoReservaCalculado} />
              <TotalRow label="Total Gastos Extra (Prorrateo):" value={preview.totalGastosExtraProrrateo} />
              <Divider sx={{ my: 1 }} />
              <TotalRow label="TOTAL A PRORRATEAR GENERAL:" value={preview.totalAProrratearGeneral} isTotal />
              
              <Box sx={{ mt: 2, p: 1, background: '#eee', borderRadius: 1 }}>
                 <Typography variant="caption" display="block">Gastos que NO se prorratean:</Typography>
                 <TotalRow label="Gastos Extra (Unidades Específicas):" value={preview.totalGastosExtraUnidades} small />
                 <TotalRow label="Gastos Extra (Cubiertos por Fondo):" value={preview.totalGastosExtraFondo} small />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>Impacto en Fondo de Reserva</Typography>
              <TotalRow label="Saldo Inicial del Fondo:" value={preview.saldoFondoInicial} />
              <TotalRow label="(-) Gastos cubiertos por Fondo:" value={formatCurrency(preview.totalGastosExtraFondo)} color="error.main" />
              <TotalRow label="(+) Aporte de este período:" value={formatCurrency(preview.montoFondoReservaCalculado)} color="success.main" />
              <Divider sx={{ my: 1 }} />
              <TotalRow label="SALDO FINAL ESTIMADO:" value={preview.saldoFondoFinal} isTotal />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />

          <Button 
            onClick={handleEjecutar} 
            disabled={loading || !nombre || !fechaVenc1 || !fechaVenc2} 
            variant="contained" 
            color="success" 
            fullWidth 
            size="large"
           >
            {loading ? 'Procesando...' : '2. Confirmar y Generar Liquidación y PDFs'}
          </Button>
        </Paper>
      )}
    </Box>
  );
} 

// --- Componente helper para las filas de totales ---
const TotalRow = ({ label, value, isTotal = false, small = false, color = "text.primary" }) => {
  const formattedValue = typeof value === 'number' ? formatCurrency(value) : (value || formatCurrency(0)); // Default a 0
  
  const variant = isTotal ? "subtitle1" : (small ? "body2" : "body1");
  const fontWeight = isTotal ? 'bold' : 'normal';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 0.5 }}>
      <Typography variant={variant} fontWeight={fontWeight} sx={{ color: color }}>
        {label}
      </Typography>
      <Typography variant={variant} fontWeight={fontWeight} sx={{ color: color, fontFamily: 'monospace' }}>
        {formattedValue}
      </Typography>
    </Box>
  );
};

export default LiquidacionPage;