import React, { useState, useEffect, useMemo } from 'react';
import { aplicarInteresManual, eliminarMovimientoDebito } from '../services/propietariosService';
import {
  Box, Button, TextField, Typography, Modal, Paper, Alert, 
  CircularProgress, Grid, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton, Tooltip, Divider,
  TableContainer
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 700,
  maxHeight: '90vh',
  overflowY: 'auto',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

/**
 * Este es el modal de gestión de mora.
 * Permite ver el histórico de intereses de un mes de origen y aplicar nuevos.
 */
// 1. RECIBIR consorcioId COMO PROP
function GestionMoraModal({ open, onClose, consorcioId, unidadId, mesOrigen, todosMovimientos }) {
  // Estados del formulario
  const [tasaPct, setTasaPct] = useState('10');
  const [tipoInteres, setTipoInteres] = useState('INTERES_10');
  const [conceptoManual, setConceptoManual] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ... (useMemo para calcular movimientos no cambia) ...
  const { movimientosDelMes, totalBasePendiente, totalInteresPendiente, totalPendienteMes } = useMemo(() => {
    if (!mesOrigen || !todosMovimientos) {
      return { movimientosDelMes: [], totalBasePendiente: 0, totalInteresPendiente: 0, totalPendienteMes: 0 };
    }
    let movimientosFiltrados = [];
    let basePendiente = 0;
    let interesPendiente = 0;
    if (mesOrigen === 'Historico') {
        const antiguos = todosMovimientos.filter(m => !m.mes_origen && m.monto < 0);
        antiguos.forEach(mov => {
            const pendiente = Math.abs(mov.monto) - (mov.montoAplicado || 0);
            basePendiente += pendiente;
        });
        const interesesAntiguos = todosMovimientos.filter(m => m.mes_origen === 'Historico' && (m.tipo === 'INTERES_10' || m.tipo === 'INTERES_BNA'));
        interesesAntiguos.forEach(mov => {
            const pendiente = Math.abs(mov.monto) - (mov.montoAplicado || 0);
            interesPendiente += pendiente;
        });
        movimientosFiltrados = [...antiguos, ...interesesAntiguos].sort((a, b) => a.fecha - b.fecha);
    } else {
        movimientosFiltrados = todosMovimientos.filter(
          m => m.mes_origen === mesOrigen && m.monto < 0
        ).sort((a, b) => a.fecha - b.fecha);
        movimientosFiltrados.forEach(mov => {
          const pendiente = Math.abs(mov.monto) - (mov.montoAplicado || 0);
          if (mov.tipo && mov.tipo.includes('_BASE')) {
            basePendiente += pendiente;
          } else if (mov.tipo === 'INTERES_10' || mov.tipo === 'INTERES_BNA') {
            interesPendiente += pendiente;
          }
        });
    }
    return { 
      movimientosDelMes: movimientosFiltrados,
      totalBasePendiente: basePendiente,
      totalInteresPendiente: interesPendiente,
      totalPendienteMes: basePendiente + interesPendiente
    };
  }, [mesOrigen, todosMovimientos, open]);

  // ... (useMemo para montoInteresCalculado no cambia) ...
  const montoInteresCalculado = useMemo(() => {
    const tasa = parseFloat(tasaPct.replace(',', '.')) / 100;
    if (isNaN(tasa) || !totalPendienteMes) return 0;
    return totalPendienteMes * tasa; 
  }, [tasaPct, totalPendienteMes]);

  // ... (useEffect para limpiar formulario no cambia) ...
  useEffect(() => {
    if (open) {
      setMessage('');
      setError('');
      setLoading(false);
      setTipoInteres('INTERES_10');
      setTasaPct('10');
    }
  }, [open]);
  
  // ... (useEffect para concepto automático no cambia) ...
  useEffect(() => {
      if (mesOrigen) {
        const conceptoBase = `s/ Deuda ${mesOrigen}`;
        if (tipoInteres === 'INTERES_10') {
          setConceptoManual(`Interés 10% ${conceptoBase}`);
        } else {
          setConceptoManual(`Interés BNA ${tasaPct}% ${conceptoBase}`);
        }
      }
  }, [mesOrigen, tipoInteres, tasaPct]);


  // 4. Handler para AÑADIR interés
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // 2. VALIDAR consorcioId
      if (!consorcioId || !unidadId || !mesOrigen) throw new Error("Faltan IDs de Consorcio, Unidad o Mes de Origen.");
      if (montoInteresCalculado <= 0) {
        throw new Error("El interés calculado debe ser mayor a 0.");
      }
      
      const tasaDecimal = parseFloat(tasaPct.replace(',', '.')) / 100;

      // 3. PASAR consorcioId AL SERVICIO
      await aplicarInteresManual(
        consorcioId,
        unidadId, 
        mesOrigen, 
        montoInteresCalculado, 
        tipoInteres, 
        conceptoManual,
        tasaDecimal,
        null
      );
      
      setMessage('¡Interés aplicado exitosamente!');
      
    } catch (error) {
      setError(`Error al aplicar interés: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 5. Handler para ELIMINAR interés
  const handleDelete = async (movimiento) => {
    if (!window.confirm(`¿Seguro de eliminar el interés "${movimiento.concepto}" por ${formatCurrency(movimiento.monto)}?`)) {
      return;
    }
    
    // 4. VALIDAR consorcioId
    if (!consorcioId) {
      setError("Error: No se encontró el ID del consorcio.");
      return;
    }
    
    setLoading(true);
    setMessage('');
    setError('');
    try {
      // 5. PASAR consorcioId AL SERVICIO
      await eliminarMovimientoDebito(consorcioId, unidadId, movimiento.id);
      setMessage('Movimiento de interés eliminado.');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };


  if (!mesOrigen) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        {/* ... (Todo el JSX/HTML del modal no cambia) ... */}
        
        <Typography variant="h6" component="h2" gutterBottom>
          Gestionar Mora de: <strong>{mesOrigen}</strong>
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            Historial de Deuda (Mes Origen: {mesOrigen})
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Concepto</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell align="right">Pendiente</TableCell>
                  <TableCell align="center">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientosDelMes.map(mov => {
                  const esInteres = mov.tipo === 'INTERES_10' || mov.tipo === 'INTERES_BNA';
                  const esBase = (mov.tipo && mov.tipo.includes('_BASE')) || !mov.tipo;
                  const pendiente = Math.abs(mov.monto) - (mov.montoAplicado || 0);
                  const puedeBorrar = esInteres && (mov.montoAplicado || 0) === 0;
                  return (
                    <TableRow 
                      key={mov.id} 
                      sx={{backgroundColor: esBase ? '#fceeee' : '#fff8e1'}}
                    >
                      <TableCell sx={{fontStyle: esInteres ? 'italic' : 'normal'}}>
                        {mov.concepto}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(mov.monto)}</TableCell>
                      <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatCurrency(-pendiente)}</TableCell>
                      <TableCell align="center">
                        {puedeBorrar ? (
                          <Tooltip title="Eliminar Interés">
                            <IconButton onClick={() => handleDelete(mov)} size="small" color="error" disabled={loading}>
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Los movimientos base o con pagos no se pueden borrar desde aquí.">
                            <span>
                              <IconButton size="small" disabled>
                                <DeleteIcon fontSize="inherit" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 2, textAlign: 'right', borderTop: '1px solid #eee' }}>
            <Typography variant="body2">Total Base Pendiente: {formatCurrency(-totalBasePendiente)}</Typography>
            <Typography variant="body2">Total Interés Pendiente: {formatCurrency(-totalInteresPendiente)}</Typography>
            <Typography variant="h6" color="error.main">Total Pendiente (Base + Interés): {formatCurrency(-totalPendienteMes)}</Typography>
          </Box>
        </Paper>
        
        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Aplicar Nuevo Interés (Compuesto)
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
            El interés se calculará sobre el <strong>Total Pendiente (Base + Interés)</strong>: {formatCurrency(-totalPendienteMes)}
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Concepto del Interés (Título)"
                fullWidth
                size="small"
                value={conceptoManual}
                onChange={(e) => setConceptoManual(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Tasa (%)"
                type="number"
                fullWidth
                size="small"
                value={tasaPct}
                onChange={(e) => setTasaPct(e.target.value)}
                required
                InputProps={{ inputProps: { step: '0.01' } }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="tipo-interes-label">Tipo</InputLabel>
                <Select
                  labelId="tipo-interes-label"
                  value={tipoInteres}
                  label="Tipo"
                  onChange={(e) => setTipoInteres(e.target.value)}
                >
                  <MenuItem value="INTERES_10">INTERES_10</MenuItem>
                  <MenuItem value="INTERES_BNA">INTERES_BNA</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h5" color="primary" sx={{ textAlign: 'center', my: 1 }}>
                Monto a Cargar: {formatCurrency(-montoInteresCalculado)}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
               <Button onClick={onClose} fullWidth variant="outlined" disabled={loading}>
                 Cancelar y Cerrar
               </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                startIcon={<AddIcon />}
                disabled={loading || montoInteresCalculado <= 0}
              >
                {loading ? <CircularProgress size={24} /> : 'Aplicar Cargo'}
              </Button>
            </Grid>
          </Grid>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>
          )}
          {message && (
            <Alert severity="success" sx={{ mt: 2 }} onClose={() => setMessage('')}>{message}</Alert>
          )}
        </Box>
      </Box>
    </Modal>
  );
}

export default GestionMoraModal;