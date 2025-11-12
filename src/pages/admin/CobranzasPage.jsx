import React, { useState, useEffect } from 'react';
import { getTodasUnidades, registrarPago, getDeudasPendientes } from '../../services/propietariosService';
import { useConsorcio } from '../../hooks/useConsorcio';
import {
  Box, Button, TextField, Typography, Paper, Alert, CircularProgress, Grid,
  Autocomplete,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip
} from '@mui/material';
import { naturalSort } from '../../utils/helpers';
import PaymentIcon from '@mui/icons-material/Payment';

// --- Funciones de formato ---
const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};
const formatDate = (date) => {
  if (!date) return '';
  // Asegurarse de que 'date' sea un objeto Date
  const dateObj = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  if (isNaN(dateObj.getTime())) return 'Fecha inv.'; // Controlar fecha inválida
  
  return dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
// --- Fin Formato ---


function CobranzasPage() {
  const { consorcioId } = useConsorcio();

  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [deudasPendientes, setDeudasPendientes] = useState([]);
  const [loadingDeudas, setLoadingDeudas] = useState(false);

  // Cargar lista de unidades
  useEffect(() => {
    if (!consorcioId) {
      setLoadingUnidades(false);
      setUnidades([]);
      return;
    }
    
    const cargarUnidades = async () => {
      setLoadingUnidades(true);
      try {
        const unidadesObtenidas = await getTodasUnidades(consorcioId);
        unidadesObtenidas.sort((a, b) => naturalSort(a.nombre, b.nombre));
        setUnidades(unidadesObtenidas);
      } catch (error) {
        setMessage('Error al cargar la lista de unidades.');
        console.error("Error fetching unidades:", error);
      } finally {
        setLoadingUnidades(false);
      }
    };
    cargarUnidades();
    
  }, [consorcioId]);
  
  // Cargar deudas cuando se selecciona una unidad
  useEffect(() => {
    const cargarDeudas = async () => {
      if (!consorcioId || !unidadSeleccionada) {
        setDeudasPendientes([]);
        return;
      }
      
      setLoadingDeudas(true);
      try {
        const deudas = await getDeudasPendientes(consorcioId, unidadSeleccionada.id);
        setDeudasPendientes(deudas);
      } catch (error) {
        setMessage(`Error al cargar deudas: ${error.message}`);
      } finally {
        setLoadingDeudas(false);
      }
    };
    
    cargarDeudas();
    
  }, [consorcioId, unidadSeleccionada]);


  // Handler de Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!unidadSeleccionada) {
      setMessage('Error: Debes seleccionar una unidad.');
      return;
    }
    if (!consorcioId) {
      setMessage('Error: No hay un consorcio activo seleccionado.');
      return;
    }
    
    setLoading(true);
    setMessage('');
    try {
      const montoFloat = parseFloat(monto.replace(',', '.'));
      if (isNaN(montoFloat) || montoFloat <= 0) {
        throw new Error('El monto debe ser un número positivo.');
      }
      
      await registrarPago(consorcioId, unidadSeleccionada.id, montoFloat, fecha, concepto || `Pago ${unidadSeleccionada.nombre}`);
      
      setMessage(`¡Pago de ${formatCurrency(montoFloat)} registrado exitosamente para ${unidadSeleccionada.nombre}!`);
      
      setUnidadSeleccionada(null);
      setMonto('');
      setConcepto('');
      
    } catch (error) {
      setMessage(`Error al registrar el pago: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handler para rellenar monto
  const handlePagarSaldoTotal = () => {
      if (unidadSeleccionada && unidadSeleccionada.saldo < 0) {
          const montoDeuda = Math.abs(unidadSeleccionada.saldo);
          setMonto(montoDeuda.toFixed(2));
      }
  };


  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Registro de Cobranzas
      </Typography>

      {/* --- FORMULARIO DE PAGO --- */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Registrar Nuevo Pago
        </Typography>
        
        {!consorcioId ? (
           <Alert severity="warning">Seleccione un consorcio para registrar cobranzas.</Alert>
        ) : loadingUnidades ? (
          <CircularProgress />
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3} alignItems="flex-start" sx={{ pt: 2 }}>
              
              {/* Selector de unidad */}
              <Grid item xs={12} sm={12} md={6}>
                <Autocomplete
                  id="autocomplete-unidad"
                  options={unidades}
                  getOptionLabel={(option) => `${option.nombre} (${option.propietario})`}
                  value={unidadSeleccionada}
                  onChange={(event, newValue) => {
                    setUnidadSeleccionada(newValue);
                  }}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  
                  // =================== INICIO DE LA CORRECCIÓN ===================
                  renderOption={(props, option) => {
                    // Separamos 'key' del resto de las props
                    const { key, ...liProps } = props;
                    return (
                      // Usamos 'key' directamente en el 'li' y esparcimos el resto
                      <Box component="li" key={key} {...liProps}>
                        <Box>
                          <Typography variant="body1">{option.nombre}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.propietario} (Saldo: {formatCurrency(option.saldo)})
                          </Typography>
                        </Box>
                      </Box>
                    );
                  }}
                  // ==================== FIN DE LA CORRECCIÓN ===================
                  
                  renderInput={(params) => (
                    <TextField 
                        {...params} 
                        label="Seleccionar Unidad" 
                        required 
                        variant="outlined"
                        size="small"
                    />
                  )}
                  disabled={loading}
                />
              </Grid>

              {/* Monto Pagado */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Monto Pagado"
                  type="number"
                  fullWidth
                  placeholder="Ej: 25000.50"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  InputProps={{ inputProps: { step: '0.01' } }}
                  disabled={loading}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              
              {/* Fecha del Pago */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Fecha del Pago"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  disabled={loading}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              
              {/* Concepto */}
              <Grid item xs={12} sm={9} md={9}>
                <TextField
                  label="Concepto / Referencia (Opcional)"
                  fullWidth
                  placeholder="Ej: Pago Expensa Octubre, Transferencia Banco X"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  disabled={loading}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              
              {/* Botón */}
              <Grid item xs={12} sm={3} md={3}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !unidadSeleccionada}
                  startIcon={<PaymentIcon />}
                  sx={{ height: '40px' }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Registrar Pago'}
                </Button>
              </Grid>
            </Grid>

            {message && (
              <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 3 }} onClose={() => setMessage('')}>
                {message}
              </Alert>
            )}
          </Box>
        )}
      </Paper>
      
      {/* --- Detalle de deudas pendientes --- */}
      {unidadSeleccionada && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
                <Typography variant="h6">
                    Deudas Pendientes de: {unidadSeleccionada.nombre}
                </Typography>
                <Typography variant="h5" color="error.main" sx={{fontWeight: 'bold'}}>
                    Saldo Deudor Total: {formatCurrency(unidadSeleccionada.saldo)}
                </Typography>
            </Box>
            <Button
                variant="outlined"
                onClick={handlePagarSaldoTotal}
                disabled={loading || !(unidadSeleccionada.saldo < 0)}
            >
                Usar Saldo Total
            </Button>
          </Box>
          
          <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Concepto</TableCell>
                        <TableCell align="right">Monto Adeudado</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loadingDeudas ? (
                        <TableRow>
                            <TableCell colSpan={3} align="center"><CircularProgress /></TableCell>
                        </TableRow>
                    ) : deudasPendientes.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} align="center">Esta unidad no registra deudas pendientes.</TableCell>
                        </TableRow>
                    ) : (
                        deudasPendientes.map((deuda) => (
                            <TableRow key={deuda.id} hover>
                                <TableCell>{formatDate(deuda.fecha)}</TableCell>
                                <TableCell>
                                    <Tooltip title={`ID: ${deuda.id}`}>
                                        <span>{deuda.concepto}</span>
                                    </Tooltip>
                                </TableCell>
                                <TableCell align="right" sx={{color: 'error.main', fontWeight: '500'}}>
                                    {formatCurrency(deuda.monto)}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

    </Box>
  );
}

export default CobranzasPage;