import React, { useState, useEffect } from 'react';
import { updateGasto } from '../services/gastosService';
import { useConsorcio } from '../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK

// --- IMPORTACIONES DE MUI ---
import { Box, Button, TextField, Typography, Grid, Modal, Paper, Alert, CircularProgress } from '@mui/material';
// --- FIN IMPORTACIONES MUI ---

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

function EditGastoModal({ open, onClose, gastoToEdit }) {
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER ID

  useEffect(() => {
    if (gastoToEdit) {
      setFecha(gastoToEdit.fecha || '');
      setConcepto(gastoToEdit.concepto || '');
      setProveedor(gastoToEdit.proveedor || '');
      setMonto(gastoToEdit.monto || '');
      setMessage('');
    }
  }, [gastoToEdit, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!gastoToEdit || !gastoToEdit.id) {
          throw new Error("No se ha seleccionado un gasto para editar.");
      }
      if (!consorcioId) { // <-- 3. VALIDAR ID
           throw new Error("No hay un consorcio activo seleccionado.");
      }
      
      // 4. PASAR ID AL SERVICIO
      await updateGasto(consorcioId, gastoToEdit.id, { fecha, concepto, proveedor, monto });
      
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
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <Box sx={style}>
        <Typography id="modal-title" variant="h6" component="h2" gutterBottom>
          Editar Gasto
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid xs={12} sm={4}>
              <TextField
                label="Fecha"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </Grid>
            <Grid xs={12} sm={8}>
              <TextField
                label="Concepto"
                fullWidth
                size="small"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                required
              />
            </Grid>
            <Grid xs={12} sm={8}>
              <TextField
                label="Proveedor"
                fullWidth
                size="small"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </Grid>
            <Grid xs={12} sm={4}>
              <TextField
                label="Monto"
                type="number"
                fullWidth
                size="small"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </Grid>
            <Grid xs={12}>
              <Typography variant="caption" color="textSecondary">
                La edición no permite cambiar el archivo PDF adjunto.
              </Typography>
            </Grid>
            <Grid xs={12} sm={6}>
               <Button onClick={onClose} fullWidth variant="outlined">
                 Cancelar
               </Button>
            </Grid>
            <Grid xs={12} sm={6}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
              >
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