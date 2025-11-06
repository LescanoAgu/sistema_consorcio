import React, { useState, useEffect } from 'react';
import { getUnidades } from '../services/propietariosService'; // Importamos el servicio
import { naturalSort } from '../utils/helpers';
// --- IMPORTACIONES DE MUI ---
import {
  Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
  Typography, CircularProgress
} from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

function DeudoresList() {
  const [deudores, setDeudores] = useState([]); // Estado para guardar solo los deudores
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = getUnidades((unidadesNuevas, err) => { // <-- Añadir err por si acaso
      if (err) {
        console.error("Error al obtener unidades para deudores:", err);
      } else {
        const unidadesDeudoras = unidadesNuevas.filter(unidad => unidad.saldo < 0);
        // <-- Usar naturalSort -->
        unidadesDeudoras.sort((a, b) => naturalSort(a.nombre, b.nombre));
        setDeudores(unidadesDeudoras);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Función para formatear moneda (igual que en PropietariosList)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography>Cargando lista de deudores...</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}> {/* Usamos Paper para darle fondo y padding */}
      <Typography variant="h6" gutterBottom>
        Lista de Propietarios con Saldo Deudor
      </Typography>
      {deudores.length === 0 ? (
        <Typography>No hay propietarios con saldo deudor actualmente.</Typography>
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 650 }} aria-label="tabla de deudores">
            <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableRow>
                <TableCell>Unidad</TableCell>
                <TableCell>Propietario</TableCell>
                <TableCell align="right">Saldo Actual</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deudores.map((unidad) => (
                <TableRow
                  key={unidad.id}
                  // Podríamos pintar la fila de rojo si queremos
                  // sx={{ '&:last-child td, &:last-child th': { border: 0 }, backgroundColor: '#ffebee' }}
                   sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">{unidad.nombre}</TableCell>
                  <TableCell>{unidad.propietario}</TableCell>
                  <TableCell align="right" sx={{ color: 'red', fontWeight: 'bold' }}> {/* Saldo en rojo y negrita */}
                    {formatCurrency(unidad.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

export default DeudoresList; // ¡Importante! Exportamos el componente por defecto