// src/components/PropietariosList.jsx
import React, { useState, useEffect } from 'react';
import { getUnidades } from '../services/propietariosService';
import { Link as RouterLink } from 'react-router-dom';
import { naturalSort } from '../utils/helpers';

// --- IMPORTACIONES DE MUI ---
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, CircularProgress, Button, Box
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
// --- FIN IMPORTACIONES MUI ---

  function PropietariosList() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = getUnidades((unidadesNuevas, err) => {
        if (err) {
            console.error("Error al obtener unidades:", err);
        } else {
             // <-- Usar naturalSort -->
             unidadesNuevas.sort((a, b) => naturalSort(a.nombre, b.nombre));
             setUnidades(unidadesNuevas);
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const formatPercent = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return (value * 100).toFixed(4) + ' %';
  };

  if (loading) {
     return (
      <Paper sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <CircularProgress />
        <Typography>Cargando lista de unidades...</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Unidades Cargadas
      </Typography>
      <TableContainer>
        {/* SIN ESPACIOS ENTRE ESTAS ETIQUETAS */}
        <Table sx={{ minWidth: 650 }} aria-label="tabla de unidades">
          <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
            <TableRow>
              <TableCell>Unidad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell align="right">Porcentaje</TableCell>
              <TableCell align="right">Saldo Actual</TableCell>
              <TableCell align="center">Acciones</TableCell>
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
                <TableCell align="right">{formatPercent(unidad.porcentaje)}</TableCell>
                <TableCell align="right" sx={{ color: unidad.saldo < 0 ? 'error.main' : 'inherit', fontWeight: unidad.saldo < 0 ? 'bold' : 'normal' }}> {/* Usar color de tema */}
                  {formatCurrency(unidad.saldo)}
                </TableCell>
                <TableCell align="center">
                  <Button
                    component={RouterLink}
                    to={`/admin/cuenta-corriente/${unidad.id}`}
                    variant="outlined"
                    size="small"
                    startIcon={<AccountBalanceWalletIcon />}
                    sx={{ minWidth: 'auto', px: 1 }} // Más compacto
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