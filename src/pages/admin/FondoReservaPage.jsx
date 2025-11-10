// src/pages/admin/FondoReservaPage.jsx
import React, { useState, useEffect } from 'react';
import { getHistorialFondo } from '../../services/fondoService';
import { getSaldoFondoActual } from '../../services/propietariosService'; // Necesitamos crear esta función
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Button,
  Link // <-- ¡AÑADIR ESTA LÍNEA QUE FALTABA!
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { Link as RouterLink } from 'react-router-dom';

// Función de formato (podríamos moverla a helpers.js)
const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

function FondoReservaPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [saldoActual, setSaldoActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cargar saldo actual
  useEffect(() => {
    const unsubscribeSaldo = getSaldoFondoActual((saldo, err) => {
      if (err) {
        setError('Error al cargar el saldo actual del fondo.');
      } else {
        setSaldoActual(saldo);
      }
    });
    return () => unsubscribeSaldo();
  }, []);

  // Cargar historial
  useEffect(() => {
    setLoading(true);
    const unsubscribeHistorial = getHistorialFondo((historial, err) => {
      if (err) {
        setError('Error al cargar el historial de movimientos.');
      } else {
        setMovimientos(historial);
      }
      setLoading(false);
    });
    return () => unsubscribeHistorial();
  }, []);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ... (Títulos y Saldo Actual) */}
      
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Historial de Movimientos</Typography>
        <TableContainer>
          <Table stickyHeader sx={{ minWidth: 650 }} aria-label="historial fondo reserva">
            <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
              {/* ... (Cabecera de la tabla sin cambios) */}
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Concepto</TableCell>
                <TableCell>Referencia (Liq/Gasto ID)</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell align="right">Saldo Resultante</TableCell>
              </TableRow>
            </TableHead>

            {/* --- TableBody CORREGIDO --- */}
<TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : movimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No hay movimientos registrados.</TableCell>
                </TableRow>
              ) : (
                movimientos.map((mov) => (
                  <TableRow
                    key={mov.id}
                    sx={{ backgroundColor: mov.monto < 0 ? '#fff0f0' : '#f0fff0' }}
                  >
                    <TableCell>{formatDate(mov.fecha)}</TableCell>
                    <TableCell>{mov.concepto}</TableCell>
                    
                    {/* --- CELDA CORREGIDA CON PRIORIDAD --- */}
                    <TableCell>
                      {/* Prioridad 1: Si es Gasto y TIENE facturaURL */}
                      {mov.gastoId && mov.facturaURL ? (
                        <Button
                          variant="outlined"
                          size="small"
                          href={mov.facturaURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<DescriptionIcon />}
                          sx={{ minWidth: 'auto', px: 1 }}
                          title="Ver Factura del Gasto"
                        >
                          Ver PDF
                        </Button>
                      
                      // Prioridad 2: Si es Gasto pero NO tiene facturaURL (link a gastos)
                      ) : mov.gastoId ? (
                        <Link component={RouterLink} to={`/admin/liquidacion/gastos`} title={mov.gastoId} sx={{fontSize: '0.875rem'}}>
                          Ver Gasto
                        </Link>

                      // Prioridad 3: Si es Liquidación (link a historial)
                      ) : mov.liquidacionId ? (
                        <Link component={RouterLink} to={`/admin/liquidacion/historial`} title={mov.liquidacionId} sx={{fontSize: '0.875rem'}}>
                          Ver Liq.
                        </Link>

                      // Prioridad 4: Sin referencia
                      ) : (
                        '-' 
                      )}
                    </TableCell>
                    {/* --- FIN CELDA CORREGIDA --- */}

                    <TableCell align="right" sx={{ color: mov.monto < 0 ? 'red' : 'green', fontWeight: '500' }}>
                      {formatCurrency(mov.monto)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(mov.saldoResultante)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {/* --- FIN TableBody CORREGIDO --- */}

          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default FondoReservaPage;