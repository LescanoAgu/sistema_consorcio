// src/pages/admin/FondoReservaPage.jsx
import React, { useState, useEffect } from 'react';
import { getHistorialFondo } from '../../services/fondoService';
import { getSaldoFondoActual } from '../../services/propietariosService';
import { useConsorcio } from '../../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Button,
  Link
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { Link as RouterLink } from 'react-router-dom';

// ... (funciones de formato no cambian) ...
const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};
const formatDate = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};


function FondoReservaPage() {
  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER CONSORCIO ACTIVO
  
  const [movimientos, setMovimientos] = useState([]);
  const [saldoActual, setSaldoActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cargar saldo actual
  useEffect(() => {
    // 3. VALIDAR CONSORCIO
    if (!consorcioId) {
      setLoading(false);
      setSaldoActual(0);
      return;
    }
    
    // 4. PASAR consorcioId AL SERVICIO
    const unsubscribeSaldo = getSaldoFondoActual(consorcioId, (saldo, err) => {
      if (err) {
        setError('Error al cargar el saldo actual del fondo.');
      } else {
        setSaldoActual(saldo);
      }
    });
    return () => unsubscribeSaldo();
    
  }, [consorcioId]); // <-- 5. AGREGAR consorcioId A DEPENDENCIAS

  // Cargar historial
  useEffect(() => {
    // 3. VALIDAR CONSORCIO
    if (!consorcioId) {
      setLoading(false);
      setMovimientos([]);
      return;
    }

    setLoading(true);
    
    // 4. PASAR consorcioId AL SERVICIO
    const unsubscribeHistorial = getHistorialFondo(consorcioId, (historial, err) => {
      if (err) {
        setError('Error al cargar el historial de movimientos.');
      } else {
        setMovimientos(historial);
      }
      setLoading(false);
    });
    return () => unsubscribeHistorial();
    
  }, [consorcioId]); // <-- 5. AGREGAR consorcioId A DEPENDENCIAS
  
  
  // 6. Mensaje si no hay consorcio
  if (!consorcioId) {
     return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h4" gutterBottom>Fondo de Reserva</Typography>
            <Alert severity="warning">
                Por favor, seleccione un consorcio desde el menú superior para ver el fondo de reserva.
            </Alert>
        </Box>
     );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Títulos y Saldo Actual */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Fondo de Reserva
          </Typography>
      </Box>
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f0f4f8' }}>
        <Typography variant="h6">Saldo Actual del Fondo</Typography>
        <Typography variant="h4" sx={{ mt: 1, color: saldoActual < 0 ? 'red' : 'green', fontWeight: 'bold' }}>
          {formatCurrency(saldoActual)}
        </Typography>
        {loading && <CircularProgress size={20} sx={{mt: 1}} />}
        {error && <Alert severity="error" sx={{mt: 1}}>{error}</Alert>}
      </Paper>
      
      {/* Historial de Movimientos */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Historial de Movimientos</Typography>
        <TableContainer>
          <Table stickyHeader sx={{ minWidth: 650 }} aria-label="historial fondo reserva">
            <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Concepto</TableCell>
                <TableCell>Referencia (Liq/Gasto ID)</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell align="right">Saldo Resultante</TableCell>
              </TableRow>
            </TableHead>

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
                    
                    <TableCell>
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
                      
                      ) : mov.gastoId ? (
                        <Link component={RouterLink} to={`/admin/liquidacion/gastos`} title={mov.gastoId} sx={{fontSize: '0.875rem'}}>
                          Ver Gasto
                        </Link>

                      ) : mov.liquidacionId ? (
                        <Link component={RouterLink} to={`/admin/liquidacion/historial`} title={mov.liquidacionId} sx={{fontSize: '0.875rem'}}>
                          Ver Liq.
                        </Link>

                      ) : (
                        '-' 
                      )}
                    </TableCell>

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

          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default FondoReservaPage;