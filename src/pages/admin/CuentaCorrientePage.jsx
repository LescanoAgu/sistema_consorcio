import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; // Importa useParams para leer la URL
import { getCuentaCorriente } from '../../services/propietariosService';

// --- IMPORTACIONES DE MUI ---
import {
  Box, Typography, Paper, Table, TableBody, TableCell, Link,
  TableContainer, TableHead, TableRow, CircularProgress, Alert, Button
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description'; // Icono para el cupón
// --- FIN IMPORTACIONES MUI ---

function CuentaCorrientePage() {
  // Obtenemos el 'unidadId' de los parámetros de la URL (definido en App.jsx)
  const { unidadId } = useParams();

  const [unidad, setUnidad] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!unidadId) {
      setError("No se especificó un ID de unidad.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    // Nos suscribimos a los datos de la cuenta corriente
    const unsubscribe = getCuentaCorriente(unidadId, (data, err) => {
      if (err) {
        setError(err.message || 'Error al cargar la cuenta corriente.');
        setUnidad(null);
        setMovimientos([]);
        console.error(err);
      } else if (data) {
        setUnidad(data.unidad);
        setMovimientos(data.movimientos);
      }
      setLoading(false);
    });

    // Nos desuscribimos al desmontar
    return () => unsubscribe();

  }, [unidadId]); // El efecto se re-ejecuta si cambia el unidadId

  // --- Funciones de Formato ---
  const formatCurrency = (value) => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return '';
    // Formato dd/mm/aaaa
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  // --- Fin Funciones de Formato ---

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!unidad) {
    // Esto podría pasar si el ID es inválido y getCuentaCorriente llamó al callback con null
    return <Alert severity="warning">No se encontró la unidad especificada.</Alert>;
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Cuenta Corriente
      </Typography>

      {/* Datos de la Unidad */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f0f0f0' }}>
        <Typography variant="h6">{unidad.nombre}</Typography>
        <Typography variant="body1">Propietario: {unidad.propietario}</Typography>
        <Typography variant="h5" sx={{ mt: 1, color: unidad.saldo < 0 ? 'red' : 'green', fontWeight: 'bold' }}>
          Saldo Actual: {formatCurrency(unidad.saldo)}
        </Typography>
      </Paper>

      {/* Tabla de Movimientos */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Historial de Movimientos</Typography>
        <TableContainer>
          <Table stickyHeader sx={{ minWidth: 650 }} aria-label="tabla de cuenta corriente">
            <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Concepto</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell align="right">Saldo Resultante</TableCell>
                <TableCell align="center">Cupón PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay movimientos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                movimientos.map((mov) => (
                  <TableRow
                    key={mov.id}
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      // Fondo ligeramente distinto para débitos y créditos
                      backgroundColor: mov.monto < 0 ? '#fff0f0' : '#f0fff0'
                     }}
                  >
                    <TableCell>{formatDate(mov.fecha)}</TableCell>
                    <TableCell>{mov.concepto}</TableCell>
                    <TableCell align="right" sx={{ color: mov.monto < 0 ? 'red' : 'green', fontWeight: '500' }}>
                      {formatCurrency(mov.monto)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(mov.saldoResultante)}
                    </TableCell>
                    <TableCell align="center">
                      {/* Mostramos el link al cupón si existe la URL */}
                      {mov.cuponURL ? (
                        <Button
                          variant="outlined"
                          size="small"
                          href={mov.cuponURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<DescriptionIcon />}
                        >
                          Ver
                        </Button>
                      ) : (
                        '-' // O un guion si no hay cupón para ese movimiento
                      )}
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

export default CuentaCorrientePage;