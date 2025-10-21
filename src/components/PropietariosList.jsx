import React, { useState, useEffect } from 'react';
import { getUnidades } from '../services/propietariosService';
import { Link as RouterLink } from 'react-router-dom'; // <-- Importar Link

// --- IMPORTACIONES DE MUI ---
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, CircularProgress, Button, Box // <-- Añadir Button y Box
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'; // <-- Icono para Cta. Cte.
// --- FIN IMPORTACIONES MUI ---


function PropietariosList() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ordenamos por nombre directamente desde el servicio si es posible,
    // o aquí después de recibir los datos.
    const unsubscribe = getUnidades((unidadesNuevas) => {
       // Ordenamos aquí por si el servicio no lo hace (aunque ya lo hacía)
      unidadesNuevas.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setUnidades(unidadesNuevas);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (value) => { /* ... (sin cambios) ... */
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const formatPercent = (value) => { /* ... (sin cambios) ... */
      // Multiplica por 100 y muestra 4 decimales
    return (value * 100).toFixed(4) + ' %';
  };

  if (loading) {
    // return <p>Cargando lista de unidades...</p>; // <-- Mejorar estado de carga
     return (
      <Paper sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <CircularProgress />
        <Typography>Cargando lista de unidades...</Typography>
      </Paper>
    );
  }

  return (
    // Reemplazamos el div y table HTML con componentes MUI
    <Paper sx={{ p: 3, mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Unidades Cargadas
      </Typography>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="tabla de unidades">
          <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
            <TableRow>
              <TableCell>Unidad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell align="right">Porcentaje</TableCell>
              <TableCell align="right">Saldo Actual</TableCell>
              <TableCell align="center">Acciones</TableCell> {/* <-- Nueva Columna */}
            </TableRow>
          </TableHead>
          <TableBody>
            {unidades.map((unidad) => (
              <TableRow
                key={unidad.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">{unidad.nombre}</TableCell>
                <TableCell>{unidad.propietario}</TableCell>
                <TableCell align="right">
                  {formatPercent(unidad.porcentaje)}
                </TableCell>
                <TableCell align="right" sx={{ color: unidad.saldo < 0 ? 'red' : 'inherit' }}> {/* <-- Saldo en rojo si es negativo */}
                  {formatCurrency(unidad.saldo)}
                </TableCell>
                {/* Nueva Celda de Acciones */}
                <TableCell align="center">
                  <Button
                    component={RouterLink} // Usamos RouterLink para navegar
                    to={`/admin/cuenta-corriente/${unidad.id}`} // Enlace dinámico
                    variant="outlined"
                    size="small"
                    startIcon={<AccountBalanceWalletIcon />}
                  >
                    Cta. Cte.
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default PropietariosList;