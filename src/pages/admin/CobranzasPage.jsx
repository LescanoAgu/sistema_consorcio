// src/pages/admin/CobranzasPage.jsx
import React, { useState, useEffect } from 'react';
import { getTodasUnidades, registrarPago } from '../../services/propietariosService';
import {
  Box, Button, TextField, Typography, Paper, Alert, CircularProgress, Grid,
  Autocomplete
} from '@mui/material';

function CobranzasPage() {
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const cargarUnidades = async () => {
      setLoadingUnidades(true);
      try {
        const unidadesObtenidas = await getTodasUnidades();
        unidadesObtenidas.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setUnidades(unidadesObtenidas);
      } catch (error) {
        setMessage('Error al cargar la lista de unidades.');
        console.error("Error fetching unidades:", error);
      } finally {
        setLoadingUnidades(false);
      }
    };
    cargarUnidades();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!unidadSeleccionada) {
      setMessage('Error: Debes seleccionar una unidad.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const montoFloat = parseFloat(monto.replace(',', '.'));
      if (isNaN(montoFloat) || montoFloat <= 0) {
        throw new Error('El monto debe ser un número positivo.');
      }
      await registrarPago(unidadSeleccionada.id, montoFloat, fecha, concepto || `Pago ${unidadSeleccionada.nombre}`);
      setMessage(`¡Pago de ${formatCurrency(montoFloat)} registrado exitosamente para ${unidadSeleccionada.nombre}!`);
      setUnidadSeleccionada(null);
      setMonto('');
      setConcepto('');
      // Forzar reseteo visual del Autocomplete si es necesario
      // Puedes intentar limpiar el input directamente si setUnidadSeleccionada(null) no funciona
      // const input = document.querySelector('#autocomplete-unidad input');
      // if (input) input.value = '';
    } catch (error) {
      setMessage(`Error al registrar el pago: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

   const formatCurrency = (value) => {
      if (typeof value !== 'number') return '';
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
   };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Registro de Cobranzas
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Registrar Nuevo Pago
        </Typography>
        {loadingUnidades ? (
          <CircularProgress />
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
             {/* Usamos alignItems="flex-end" */}
            <Grid container spacing={3} alignItems="flex-end">

              {/* Selector de Unidad - AÚN MÁS ANCHO */}
              <Grid item xs={12} sm={12} md={6}> {/* <-- Ocupa todo en sm, mitad en md */}
                <Autocomplete
                  id="autocomplete-unidad" // Añadir ID para posible manipulación manual (último recurso)
                  options={unidades}
                  getOptionLabel={(option) => `${option.nombre} (${option.propietario})`}
                  value={unidadSeleccionada}
                  onChange={(event, newValue) => {
                    setUnidadSeleccionada(newValue);
                  }}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Seleccionar Unidad" required variant="standard" />
                  )}
                  disabled={loading}
                  // Quitar la key puede ayudar a veces si causa problemas con el reset
                  // key={unidadSeleccionada ? unidadSeleccionada.id : 'autocomplete-reset'}
                />
              </Grid>

              {/* Monto */}
              <Grid item xs={12} sm={6} md={3}> {/* <-- Ajustado */}
                <TextField
                  label="Monto Pagado"
                  type="number"
                  fullWidth
                  placeholder="Ej: 25000.50"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  InputProps={{ inputProps: { step: '0.01' } }}
                  disabled={loading}
                  variant="standard"
                />
              </Grid>

              {/* Fecha */}
              <Grid item xs={12} sm={6} md={3}> {/* <-- Ajustado */}
                <TextField
                  label="Fecha del Pago"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  disabled={loading}
                  variant="standard"
                />
              </Grid>

              {/* Concepto (Opcional) */}
              <Grid item xs={12} sm={9} md={9}> {/* <-- Más ancho */}
                <TextField
                  label="Concepto / Referencia (Opcional)"
                  fullWidth
                  placeholder="Ej: Pago Expensa Octubre, Transferencia Banco X"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  disabled={loading}
                  variant="standard"
                />
              </Grid>

              {/* Botón Guardar */}
              <Grid item xs={12} sm={3} md={3}> {/* <-- Ajustado */}
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !unidadSeleccionada}
                >
                  {loading ? <CircularProgress size={24} /> : 'Registrar Pago'}
                </Button>
              </Grid>
            </Grid>

            {message && (
              <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 3 }}>
                {message}
              </Alert>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default CobranzasPage;