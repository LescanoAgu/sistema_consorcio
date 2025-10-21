import React, { useState, useEffect } from 'react';
import { getTodasUnidades, registrarPago } from '../../services/propietariosService'; // Importaremos registrarPago luego

// --- IMPORTACIONES DE MUI ---
import {
  Box, Button, TextField, Typography, Paper, Alert, CircularProgress, Grid,
  Autocomplete // <-- Nuevo componente para el selector de unidades
} from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

function CobranzasPage() {
  // Estado para la lista de unidades (para el selector)
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);

  // Estado del formulario
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null); // Guardará el objeto unidad completo
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]); // Fecha de hoy por defecto
  const [concepto, setConcepto] = useState('');

  // Estado general
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Cargar unidades al montar el componente
  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        const unidadesObtenidas = await getTodasUnidades();
        // Ordenamos alfabéticamente por nombre para el selector
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

      // Llamamos al servicio (lo crearemos en el siguiente paso)
      await registrarPago(unidadSeleccionada.id, montoFloat, fecha, concepto || `Pago ${unidadSeleccionada.nombre}`);

      setMessage(`¡Pago de ${montoFloat} registrado exitosamente para ${unidadSeleccionada.nombre}!`);
      // Limpiar formulario
      setUnidadSeleccionada(null);
      setMonto('');
      // setFecha(new Date().toISOString().split('T')[0]); // Opcional: resetear fecha
      setConcepto('');

    } catch (error) {
      setMessage(`Error al registrar el pago: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
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
            <Grid container spacing={3}>
              {/* Selector de Unidad */}
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={unidades}
                  getOptionLabel={(option) => `${option.nombre} (${option.propietario})`} // Muestra nombre y propietario
                  value={unidadSeleccionada}
                  onChange={(event, newValue) => {
                    setUnidadSeleccionada(newValue);
                  }}
                  isOptionEqualToValue={(option, value) => option.id === value.id} // Necesario para comparar objetos
                  renderInput={(params) => (
                    <TextField {...params} label="Seleccionar Unidad" required />
                  )}
                  disabled={loading}
                />
              </Grid>

              {/* Monto */}
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Monto Pagado"
                  type="number"
                  fullWidth
                  placeholder="Ej: 25000.50"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  InputProps={{ inputProps: { step: '0.01' } }} // Permite decimales
                  disabled={loading}
                />
              </Grid>

              {/* Fecha */}
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Fecha del Pago"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  disabled={loading}
                />
              </Grid>

              {/* Concepto (Opcional) */}
              <Grid item xs={12} sm={9}>
                <TextField
                  label="Concepto / Referencia (Opcional)"
                  fullWidth
                  placeholder="Ej: Pago Expensa Octubre, Transferencia Banco X"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  disabled={loading}
                />
              </Grid>

              {/* Botón Guardar */}
              <Grid item xs={12} sm={3}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !unidadSeleccionada} // Deshabilitado si no hay unidad o está cargando
                  sx={{ height: '100%' }} // Misma altura que TextField
                >
                  {loading ? <CircularProgress size={24} /> : 'Registrar Pago'}
                </Button>
              </Grid>
            </Grid>

            {/* Mensaje de éxito o error */}
            {message && (
              <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 3 }}>
                {message}
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Aquí podríamos agregar una lista de los últimos pagos registrados si quisiéramos */}

    </Box>
  );
}

export default CobranzasPage;