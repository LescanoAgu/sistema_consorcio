// src/pages/admin/HistorialLiquidacionesPage.jsx
import React, { useState, useEffect } from 'react';
import { getLiquidaciones } from '../../services/liquidacionService';
import { useConsorcio } from '../../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK
import { Link as RouterLink } from 'react-router-dom';
import { naturalSort } from '../../utils/helpers';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Box, Typography, Paper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Alert, Divider, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';

function HistorialLiquidacionesPage() {
  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER CONSORCIO ACTIVO
  
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liquidacionSeleccionada, setLiquidacionSeleccionada] = useState(null);

  useEffect(() => {
    // 3. VALIDAR CONSORCIO
    if (!consorcioId) {
        setLoading(false);
        setLiquidaciones([]);
        setLiquidacionSeleccionada(null); // Limpiar selección si cambia el consorcio
        return;
    }
    
    setLoading(true);
    setError('');
    
    // 4. PASAR consorcioId AL SERVICIO
    const unsubscribe = getLiquidaciones(consorcioId, (liquidacionesNuevas, err) => {
      if (err) {
        setError('Error al cargar el historial de liquidaciones.');
        console.error("Error en getLiquidaciones:", err);
        setLiquidaciones([]);
      } else {
        setLiquidaciones(liquidacionesNuevas);
        // Si el consorcio cambió, limpiamos la selección
        setLiquidacionSeleccionada(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
    
  }, [consorcioId]); // <-- 5. AGREGAR consorcioId A DEPENDENCIAS

  const handleSelectLiquidacion = (liquidacion) => {
    setLiquidacionSeleccionada(liquidacion);
  };
  
  // ... (formatCurrency y formatDate no cambian) ...
  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };
  const formatDate = (date) => {
    if (!date) return 'Fecha desconocida';
    if (!(date instanceof Date)) {
        if (date && typeof date.seconds === 'number') {
            try { date = date.toDate(); } catch (e) { return 'Fecha inválida'; }
        } else { return 'Fecha inválida'; }
    }
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };


  // --- Componente Interno para Mostrar Detalles (MODIFICADO) ---
  // 6. PASAR consorcioId AL COMPONENTE INTERNO (para el ZIP)
  const DetalleLiquidacion = ({ liquidacion, consorcioId }) => {
    const [zipLoading, setZipLoading] = useState(false);

    const handleDownloadZip = async () => {
      // 7. VALIDAR consorcioId aquí también
      if (!tieneDetalles || !consorcioId) {
          setError("No se puede generar ZIP sin consorcio o sin detalles.");
          return;
      }
      setZipLoading(true);

      try {
        const zip = new JSZip();
        const safeLiquidacionNombre = (liquidacion.nombre || 'Liquidacion').replace(/[^a-z0-9]/gi, '_');

        const promises = detalleOrdenado.map(detalle => {
          if (!detalle.cuponURL) return Promise.resolve(null);
          
          // Usamos 'fetch' que es nativo del navegador
          return fetch(detalle.cuponURL) 
            .then(response => {
              if (!response.ok) {
                throw new Error(`Error al descargar ${detalle.nombre}: ${response.statusText}`);
              }
              return response.blob();
            })
            .then(blob => {
              const safeUnidadNombre = (detalle.nombre || 'unidad').replace(/[^a-z0-9]/gi, '_');
              const fileName = `expensa_${safeUnidadNombre}.pdf`;
              zip.file(fileName, blob);
            })
            .catch(err => {
              console.error(`Error procesando PDF para ${detalle.nombre}:`, err);
              const safeUnidadNombre = (detalle.nombre || 'unidad_error').replace(/[^a-z0-9]/gi, '_');
              zip.file(`ERROR_${safeUnidadNombre}.txt`, `No se pudo descargar el PDF: ${err.message}`);
            });
        });

        await Promise.all(promises);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `Liquidacion_${safeLiquidacionNombre}_Cupones.zip`);

      } catch (error) {
        console.error("Error al generar el ZIP:", error);
        setError(`Error al generar ZIP: ${error.message}`); // Mostrar error en la UI
      } finally {
        setZipLoading(false);
      }
    };
    // --- FIN LÓGICA ZIP ---

    if (!liquidacion) {
      return (
         <Typography sx={{ color: 'text.secondary', textAlign: 'center', pt: 5 }}>
           Seleccione una liquidación de la lista para ver los detalles.
         </Typography>
      );
    }

    const tieneDetalles = liquidacion.detalleUnidades && Array.isArray(liquidacion.detalleUnidades) && liquidacion.detalleUnidades.length > 0;
    const detalleOrdenado = tieneDetalles
       ? [...liquidacion.detalleUnidades].sort((a, b) => naturalSort(a, b, 'nombre'))
       : [];

    return (
      <Box>
        <Typography variant="h5" gutterBottom>Detalles de: {liquidacion.nombre || 'Liquidación sin nombre'}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>Generada el: {formatDate(liquidacion.fechaCreada)}</Typography>

        {/* Resumen de Totales */}
        <Paper variant="outlined" sx={{ p: 2, my: 2 }}>
           <Typography variant="h6" gutterBottom>Resumen General</Typography>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>Total Gastos Ordinarios:</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.totalGastosOrdinarios ?? liquidacion.totalGastos)}</Typography>
           </Box>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
               <Typography>(+) Fondo de Reserva:</Typography>
               <Typography fontWeight="bold">{formatCurrency(liquidacion.montoFondoReservaCalculado ?? liquidacion.montoFondo)}</Typography>
           </Box>
           <Divider sx={{ my: 1 }} />
           <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
               <Typography variant="subtitle1">Total a Prorratear:</Typography>
               <Typography variant="subtitle1" fontWeight="bold">{formatCurrency(liquidacion.totalAProrratearGeneral ?? liquidacion.totalAProrratear)}</Typography>
           </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 1 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
            Detalle por Unidad (Snapshot)
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            startIcon={zipLoading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
            disabled={!tieneDetalles || zipLoading || !consorcioId} // 8. Deshabilitar si no hay consorcioId
            onClick={handleDownloadZip}
          >
            {zipLoading ? 'Generando ZIP...' : 'Descargar Todos (ZIP)'}
          </Button>
        </Box>

        {/* Tabla Detalle por Unidad (Snapshot) */}
        {tieneDetalles ? (
          <>
            <TableContainer component={Paper}>
              <Table size="small" aria-label="detalle por unidad">
                <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
                  <TableRow>
                    <TableCell>Unidad</TableCell>
                    <TableCell>Propietario</TableCell>
                    <TableCell align="right">Saldo Ant.</TableCell>
                    <TableCell align="right">Monto Liq.</TableCell>
                    <TableCell align="right">Saldo Res.</TableCell>
                    <TableCell align="center">Cta. Cte.</TableCell>
                    <TableCell align="center">Cupón PDF</TableCell>
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
                      <TableCell align="center">
                        {detalle.cuponURL ? (
                          <Button
                            variant="outlined"
                            size="small"
                            href={detalle.cuponURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<DescriptionIcon />}
                            sx={{ minWidth: 'auto', px: 1 }}
                            title="Descargar cupón PDF"
                          >
                            Ver
                          </Button>
                        ) : (
                          <Typography variant="caption" color="textSecondary">-</Typography>
                        )}
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
            No se encontró el detalle por unidad para esta liquidación.
          </Typography>
        )}
      </Box>
    );
  };

  // --- Render principal de la página ---
  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Historial de Liquidaciones
      </Typography>
      
      {/* 9. Mensaje si no hay consorcio */}
      {!consorcioId && (
          <Alert severity="warning">Seleccione un consorcio para ver el historial.</Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Columna Izquierda */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, pb: 1 }}>
              Liquidaciones Generadas
            </Typography>
            {loading ? ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
            ) : error ? ( <Alert severity="error">{error}</Alert>
            ) : liquidaciones.length === 0 ? ( <Typography sx={{mt:2}}>
                {consorcioId ? 'No hay liquidaciones registradas para este consorcio.' : 'Seleccione un consorcio.'}
                </Typography>
            ) : (
              <List dense sx={{ pt: 0 }}>
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
                    {index < liquidaciones.length - 1 && <Divider component="li" variant="middle" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        {/* Columna Derecha */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, minHeight: '300px' }}>
            {/* 10. PASAR consorcioId AL DETALLE */}
            <DetalleLiquidacion 
              liquidacion={liquidacionSeleccionada} 
              consorcioId={consorcioId} 
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default HistorialLiquidacionesPage;