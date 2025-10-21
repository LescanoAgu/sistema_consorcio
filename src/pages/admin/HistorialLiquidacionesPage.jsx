import React, { useState, useEffect } from 'react';
import { getLiquidaciones } from '../../services/liquidacionService'; // Importamos el nuevo servicio

// --- IMPORTACIONES DE MUI ---
import {
  Box, Typography, Paper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Alert, Divider
} from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

function HistorialLiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Estado para guardar la liquidación seleccionada (lo usaremos después)
  const [liquidacionSeleccionada, setLiquidacionSeleccionada] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsubscribe = getLiquidaciones((liquidacionesNuevas, err) => {
      if (err) {
        setError('Error al cargar el historial de liquidaciones.');
        console.error(err);
        setLiquidaciones([]);
      } else {
        setLiquidaciones(liquidacionesNuevas);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectLiquidacion = (liquidacion) => {
    // Por ahora, solo la guardamos en el estado. Luego mostraremos detalles.
    console.log("Liquidación seleccionada:", liquidacion);
    setLiquidacionSeleccionada(liquidacion);
    // TODO: Mostrar detalles de la liquidación seleccionada
  };

  // Función para formatear fechas (puedes moverla a un utils si la usas mucho)
  const formatDate = (date) => {
    if (!date) return 'Fecha desconocida';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' // Opcional: mostrar hora
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Historial de Liquidaciones
      </Typography>

      <Grid container spacing={3}> {/* Usaremos Grid para dividir la pantalla */}

        {/* Columna Izquierda: Lista de Liquidaciones */}
        <Grid item xs={12} md={4}> {/* Ocupa 4 de 12 columnas en pantallas medianas o más grandes */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Liquidaciones Generadas</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : liquidaciones.length === 0 ? (
              <Typography>No hay liquidaciones registradas.</Typography>
            ) : (
              <List dense> {/* `dense` hace los items un poco más compactos */}
                {liquidaciones.map((liq, index) => (
                  <React.Fragment key={liq.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={liquidacionSeleccionada?.id === liq.id} // Resalta la seleccionada
                        onClick={() => handleSelectLiquidacion(liq)}
                      >
                        <ListItemText
                          primary={liq.nombre || 'Sin Nombre'}
                          secondary={`Generada: ${formatDate(liq.fechaCreada)}`}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < liquidaciones.length - 1 && <Divider component="li" />} {/* Separador */}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Columna Derecha: Detalles de la Liquidación Seleccionada */}
        <Grid item xs={12} md={8}> {/* Ocupa 8 de 12 columnas */}
          <Paper sx={{ p: 2, minHeight: '300px' }}> {/* Altura mínima para que no colapse */}
            {liquidacionSeleccionada ? (
              <Typography variant="h6">Detalles de: {liquidacionSeleccionada.nombre}</Typography>
              // AQUÍ MOSTRAREMOS LOS DETALLES EN EL SIGUIENTE PASO
              // - Totales
              // - Lista de gastos
              // - Tabla con detalleUnidades (snapshot)
              // - Botones para descargar PDFs
            ) : (
              <Typography sx={{ color: 'text.secondary', textAlign: 'center', pt: 5 }}>
                Seleccione una liquidación de la lista para ver los detalles.
              </Typography>
            )}
          </Paper>
        </Grid>

      </Grid> {/* Fin del Grid container */}
    </Box>
  );
}

// ¡No olvides importar Grid al inicio!
import { Grid } from '@mui/material'; // <-- Asegúrate de tener esta importación

export default HistorialLiquidacionesPage;