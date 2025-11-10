import React, { useState } from 'react';
import { useConsorcio } from '../hooks/useConsorcio';
import { crearUnidadesBatch } from '../services/propietariosService';
import * as XLSX from 'xlsx'; // Importar la biblioteca de Excel

// --- IMPORTACIONES DE MUI ---
import { Box, Button, Paper, Typography, Alert, CircularProgress, Link } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
// --- FIN IMPORTACIONES MUI ---

function ImportPropietarios() {
  const { consorcioId } = useConsorcio();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!consorcioId) {
          throw new Error("No hay un consorcio seleccionado.");
        }

        const data = event.target.result;
        // 1. Leer el archivo de Excel
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 2. Convertir la hoja a JSON
        // Asume que la primera fila es: "Unidad", "Propietario", "Porcentaje"
        const jsonList = XLSX.utils.sheet_to_json(worksheet);

        if (jsonList.length === 0) {
          throw new Error("El archivo está vacío o no tiene el formato correcto.");
        }

        // 3. Mapear el JSON a nuestro formato de datos
        const unidadesList = jsonList.map((row) => {
          // Buscamos los encabezados (insensible a mayúsculas/minúsculas)
          const unidad = row['Unidad'] || row['unidad'];
          const propietario = row['Propietario'] || row['propietario'];
          const porcentaje = row['Porcentaje'] || row['porcentaje'];

          if (!unidad || !propietario || porcentaje === undefined) {
            console.warn("Omitiendo fila inválida (faltan columnas):", row);
            return null;
          }
          
          return { nombre: unidad, propietario, porcentaje };
        }).filter(Boolean); // Filtramos las filas nulas/inválidas

        // 4. Enviar el lote (batch) al servicio
        const unidadesProcesadas = await crearUnidadesBatch(consorcioId, unidadesList);

        setMessage(`¡Éxito! Se importaron ${unidadesProcesadas} unidades. Refresca la página si no ves los cambios.`);

      } catch (err) {
        console.error("Error al procesar el archivo:", err);
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
        // Resetear el input de archivo para permitir cargar el mismo archivo de nuevo
        e.target.value = null; 
      }
    };
    
    reader.onerror = (err) => {
        setError("Error al leer el archivo.");
        setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <Paper sx={{ p: 3, mt: 4, backgroundColor: '#f9f9f9' }}>
      <Typography variant="h6" gutterBottom>Importar Unidades desde Excel</Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Sube un archivo .xlsx o .csv con las columnas: <strong>Unidad</strong>, <strong>Propietario</strong>, y <strong>Porcentaje</strong>.
      </Typography>
      <Box sx={{ my: 2 }}>
        <Button
          variant="outlined"
          component="label" // Esto hace que el botón actúe como un <label>
          fullWidth
          startIcon={loading ? <CircularProgress size={20} /> : <UploadFileIcon />}
          disabled={loading || !consorcioId}
        >
          {fileName || 'Seleccionar Archivo (.xlsx)'}
          <input
            type="file"
            hidden // El input real está oculto
            accept=".xlsx, .xls, .csv" // Aceptar formatos de Excel
            onChange={handleFileChange}
          />
        </Button>
      </Box>
      
      {!consorcioId && (
          <Alert severity="warning">Selecciona un consorcio antes de importar.</Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      )}
    </Paper>
  );
}

export default ImportPropietarios;