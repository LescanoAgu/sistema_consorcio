import React, { useState, useEffect } from 'react';
import { crearGasto } from '../services/gastosService';
import { getTodasUnidades } from '../services/propietariosService';
import { useConsorcio } from '../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK

// --- IMPORTACIONES DE MUI ---
import {
  Box, Button, TextField, Typography, Grid, Paper, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem,
  RadioGroup, FormControlLabel, Radio,
  Autocomplete, Checkbox
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
// --- FIN IMPORTACIONES MUI ---

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

function CargaGastosForm() {
  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER CONSORCIO ACTIVO
  
  // Estados existentes
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [facturaFile, setFacturaFile] = useState(null);

  // Nuevos Estados
  const [tipoGasto, setTipoGasto] = useState('Ordinario');
  const [distribucionExtra, setDistribucionExtra] = useState('Prorrateo');
  const [unidadesDisponibles, setUnidadesDisponibles] = useState([]);
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState([]);

  // Estados generales
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Cargar unidades
  useEffect(() => {
    const cargarUnidades = async () => {
      // 3. VALIDAR CONSORCIO
      if (!consorcioId) {
          setMessage('Error: No hay consorcio activo para cargar unidades.');
          return;
      }
      setLoadingUnidades(true);
      try {
        // 4. PASAR consorcioId AL SERVICIO
        const unidadesObtenidas = await getTodasUnidades(consorcioId);
        unidadesObtenidas.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setUnidadesDisponibles(unidadesObtenidas);
      } catch (error) {
        console.error("Error fetching unidades:", error);
        setMessage('Error al cargar lista de unidades para seleccionar.');
      } finally {
        setLoadingUnidades(false);
      }
    };

    if (tipoGasto === 'Extraordinario' && distribucionExtra === 'UnidadesEspecificas') {
      cargarUnidades();
    } else {
      setUnidadesDisponibles([]);
    }
    
  }, [tipoGasto, distribucionExtra, consorcioId]); // <-- 5. AGREGAR consorcioId A DEPENDENCIAS


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 6. VALIDAR CONSORCIO
    if (!consorcioId) {
        setMessage('Error: No hay un consorcio activo seleccionado para guardar el gasto.');
        setLoading(false);
        return;
    }

    // Preparamos los datos base
    const gastoData = {
      fecha,
      concepto,
      proveedor,
      monto,
      facturaFile,
      tipo: tipoGasto,
    };

    // Añadimos campos extraordinarios
    if (tipoGasto === 'Extraordinario') {
      gastoData.distribucion = distribucionExtra;
      if (distribucionExtra === 'UnidadesEspecificas') {
        if (unidadesSeleccionadas.length === 0) {
           setMessage('Error: Debe seleccionar al menos una unidad para la distribución específica.');
           setLoading(false);
           return;
        }
        gastoData.unidadesAfectadas = unidadesSeleccionadas.map(u => u.id);
      } else {
         gastoData.unidadesAfectadas = [];
      }
    } else {
        gastoData.distribucion = 'Prorrateo';
        gastoData.unidadesAfectadas = [];
    }

    try {
      // 7. PASAR consorcioId AL SERVICIO
      await crearGasto(consorcioId, gastoData); 

      setMessage('¡Gasto cargado exitosamente!');
      // ... (limpieza de formulario) ...
      setFecha('');
      setConcepto('');
      setProveedor('');
      setMonto('');
      setFacturaFile(null);
      setTipoGasto('Ordinario');
      setDistribucionExtra('Prorrateo');
      setUnidadesSeleccionadas([]);
      if (e.target.reset) e.target.reset();

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ... (handleFileChange no cambia) ...
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        setMessage("Error: Solo se permiten archivos PDF.");
        setFacturaFile(null);
        e.target.value = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) { 
        setMessage("Error: El archivo PDF es demasiado grande (max 5MB).");
        setFacturaFile(null);
        e.target.value = null;
        return;
      }
      setFacturaFile(file);
      setMessage('');
    } else {
      setFacturaFile(null);
    }
  };
  
  // 8. Deshabilitar todo si no hay consorcio
  const formDisabled = loading || !consorcioId;

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Cargar Nuevo Gasto
      </Typography>
      
      {!consorcioId ? (
          <Alert severity="warning">Seleccione un consorcio para cargar gastos.</Alert>
      ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Campos (deshabilitados si formDisabled es true) */}
              <Grid item xs={12} sm={4}>
                <TextField label="Fecha" type="date" fullWidth InputLabelProps={{ shrink: true }} value={fecha} onChange={(e) => setFecha(e.target.value)} required disabled={formDisabled} />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField label="Concepto" fullWidth placeholder="Ej: Limpieza SUM" value={concepto} onChange={(e) => setConcepto(e.target.value)} required disabled={formDisabled} />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField label="Proveedor" fullWidth placeholder="Ej: Limpiamax S.R.L." value={proveedor} onChange={(e) => setProveedor(e.target.value)} disabled={formDisabled} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Monto" type="number" fullWidth placeholder="Ej: 15000.50" value={monto} onChange={(e) => setMonto(e.target.value)} required InputProps={{ inputProps: { step: '0.01' } }} disabled={formDisabled} />
              </Grid>
    
              {/* Tipo de Gasto */}
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={formDisabled}>
                  <InputLabel id="tipo-gasto-label">Tipo</InputLabel>
                  <Select
                    labelId="tipo-gasto-label"
                    value={tipoGasto}
                    label="Tipo"
                    onChange={(e) => setTipoGasto(e.target.value)}
                  >
                    <MenuItem value="Ordinario">Ordinario</MenuItem>
                    <MenuItem value="Extraordinario">Extraordinario</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
    
              {/* Opciones Extraordinarias (Condicional) */}
              {tipoGasto === 'Extraordinario' && (
                <>
                  <Grid item xs={12} sm={8}>
                     <FormControl component="fieldset" disabled={formDisabled}>
                       <Typography component="legend" variant="body2" sx={{ mb: 1 }}>Distribuir gasto entre:</Typography>
                       <RadioGroup row value={distribucionExtra} onChange={(e) => setDistribucionExtra(e.target.value)}>
                         <FormControlLabel value="Prorrateo" control={<Radio />} label="Todas las unidades (Prorrateo)" />
                         <FormControlLabel value="UnidadesEspecificas" control={<Radio />} label="Unidades específicas" />
                         <FormControlLabel value="FondoDeReserva" control={<Radio />} label="Fondo de Reserva" />
                       </RadioGroup>
                     </FormControl>
                  </Grid>
    
                  {distribucionExtra === 'UnidadesEspecificas' && (
                    <Grid item xs={12}>
                      <Autocomplete
                        multiple
                        limitTags={4}
                        options={unidadesDisponibles}
                        loading={loadingUnidades}
                        value={unidadesSeleccionadas}
                        onChange={(event, newValue) => {
                          setUnidadesSeleccionadas(newValue);
                        }}
                        getOptionLabel={(option) => option.nombre}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        disableCloseOnSelect
                        disabled={formDisabled || loadingUnidades} // Deshabilitado
                        renderOption={(props, option, { selected }) => (
                          <li {...props}>
                            <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
                            {option.nombre} ({option.propietario})
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField {...params} label="Seleccionar Unidades Afectadas" placeholder="Unidades" />
                        )}
                      />
                    </Grid>
                  )}
                </>
              )}
    
              {/* Subir PDF y Botón Guardar */}
              <Grid item xs={12} sm={tipoGasto === 'Ordinario' ? 8 : 6}>
                <Button variant="outlined" component="label" fullWidth startIcon={<UploadFileIcon />} disabled={formDisabled}>
                  {facturaFile ? facturaFile.name : 'Adjuntar PDF (Opcional)'}
                  <input type="file" accept="application/pdf" onChange={handleFileChange} hidden />
                </Button>
              </Grid>
              <Grid item xs={12} sm={tipoGasto === 'Ordinario' ? 4 : 6}>
                <Button type="submit" variant="contained" fullWidth disabled={formDisabled} sx={{ height: '100%' }}>
                  {loading ? <CircularProgress size={24} /> : 'Guardar Gasto'}
                </Button>
              </Grid>
            </Grid>
    
            {message && (
              <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 3 }}>
                {message}
              </Alert>
            )}
          </Box>
      )}
    </Paper>
  );
}

export default CargaGastosForm;