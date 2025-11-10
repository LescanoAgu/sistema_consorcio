import React, { useState, useEffect } from 'react';
import { getTasaMoraProlongada, setTasaMoraProlongada } from '../../services/propietariosService';

import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress, Grid
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SaveIcon from '@mui/icons-material/Save';

function TasasInteresPage() {
  const [tasaActual, setTasaActual] = useState(0.07); // Muestra la tasa actual
  const [tasaInput, setTasaInput] = useState(''); // Valor del input (en porcentaje)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Cargar tasa actual al inicio
  useEffect(() => {
    setLoading(true);
    const unsubscribe = getTasaMoraProlongada((tasa) => {
      setTasaActual(tasa);
      setTasaInput((tasa * 100).toFixed(2)); // Mostrar en porcentaje en el input
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Manejar el guardado
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    try {
      const tasaPorcentaje = parseFloat(tasaInput.replace(',', '.'));
      if (isNaN(tasaPorcentaje) || tasaPorcentaje <= 0 || tasaPorcentaje > 100) {
        throw new Error("Ingrese una tasa válida entre 0 y 100.");
      }
      
      const tasaDecimal = tasaPorcentaje / 100;
      await setTasaMoraProlongada(tasaDecimal);
      
      setMessage(`Tasa BNA actualizada exitosamente a ${tasaPorcentaje.toFixed(2)}%!`);
    } catch (error) {
      setMessage(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Configuración de Intereses por Mora
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          Tasa BNA (Mora Prolongada) <AttachMoneyIcon sx={{ ml: 1, color: 'green' }} />
        </Typography>
        
        {loading ? (
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
                    disabled={saving}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={saving}
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