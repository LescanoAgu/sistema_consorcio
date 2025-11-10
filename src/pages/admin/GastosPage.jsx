import React, { useState, useEffect } from 'react';
import { updateGasto } from '../services/gastosService';
import { getTodasUnidades } from '../services/propietariosService'; // Para editar unidades
import { useConsorcio } from '../hooks/useConsorcio'; // <-- IMPORTAR HOOK

// --- IMPORTACIONES DE MUI ---
import {
  Box, Button, TextField, Typography, Grid, Modal, Paper, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem,
  RadioGroup, FormControlLabel, Radio,
  Autocomplete, Checkbox
} from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
// --- FIN IMPORTACIONES MUI ---

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 700, // Hacerlo más ancho para los nuevos campos
  maxHeight: '90vh',
  overflowY: 'auto',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

// 1. RECIBIR consorcioId COMO PROP
function EditGastoModal({ open, onClose, gastoToEdit, consorcioId }) {
  // const { consorcioId } = useConsorcio(); // Alternativa si no se pasa como prop
  
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  
  // --- Estados para Edición Completa ---
  const [tipoGasto, setTipoGasto] = useState('Ordinario');
  const [distribucionExtra, setDistribucionExtra] = useState('Prorrateo');
  const [unidadesDisponibles, setUnidadesDisponibles] = useState([]);
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [message, setMessage] = useState('');

  // 2. Efecto para cargar datos del gasto
  useEffect(() => {
    if (gastoToEdit) {
      setFecha(gastoToEdit.fecha || '');
      setConcepto(gastoToEdit.concepto || '');
      setProveedor(gastoToEdit.proveedor || '');
      setMonto(gastoToEdit.monto || '');
      
      // Cargar datos de tipo y distribución
      setTipoGasto(gastoToEdit.tipo || 'Ordinario');
      setDistribucionExtra(gastoToEdit.distribucion || 'Prorrateo');
      
      // Pre-seleccionar unidades si es el caso
      // (Se dispara el useEffect de abajo para cargar 'unidadesDisponibles')
      if (gastoToEdit.tipo === 'Extraordinario' && gastoToEdit.distribucion === 'UnidadesEspecificas' && gastoToEdit.unidadesAfectadas) {
          // Inicialmente seteamos un array vacío, el siguiente useEffect cargará las unidades
          setUnidadesSeleccionadas([]); 
      } else {
          setUnidadesSeleccionadas([]);
      }

      setMessage('');
    }
  }, [gastoToEdit, open]); // Depender de 'open' resetea el form cada vez que se abre

  // 3. Efecto para cargar unidades (similar a CargaGastosForm)
  useEffect(() => {
    const cargarUnidades = async () => {
      if (!consorcioId) {
          setMessage('Error: No hay consorcio activo.');
          return;
      }
      setLoadingUnidades(true);
      try {
        const unidadesObtenidas = await getTodasUnidades(consorcioId);
        unidadesObtenidas.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setUnidadesDisponibles(unidadesObtenidas);

        // Ahora, pre-seleccionamos las unidades correctas
        if (gastoToEdit && gastoToEdit.unidadesAfectadas) {
            const seleccionadas = unidadesObtenidas.filter(u => gastoToEdit.unidadesAfectadas.includes(u.id));
            setUnidadesSeleccionadas(seleccionadas);
        }
        
      } catch (error) {
        console.error("Error fetching unidades:", error);
        setMessage('Error al cargar lista de unidades.');
      } finally {
        setLoadingUnidades(false);
      }
    };

    if (open && tipoGasto === 'Extraordinario' && distribucionExtra === 'UnidadesEspecificas') {
      cargarUnidades();
    } else {
      setUnidadesDisponibles([]);
    }
  }, [tipoGasto, distribucionExtra, consorcioId, open, gastoToEdit]); // Depender de 'open' y 'gastoToEdit'


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // 4. VALIDAR consorcioId y gastoToEdit
      if (!consorcioId || !gastoToEdit || !gastoToEdit.id) {
          throw new Error("No se ha seleccionado un gasto o consorcio para editar.");
      }
      
      // 5. Preparar TODOS los datos
      const gastoData = {
          fecha,
          concepto,
          proveedor,
          monto,
          tipo: tipoGasto,
          distribucion: distribucionExtra,
          unidadesAfectadas: unidadesSeleccionadas.map(u => u.id)
      };

      // Validar unidades específicas
      if (tipoGasto === 'Extraordinario' && distribucionExtra === 'UnidadesEspecificas' && gastoData.unidadesAfectadas.length === 0) {
           throw new Error('Debe seleccionar al menos una unidad para la distribución específica.');
      }

      // 6. PASAR consorcioId y gastoId AL SERVICIO
      await updateGasto(consorcioId, gastoToEdit.id, gastoData);
      
      setMessage('¡Gasto actualizado exitosamente!');
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      setMessage(`Error al actualizar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!gastoToEdit) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Typography id="modal-title" variant="h6" component="h2" gutterBottom>
          Editar Gasto
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Campos básicos */}
            <Grid item xs={12} sm={4}>
              <TextField label="Fecha" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={fecha} onChange={(e) => setFecha(e.target.value)} required disabled={loading} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField label="Concepto" fullWidth size="small" value={concepto} onChange={(e) => setConcepto(e.target.value)} required disabled={loading} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField label="Proveedor" fullWidth size="small" value={proveedor} onChange={(e) => setProveedor(e.target.value)} disabled={loading} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Monto" type="number" fullWidth size="small" value={monto} onChange={(e) => setMonto(e.target.value)} required disabled={loading} InputProps={{ inputProps: { step: '0.01' } }}/>
            </Grid>
            
            <Grid item xs={12}><hr/></Grid>

            {/* Campos de Distribución (Nuevos) */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" disabled={loading}>
                <InputLabel id="tipo-gasto-label-edit">Tipo</InputLabel>
                <Select
                  labelId="tipo-gasto-label-edit"
                  value={tipoGasto}
                  label="Tipo"
                  onChange={(e) => setTipoGasto(e.target.value)}
                >
                  <MenuItem value="Ordinario">Ordinario</MenuItem>
                  <MenuItem value="Extraordinario">Extraordinario</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {tipoGasto === 'Extraordinario' && (
              <>
                <Grid item xs={12} sm={8}>
                   <FormControl component="fieldset" disabled={loading}>
                     <RadioGroup row value={distribucionExtra} onChange={(e) => setDistribucionExtra(e.target.value)} sx={{ justifyContent: 'space-around', alignItems: 'center', height: '100%' }}>
                       <FormControlLabel value="Prorrateo" control={<Radio size="small" />} label="Prorrateo" />
                       <FormControlLabel value="UnidadesEspecificas" control={<Radio size="small" />} label="Específicas" />
                       <FormControlLabel value="FondoDeReserva" control={<Radio size="small" />} label="Fondo" />
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
                      disabled={loading || loadingUnidades}
                      renderOption={(props, option, { selected }) => (
                        <li {...props}>
                          <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
                          {option.nombre} ({option.propietario})
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField {...params} label="Seleccionar Unidades Afectadas" placeholder="Unidades" size="small" />
                      )}
                    />
                  </Grid>
                )}
              </>
            )}
            
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                La edición no permite cambiar el archivo PDF adjunto.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
               <Button onClick={onClose} fullWidth variant="outlined" disabled={loading}>
                 Cancelar
               </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button type="submit" variant="contained" fullWidth disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Guardar Cambios'}
              </Button>
            </Grid>
          </Grid>
          {message && (
            <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}
        </Box>
      </Box>
    </Modal>
  );
}

export default EditGastoModal;