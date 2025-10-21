import React, { useState, useEffect } from 'react';
import { getGastos, deleteGasto } from '../services/gastosService';

// --- IMPORTACIONES DE MUI ---
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, Box, IconButton, CircularProgress,
  ButtonGroup
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
// --- FIN IMPORTACIONES MUI ---

function GastosList({ onEdit }) {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendientes');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsubscribe = getGastos((gastosNuevos, err) => {
      if (err) {
        setError("Error al cargar los gastos.");
        console.error(err);
      } else {
        setGastos(gastosNuevos);
      }
      setLoading(false);
    }, filtro);
    return () => unsubscribe();
  }, [filtro]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleDelete = async (gasto) => {
    if (window.confirm(`¿Está seguro de eliminar el gasto "${gasto.concepto}" por ${formatCurrency(gasto.monto)}? Esta acción no se puede deshacer.`)) {
      try {
        setLoading(true);
        setError('');
        await deleteGasto(gasto.id, gasto.facturaURL);
      } catch (err) {
        setError(`Error al eliminar: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Gastos Cargados
        </Typography>
        <ButtonGroup variant="outlined" aria-label="Filtro de gastos">
          <Button onClick={() => setFiltro('pendientes')} variant={filtro === 'pendientes' ? 'contained' : 'outlined'}>Pendientes</Button>
          <Button onClick={() => setFiltro('todos')} variant={filtro === 'todos' ? 'contained' : 'outlined'}>Todos</Button>
        </ButtonGroup>
      </Box>

      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

      <TableContainer>
        {/* Asegúrate de que no haya espacios entre estas etiquetas */}
        <Table sx={{ minWidth: 750 }} aria-label="tabla de gastos">
          <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Concepto</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell align="center">Factura</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : gastos.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={7} align="center">
                   No hay gastos para mostrar con el filtro actual.
                 </TableCell>
               </TableRow>
            ) : (
              gastos.map((gasto) => (
                <TableRow
                  key={gasto.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>{gasto.fecha}</TableCell>
                  <TableCell>{gasto.concepto}</TableCell>
                  <TableCell>{gasto.proveedor}</TableCell>
                  <TableCell align="right">{formatCurrency(gasto.monto)}</TableCell>
                  <TableCell align="center">
                    {gasto.facturaURL ? (
                      <Button
                        variant="outlined"
                        size="small"
                        href={gasto.facturaURL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver PDF
                      </Button>
                    ) : (
                      <Typography variant="caption" color="textSecondary">Sin PDF</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {gasto.liquidacionId ? (
                      <Typography variant="caption" sx={{ color: 'green', fontWeight: 'bold' }}>Liquidado ({gasto.liquidadoEn})</Typography>
                    ) : (
                      <Typography variant="caption" color="textSecondary">Pendiente</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      aria-label="editar"
                      size="small"
                      onClick={() => onEdit(gasto)}
                      disabled={!!gasto.liquidacionId || loading}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label="eliminar"
                      size="small"
                      color="error"
                      onClick={() => handleDelete(gasto)}
                      disabled={!!gasto.liquidacionId || loading}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default GastosList;