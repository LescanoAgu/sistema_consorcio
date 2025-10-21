import React, { useState, useEffect } from 'react';
import { getLiquidaciones } from '../../services/liquidacionService';
import { Link as RouterLink } from 'react-router-dom'; // Importar Link para enlaces

// --- IMPORTACIONES DE MUI ---
import {
  Box, Typography, Paper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Alert, Divider, Grid, // Asegúrate de tener Grid
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button // Para la tabla de detalles
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'; // Icono para enlace Cta Cte
// --- FIN IMPORTACIONES MUI ---

function HistorialLiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    setLiquidacionSeleccionada(liquidacion);
  };

  // --- Funciones de Formato (Mover a utils si se repiten mucho) ---
  const formatCurrency = (value) => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return 'Fecha desconocida';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };
  // --- Fin Funciones de Formato ---


  // --- Componente Interno para Mostrar Detalles ---
const DetalleLiquidacion = ({ liquidacion }) => {
  // Asegúrate de tener estas importaciones al inicio del archivo principal o aquí si prefieres
  // import { Link as RouterLink } from 'react-router-dom';
  // import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Paper, Divider, Box, Typography } from '@mui/material';
  // import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

  if (!liquidacion) {
    return (
      <Typography sx={{ color: 'text.secondary', textAlign: 'center', pt: 5 }}>
        Seleccione una liquidación de la lista para ver los detalles.
      </Typography>
    );
  }

  // Verificamos si existe detalleUnidades antes de intentar ordenarlo
  const detalleOrdenado = liquidacion.detalleUnidades
    ? [...liquidacion.detalleUnidades].sort((a, b) => a.nombre.localeCompare(b.nombre))
    : [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Detalles de: {liquidacion.nombre}</Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>Generada el: {formatDate(liquidacion.fechaCreada)}</Typography>

      {/* --- INICIO DEL CÓDIGO A AGREGAR --- */}

      {/* Resumen de Totales */}
      <Paper variant="outlined" sx={{ p: 2, my: 2 }}>
        <Typography variant="h6" gutterBottom>Resumen General</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography>Total Gastos Ordinarios:</Typography>
          <Typography fontWeight="bold">{formatCurrency(liquidacion.totalGastos)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography>(+) Fondo de Reserva:</Typography>
          <Typography fontWeight="bold">{formatCurrency(liquidacion.montoFondo)}</Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Total a Prorratear:</Typography>
          <Typography variant="h6" fontWeight="bold">{formatCurrency(liquidacion.totalAProrratear)}</Typography>
        </Box>
      </Paper>

      {/* Tabla Detalle por Unidad (Snapshot) */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Detalle por Unidad (Snapshot)</Typography>
      {detalleOrdenado.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small" aria-label="detalle por unidad">
            <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableRow>
                <TableCell>Unidad</TableCell>
                <TableCell>Propietario</TableCell>
                <TableCell align="right">Saldo Anterior</TableCell>
                <TableCell align="right">Monto Liquidado</TableCell>
                <TableCell align="right">Saldo Resultante</TableCell>
                <TableCell align="center">Ver Cta. Cte.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detalleOrdenado.map((detalle) => (
                <TableRow key={detalle.unidadId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>{detalle.nombre}</TableCell>
                  <TableCell>{detalle.propietario}</TableCell>
                  <TableCell align="right">{formatCurrency(detalle.saldoAnterior)}</TableCell>
                  <TableCell align="right" sx={{ color: 'red' }}>
                    {formatCurrency(detalle.montoLiquidado)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(detalle.saldoResultante)}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      component={RouterLink}
                      to={`/admin/cuenta-corriente/${detalle.unidadId}`}
                      size="small"
                      startIcon={<AccountBalanceWalletIcon />}
                      title="Ver Cuenta Corriente Completa"
                    />
                     {/* Quitamos el texto para que solo quede el icono */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography sx={{ color: 'text.secondary', mt: 2 }}>
          No se encontró el detalle por unidad para esta liquidación (puede ser una liquidación antigua sin snapshot).
        </Typography>
      )}

      {/* Lista de IDs de Gastos (Opcional, informativo) */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" color="textSecondary">
          Gastos incluidos (IDs): {liquidacion.gastosIds?.join(', ') || 'Ninguno'}
        </Typography>
      </Box>

      {/* --- FIN DEL CÓDIGO A AGREGAR --- */}

    </Box>
  );
};


  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Historial de Liquidaciones
      </Typography>

      <Grid container spacing={3}>
        {/* Columna Izquierda: Lista de Liquidaciones (sin cambios) */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Liquidaciones Generadas</Typography>
            {loading ? ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
            ) : error ? ( <Alert severity="error">{error}</Alert>
            ) : liquidaciones.length === 0 ? ( <Typography>No hay liquidaciones registradas.</Typography>
            ) : (
              <List dense>
                {liquidaciones.map((liq, index) => (
                  <React.Fragment key={liq.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={liquidacionSeleccionada?.id === liq.id}
                        onClick={() => handleSelectLiquidacion(liq)}
                      >
                        <ListItemText
                          primary={liq.nombre || 'Sin Nombre'}
                          secondary={`Generada: ${formatDate(liq.fechaCreada)}`}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < liquidaciones.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Columna Derecha: Detalles de la Liquidación Seleccionada */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, minHeight: '300px' }}>
            {/* Usamos el componente interno DetalleLiquidacion */}
            <DetalleLiquidacion liquidacion={liquidacionSeleccionada} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default HistorialLiquidacionesPage;