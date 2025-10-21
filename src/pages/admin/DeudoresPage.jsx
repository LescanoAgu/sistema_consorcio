import React, { useState } from 'react';
import { aplicarInteresesMoratorios } from '../../services/propietariosService';
import DeudoresList from '../../components/DeudoresList';

// --- IMPORTACIONES DE MUI ---
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress, Grid } from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

function DeudoresPage() {
  const [tem, setTem] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmitIntereses = async (e) => {
    e.preventDefault();
    const confirmacion = window.confirm(
      "¿Está seguro que desea aplicar intereses a TODOS los deudores?\n" +
      "Esta acción afectará sus saldos permanentemente."
    );
    if (!confirmacion) return;

    setLoading(true);
    setMessage('');

    try {
      const temFloat = parseFloat(tem.replace(',', '.'));
      if (isNaN(temFloat) || temFloat <= 0) {
        throw new Error('La Tasa (TEM) debe ser un número positivo.');
      }
      const tasaDecimal = temFloat / 100;
      const mesActual = new Date().toLocaleString('es-AR', { month: 'long' });
      const anioActual = new Date().getFullYear();
      const mesCapitalizado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);
      const concepto = `Interés por Mora (${mesCapitalizado} ${anioActual})`;

      const resultado = await aplicarInteresesMoratorios(tasaDecimal, concepto);

      if (resultado.unidadesActualizadas === 0) {
        setMessage('No se encontraron deudores para aplicar intereses.');
      } else {
        setMessage(`¡Intereses aplicados a ${resultado.unidadesActualizadas} deudores! El total de interés aplicado fue ${resultado.totalInteres.toFixed(2)}.`);
        setTem('');
      }

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Módulo de Deudores
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Aplicar Intereses Moratorios (TEM)
        </Typography>
        <Box component="form" onSubmit={handleSubmitIntereses}>
          {/* Usamos Grid v2: Las props xs/sm van directamente en los <Grid> hijos */}
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} sm={4}> {/* <- xs/sm aquí */}
              <TextField
                label="Tasa Efectiva Mensual (%)"
                type="number"
                fullWidth
                placeholder="Ej: 5"
                value={tem}
                onChange={(e) => setTem(e.target.value)}
                required
                InputProps={{
                  endAdornment: '%',
                }}
              />
            </Grid>
            <Grid xs={12} sm={4}> {/* <- xs/sm aquí */}
              <Button
                type="submit"
                variant="contained"
                color="warning"
                fullWidth
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Aplicar Intereses a Deudores'}
              </Button>
            </Grid>
          </Grid>
          {message && (
            <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 3 }}>
              {message}
            </Alert>
          )}
        </Box>
      </Paper>

      <DeudoresList />
    </Box>
  );
}

export default DeudoresPage;