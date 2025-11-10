import React, { useState, useEffect } from 'react';
import { getTasaMoraProlongada, setTasaMoraProlongada } from '../../services/propietariosService';
import { useConsorcio } from '../../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK

import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress, Grid
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SaveIcon from '@mui/icons-material/Save';

function TasasInteresPage() {
  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER CONSORCIO ACTIVO

  const [tasaActual, setTasaActual] = useState(0.07);
  const [tasaInput, setTasaInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Cargar tasa actual al inicio
  useEffect(() => {
    // 3. VALIDAR CONSORCIO
    if (!consorcioId) {
      setLoading(false);
      setTasaActual(0.07); // Valor por defecto si no hay consorcio
      setTasaInput('7.00');
      return;
    }
    
    setLoading(true);
    
    // 4. PASAR consorcioId AL SERVICIO
    const unsubscribe = getTasaMoraProlongada(consorcioId, (tasa) => {
      setTasaActual(tasa);
      setTasaInput((tasa * 100).toFixed(2));
      setLoading(false);
    });
    return () => unsubscribe();
    
  }, [consorcioId]); // <-- 5. AGREGAR consorcioId A DEPENDENCIAS

  // 2. Manejar el guardado
  const handleSave = async (e) => {
    e.preventDefault();
    
    // 6. VALIDAR CONSORCIO ANTES DE GUARDAR
    if (!consorcioId) {
      setMessage("Error al guardar: No hay un consorcio seleccionado.");
      return;
    }
    
    setSaving(true);
    setMessage('');
    
    try {
      const tasaPorcentaje = parseFloat(tasaInput.replace(',', '.'));
      if (isNaN(tasaPorcentaje) || tasaPorcentaje <= 0 || tasaPorcentaje > 100) {
        throw new Error("Ingrese una tasa válida entre 0 y 100.");
      }
      
      const tasaDecimal = tasaPorcentaje / 100;
      
      // 7. PASAR consorcioId AL SERVICIO
      await setTasaMoraProlongada(consorcioId, tasaDecimal);
      
      setMessage(`Tasa BNA actualizada exitosamente a ${tasaPorcentaje.toFixed(2)}%!`);
    } catch (error) {
      setMessage(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formDisabled = loading || saving || !consorcioId;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Configuración de Intereses por Mora
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          Tasa BNA (Mora Prolongada) <AttachMoneyIcon sx={{ ml: 1, color: 'green' }} />
        </Typography>
        
        {/* 8. Mensaje si no hay consorcio */}
        {!consorcioId ? (
           <Alert severity="warning">Seleccione un consorcio para configurar las tasas.</Alert>
        ) : loading ? (
          <CircularProgress />
        ) : (
          <>
            <Typography variant="h5" color="primary" sx={{ mb: 2 }}>
              Tasa Actual: **{(tasaActual * 100).toFixed(2)} %**
            </Typography>
            
            <Box component="form" onSubmit={handleSave}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nueva Tasa Mensual (%)"
                    type="number"
                    fullWidth
                    placeholder="Ej: 7.5"
                    value={tasaInput}
                    onChange={(e) => setTasaInput(e.target.value)}
                    required
                    InputProps={{ 
                        inputProps: { step: '0.01', min: '0', max: '100' },
                        endAdornment: '%' 
                    }}
                    disabled={formDisabled}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={formDisabled}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  >
                    Guardar Tasa BNA
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </>
        )}
        
        {message && (
          <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 3 }}>
            {message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default TasasInteresPage;