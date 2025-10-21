// src/components/CargaGastosForm.jsx
import React, { useState } from 'react';
import { crearGasto } from '../services/gastosService';

// --- IMPORTACIONES DE MUI ---
import { Box, Button, TextField, Typography, Grid, Paper, Alert, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
// --- FIN IMPORTACIONES MUI ---

function CargaGastosForm() {
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [facturaFile, setFacturaFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // La lógica de handleSubmit es la misma, no cambia
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await crearGasto({ fecha, concepto, proveedor, monto, facturaFile });
      
      setMessage('¡Gasto cargado exitosamente!');
      setFecha('');
      setConcepto('');
      setProveedor('');
      setMonto('');
      setFacturaFile(null);
      // Reseteamos el formulario
      e.target.reset(); 

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFacturaFile(e.target.files[0]);
    }
  };

  return (
    // Usamos 'Paper' para darle un fondo y sombra
    <Paper sx={{ p: 3, mb: 4 }}> 
      <Typography variant="h6" gutterBottom>
        Cargar Nuevo Gasto
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        {/* 'Grid' nos ayuda a alinear los campos */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Fecha"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }} // Para que la etiqueta "Fecha" no se superponga
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Concepto"
              fullWidth
              placeholder="Ej: Limpieza SUM"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Proveedor"
              fullWidth
              placeholder="Ej: Limpiamax S.R.L."
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Monto"
              type="number"
              fullWidth
              placeholder="Ej: 15000.50"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            {/* Botón estilizado para subir archivos */}
            <Button
              variant="outlined"
              component="label" // Esto hace que el botón actúe como un <label>
              fullWidth
              startIcon={<UploadFileIcon />}
            >
              {facturaFile ? facturaFile.name : 'Adjuntar PDF (Opcional)'}
              <input 
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                hidden // El input real está oculto
              />
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ height: '100%' }} // Para que tenga la misma altura que el botón de al lado
            >
              {loading ? <CircularProgress size={24} /> : 'Guardar Gasto'}
            </Button>
          </Grid>
        </Grid>
        {/* Mensaje de éxito o error */}
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