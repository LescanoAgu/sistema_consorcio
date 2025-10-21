import React, { useState, useEffect } from 'react';
import { updateGasto } from '../services/gastosService';

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
      await updateGasto(gastoToEdit.id, { fecha, concepto, proveedor, monto });
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
          {/* Usamos Grid v2: Las props xs/sm van directamente en los <Grid> hijos */}
          <Grid container spacing={2}>
            <Grid xs={12} sm={4}> {/* <- xs/sm aquí */}
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
            <Grid xs={12} sm={8}> {/* <- xs/sm aquí */}
              <TextField
                label="Concepto"
                fullWidth
                size="small"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                required
              />
            </Grid>
            <Grid xs={12} sm={8}> {/* <- xs/sm aquí */}
              <TextField
                label="Proveedor"
                fullWidth
                size="small"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </Grid>
            <Grid xs={12} sm={4}> {/* <- xs/sm aquí */}
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
            <Grid xs={12}> {/* <- xs aquí */}
              <Typography variant="caption" color="textSecondary">
                La edición no permite cambiar el archivo PDF adjunto.
              </Typography>
            </Grid>
            <Grid xs={12} sm={6}> {/* <- xs/sm aquí */}
               <Button onClick={onClose} fullWidth variant="outlined">
                 Cancelar
               </Button>
            </Grid>
            <Grid xs={12} sm={6}> {/* <- xs/sm aquí */}
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