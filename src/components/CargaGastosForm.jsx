import React, { useState, useEffect } from 'react'; // Importar useEffect
import { crearGasto } from '../services/gastosService';
import { getTodasUnidades } from '../services/propietariosService'; // Para el selector múltiple

// --- IMPORTACIONES DE MUI ---
import {
  Box, Button, TextField, Typography, Grid, Paper, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, // Para el tipo de gasto
  RadioGroup, FormControlLabel, Radio, // Para la distribución
  Autocomplete, Checkbox // Para seleccionar unidades
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
// --- FIN IMPORTACIONES MUI ---

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

function CargaGastosForm() {
  // Estados existentes
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [facturaFile, setFacturaFile] = useState(null);

  // --- Nuevos Estados ---
  const [tipoGasto, setTipoGasto] = useState('Ordinario'); // 'Ordinario' | 'Extraordinario'
  const [distribucionExtra, setDistribucionExtra] = useState('Prorrateo'); // 'Prorrateo' | 'UnidadesEspecificas' | 'FondoDeReserva'
  const [unidadesDisponibles, setUnidadesDisponibles] = useState([]); // Para el Autocomplete
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState([]); // Array de objetos unidad

  // Estados generales
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Cargar unidades cuando el tipo de gasto sea Extraordinario y distribución sea UnidadesEspecificas
  useEffect(() => {
    const cargarUnidades = async () => {
      setLoadingUnidades(true);
      try {
        const unidadesObtenidas = await getTodasUnidades();
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
      setUnidadesDisponibles([]); // Limpiar si no se necesita
    }
  }, [tipoGasto, distribucionExtra]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Preparamos los datos base
    const gastoData = {
      fecha,
      concepto,
      proveedor,
      monto,
      facturaFile,
      tipo: tipoGasto, // Añadimos el tipo
    };

    // Añadimos campos extraordinarios si corresponde
    if (tipoGasto === 'Extraordinario') {
      gastoData.distribucion = distribucionExtra;
      if (distribucionExtra === 'UnidadesEspecificas') {
        if (unidadesSeleccionadas.length === 0) {
           setMessage('Error: Debe seleccionar al menos una unidad para la distribución específica.');
           setLoading(false);
           return;
        }
        // Guardamos solo los IDs
        gastoData.unidadesAfectadas = unidadesSeleccionadas.map(u => u.id);
      } else {
         gastoData.unidadesAfectadas = []; // Array vacío si no aplica
      }
    } else {
        // Aseguramos valores por defecto si vuelve a ser Ordinario
        gastoData.distribucion = 'Prorrateo';
        gastoData.unidadesAfectadas = [];
    }


    try {
      await crearGasto(gastoData); // Enviamos el objeto completo

      setMessage('¡Gasto cargado exitosamente!');
      // Limpiar formulario completo
      setFecha('');
      setConcepto('');
      setProveedor('');
      setMonto('');
      setFacturaFile(null);
      setTipoGasto('Ordinario');
      setDistribucionExtra('Prorrateo');
      setUnidadesSeleccionadas([]);
      if (e.target.reset) e.target.reset(); // Intenta resetear campos nativos

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => { /* Sin cambios */ };

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Cargar Nuevo Gasto
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Campos existentes (Fecha, Concepto, Proveedor, Monto) */}
          <Grid item xs={12} sm={4}>
            <TextField label="Fecha" type="date" fullWidth InputLabelProps={{ shrink: true }} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField label="Concepto" fullWidth placeholder="Ej: Limpieza SUM" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField label="Proveedor" fullWidth placeholder="Ej: Limpiamax S.R.L." value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Monto" type="number" fullWidth placeholder="Ej: 15000.50" value={monto} onChange={(e) => setMonto(e.target.value)} required InputProps={{ inputProps: { step: '0.01' } }} />
          </Grid>

          {/* --- Nuevos Campos --- */}
          {/* Tipo de Gasto */}
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
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
              {/* Distribución */}
              <Grid item xs={12} sm={8}>
                 <FormControl component="fieldset">
                   <Typography component="legend" variant="body2" sx={{ mb: 1 }}>Distribuir gasto entre:</Typography>
                   <RadioGroup
                     row
                     aria-label="distribucion"
                     name="distribucion"
                     value={distribucionExtra}
                     onChange={(e) => setDistribucionExtra(e.target.value)}
                   >
                     <FormControlLabel value="Prorrateo" control={<Radio />} label="Todas las unidades (Prorrateo)" />
                     <FormControlLabel value="UnidadesEspecificas" control={<Radio />} label="Unidades específicas" />
                     <FormControlLabel value="FondoDeReserva" control={<Radio />} label="Fondo de Reserva" />
                   </RadioGroup>
                 </FormControl>
              </Grid>

              {/* Selector Múltiple de Unidades (Condicional) */}
              {distribucionExtra === 'UnidadesEspecificas' && (
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    limitTags={4} // Muestra hasta 4 chips, luego "(+x)"
                    options={unidadesDisponibles}
                    loading={loadingUnidades}
                    value={unidadesSeleccionadas}
                    onChange={(event, newValue) => {
                      setUnidadesSeleccionadas(newValue);
                    }}
                    getOptionLabel={(option) => option.nombre}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    disableCloseOnSelect
                    renderOption={(props, option, { selected }) => (
                      <li {...props}>
                        <Checkbox
                          icon={icon}
                          checkedIcon={checkedIcon}
                          style={{ marginRight: 8 }}
                          checked={selected}
                        />
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

          {/* Subir PDF y Botón Guardar (sin cambios, pero ajustamos grid) */}
          {/* Si es ordinario, ocupan 8+4=12. Si es extra, se adaptan */}
          <Grid item xs={12} sm={tipoGasto === 'Ordinario' ? 8 : 6}>
            <Button variant="outlined" component="label" fullWidth startIcon={<UploadFileIcon />}>
              {facturaFile ? facturaFile.name : 'Adjuntar PDF (Opcional)'}
              <input type="file" accept="application/pdf" onChange={handleFileChange} hidden />
            </Button>
          </Grid>
          <Grid item xs={12} sm={tipoGasto === 'Ordinario' ? 4 : 6}>
            <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ height: '100%' }}>
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
    </Paper>
  );
}

export default CargaGastosForm;