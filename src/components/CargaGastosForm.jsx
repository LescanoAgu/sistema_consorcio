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
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Cargar Nuevo Gasto
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        {/* Usamos Grid v2: Las props xs/sm van directamente en los <Grid> hijos */}
        <Grid container spacing={3}>
          <Grid xs={12} sm={4}> {/* <- xs/sm aquí */}
            <TextField
              label="Fecha"
              type="date"
              fullWidth
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
              placeholder="Ej: Limpieza SUM"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
            />
          </Grid>
          <Grid xs={12} sm={8}> {/* <- xs/sm aquí */}
            <TextField
              label="Proveedor"
              fullWidth
              placeholder="Ej: Limpiamax S.R.L."
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </Grid>
          <Grid xs={12} sm={4}> {/* <- xs/sm aquí */}
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
          <Grid xs={12} sm={6}> {/* <- xs/sm aquí */}
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<UploadFileIcon />}
            >
              {facturaFile ? facturaFile.name : 'Adjuntar PDF (Opcional)'}
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                hidden
              />
            </Button>
          </Grid>
          <Grid xs={12} sm={6}> {/* <- xs/sm aquí */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ height: '100%' }}
            >
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