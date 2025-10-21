// src/components/GastosList.jsx
import React, { useState, useEffect } from 'react';
import { getGastos } from '../services/gastosService';

// --- IMPORTACIONES DE MUI ---
import { 
  Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, 
  Typography, Button, Box 
} from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

function GastosList() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);

  // La lógica es la misma
  useEffect(() => {
    const unsubscribe = getGastos((gastosNuevos) => {
      setGastos(gastosNuevos);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  if (loading) {
    return <Typography>Cargando lista de gastos...</Typography>;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Gastos Cargados
      </Typography>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="tabla de gastos">
          <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Concepto</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell align="center">Factura</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gastos.map((gasto) => (
              <TableRow
                key={gasto.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">{gasto.fecha}</TableCell>
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
                    // Si no hay PDF, mostramos un texto gris
                    <Typography variant="caption" color="textSecondary">Sin PDF</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default GastosList;