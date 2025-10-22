import React, { useState, useEffect } from 'react';
import { getLiquidaciones } from '../../services/liquidacionService';
import { Link as RouterLink } from 'react-router-dom';

// --- IMPORTACIONES DE MUI ---
import {
  Box, Typography, Paper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Alert, Divider, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
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
        console.error("Error en getLiquidaciones:", err);
        setLiquidaciones([]);
      } else {
        setLiquidaciones(liquidacionesNuevas);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectLiquidacion = (liquidacion) => {
    console.log("Liquidación seleccionada para ver detalles:", liquidacion);
    // Verificar si detalleUnidades existe y es un array
    if (liquidacion && liquidacion.detalleUnidades && Array.isArray(liquidacion.detalleUnidades)) {
        console.log(` -> detalleUnidades tiene ${liquidacion.detalleUnidades.length} elementos.`);
    } else {
        console.warn(" -> La liquidación seleccionada NO tiene un array 'detalleUnidades' válido.");
    }
    setLiquidacionSeleccionada(liquidacion);
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A'; // Manejar NaN
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return 'Fecha desconocida';
    if (!(date instanceof Date)) {
        // Intentar convertir si es Timestamp (objeto con seconds)
        if (date && typeof date.seconds === 'number') {
            try {
                date = date.toDate();
            } catch (e) {
                console.error("Error convirtiendo timestamp a Date:", e);
                return 'Fecha inválida';
            }
        } else {
             console.warn("formatDate recibió algo que no es Date ni Timestamp:", date);
            return 'Fecha inválida';
        }
    }
    return date.toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // --- Componente Interno para Mostrar Detalles (CORREGIDO Y CON LOG) ---
  const DetalleLiquidacion = ({ liquidacion }) => {

    if (!liquidacion) {
      return (
         <Typography sx={{ color: 'text.secondary', textAlign: 'center', pt: 5 }}>
           Seleccione una liquidación de la lista para ver los detalles.
         </Typography>
      );
    }

    // Verifica si detalleUnidades existe Y es un array Y NO está vacío
    const tieneDetalles = liquidacion.detalleUnidades && Array.isArray(liquidacion.detalleUnidades) && liquidacion.detalleUnidades.length > 0;

    // --- CONSOLE LOG DETALLADO ---
    console.log("Renderizando DetalleLiquidacion:", liquidacion.nombre);
    console.log("  > ¿Tiene 'detalleUnidades'?", liquidacion.hasOwnProperty('detalleUnidades'));
    console.log("  > 'detalleUnidades' es array?", Array.isArray(liquidacion.detalleUnidades));
    if (Array.isArray(liquidacion.detalleUnidades)) {
        console.log("  > Longitud 'detalleUnidades':", liquidacion.detalleUnidades.length);
    }
    console.log("  > ¿Se mostrará la tabla (tieneDetalles)?", tieneDetalles);
    // --- FIN CONSOLE LOG ---

    const detalleOrdenado = tieneDetalles
       ? [...liquidacion.detalleUnidades].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
       : [];

    return (
      <Box>
        <Typography variant="h5" gutterBottom>Detalles de: {liquidacion.nombre || 'Liquidación sin nombre'}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>Generada el: {formatDate(liquidacion.fechaCreada)}</Typography>

        {/* Resumen de Totales */}
        <Paper variant="outlined" sx={{ p: 2, my: 2 }}>
           {/* ... (código del resumen sin cambios) ... */}
           <Typography variant="h6" gutterBottom>Resumen General</Typography>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>Total Gastos Ordinarios:</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.totalGastosOrdinarios ?? liquidacion.totalGastos)}</Typography>
           </Box>
           { (liquidacion.totalGastosExtraProrrateo ?? 0) > 0 && ( /* Más seguro con ?? 0 */
               <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>Total Gastos Extra (Prorrateo):</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.totalGastosExtraProrrateo)}</Typography>
               </Box>
           )}
           { (liquidacion.totalGastosExtraUnidades ?? 0) > 0 && (
               <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>Total Gastos Extra (Específicos):</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.totalGastosExtraUnidades)}</Typography>
               </Box>
           )}
           { (liquidacion.totalGastosExtraFondo ?? 0) > 0 && (
               <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>Total Gastos Extra (Fondo Reserva):</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.totalGastosExtraFondo)}</Typography>
               </Box>
           )}
           <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>(+) Fondo de Reserva (% Aplicado):</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.montoFondoReservaCalculado ?? liquidacion.montoFondo)}</Typography>
           </Box>
           <Divider sx={{ my: 1 }} />
           <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
               <Typography variant="subtitle1">Total a Prorratear General:</Typography>
               <Typography variant="subtitle1" fontWeight="bold">{formatCurrency(liquidacion.totalAProrratearGeneral ?? liquidacion.totalAProrratear)}</Typography>
           </Box>
           {(liquidacion.saldoFondoInicial !== undefined || liquidacion.saldoFondoFinal !== undefined) && (
               <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #eee' }}>
                   <Typography variant="body2" color="textSecondary">Saldo Fondo Reserva:</Typography>
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                       <span>Inicial: {formatCurrency(liquidacion.saldoFondoInicial)}</span>
                       <span>Final: {formatCurrency(liquidacion.saldoFondoFinal)}</span>
                   </Box>
               </Box>
           )}
        </Paper>

        {/* Tabla Detalle por Unidad (Snapshot) */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Detalle por Unidad (Snapshot)</Typography>
        {tieneDetalles ? (
          <>
            <TableContainer component={Paper}>
              <Table size="small" aria-label="detalle por unidad">
                <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
                  <TableRow>
                    <TableCell>Unidad</TableCell>
                    <TableCell>Propietario</TableCell>
                    <TableCell align="right">Saldo Ant.</TableCell> {/* Abreviado */}
                    <TableCell align="right">Monto Liq.</TableCell> {/* Abreviado */}
                    <TableCell align="right">Saldo Res.</TableCell> {/* Abreviado */}
                    <TableCell align="center">Cta. Cte.</TableCell> {/* Abreviado */}
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
                          sx={{ minWidth: 'auto', p: 0.5 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="textSecondary">
                    Gastos incluidos (IDs): {liquidacion.gastosIds?.join(', ') || 'Ninguno'}
                </Typography>
            </Box>
          </>
        ) : (
          <Typography sx={{ color: 'text.secondary', mt: 2 }}>
            No se encontró el detalle por unidad para esta liquidación (puede ser antigua o hubo un error al guardarlo).
          </Typography>
        )}
      </Box>
    );
  };
  // --- Fin Componente Interno ---

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Historial de Liquidaciones
      </Typography>
      <Grid container spacing={3}>
        {/* Columna Izquierda */}
        <Grid item xs={12} md={4}>
           {/* Limitamos altura y añadimos scroll */}
          <Paper sx={{ p: 2, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
            {/* Hacemos el título sticky */}
            <Typography variant="h6" gutterBottom sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, pb: 1 }}>
              Liquidaciones Generadas
            </Typography>
            {loading ? ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
            ) : error ? ( <Alert severity="error">{error}</Alert>
            ) : liquidaciones.length === 0 ? ( <Typography sx={{mt:2}}>No hay liquidaciones registradas.</Typography>
            ) : (
              <List dense sx={{ pt: 0 }}> {/* Quitamos padding top */}
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
                     {/* Usar variant="middle" para que no toque los bordes */}
                    {index < liquidaciones.length - 1 && <Divider component="li" variant="middle" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        {/* Columna Derecha */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, minHeight: '300px' }}> {/* Aumentado padding */}
            <DetalleLiquidacion liquidacion={liquidacionSeleccionada} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default HistorialLiquidacionesPage;