import React, { useState, useEffect } from 'react';
import { getGastos, deleteGasto } from '../services/gastosService';
import { useConsorcio } from '../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK

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
  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER CONSORCIO ACTIVO
  
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendientes');
  const [error, setError] = useState('');

  useEffect(() => {
    // 3. VALIDAR CONSORCIO
    if (!consorcioId) {
      setLoading(false);
      setGastos([]);
      return;
    }
    
    setLoading(true);
    setError('');
    
    // 4. PASAR consorcioId AL SERVICIO
    const unsubscribe = getGastos(consorcioId, (gastosNuevos, err) => {
      if (err) {
        setError("Error al cargar los gastos.");
        console.error(err);
      } else {
        setGastos(gastosNuevos);
      }
      setLoading(false);
    }, filtro);
    
    return () => unsubscribe();
    
  }, [filtro, consorcioId]); // <-- 5. AGREGAR consorcioId A DEPENDENCIAS

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleDelete = async (gasto) => {
    // 6. VALIDAR CONSORCIO
    if (!consorcioId) {
        setError("Error: No hay consorcio seleccionado.");
        return;
    }
    
    if (window.confirm(`¿Está seguro de eliminar el gasto "${gasto.concepto}" por ${formatCurrency(gasto.monto)}? Esta acción no se puede deshacer.`)) {
      try {
        setLoading(true);
        setError('');
        // 7. PASAR consorcioId AL SERVICIO
        await deleteGasto(consorcioId, gasto.id, gasto.facturaURL);
      } catch (err) {
        setError(`Error al eliminar: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };
  
  // 8. Deshabilitar si no hay consorcio
  const listDisabled = !consorcioId;

  return (
    <Paper sx={{ p: 3, mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Gastos Cargados
        </Typography>
        <ButtonGroup variant="outlined" aria-label="Filtro de gastos" disabled={listDisabled}>
          <Button onClick={() => setFiltro('pendientes')} variant={filtro === 'pendientes' ? 'contained' : 'outlined'}>Pendientes</Button>
          <Button onClick={() => setFiltro('todos')} variant={filtro === 'todos' ? 'contained' : 'outlined'}>Todos</Button>
        </ButtonGroup>
      </Box>

      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
      
      {/* 9. Mensaje si no hay consorcio */}
      {listDisabled && (
          <Alert severity="info" sx={{mb: 2}}>Seleccione un consorcio para ver los gastos.</Alert>
      )}

      <TableContainer>
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
                   {listDisabled ? 'Seleccione un consorcio' : 'No hay gastos para mostrar con el filtro actual.'}
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
                      onClick={() => onEdit(gasto)} // onEdit pasa el gasto a GastosPage
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