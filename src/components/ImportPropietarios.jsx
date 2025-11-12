import React, { useState, useEffect } from 'react';
import { useConsorcio } from '../hooks/useConsorcio';
import { 
    crearUnidadesBatch, 
    cargarMovimientosHistoricosBatch, 
    getTodasUnidades 
} from '../services/propietariosService';
import * as XLSX from 'xlsx'; // Importar la biblioteca de Excel

// --- IMPORTACIONES DE MUI ---
import { 
    Box, Button, Paper, Typography, Alert, CircularProgress, 
    Link, FormControl, InputLabel, Select, MenuItem, TextField, Grid, Autocomplete
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
// --- FIN IMPORTACIONES MUI ---

function ImportPropietarios() {
  const { consorcioId } = useConsorcio();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [importMode, setImportMode] = useState('unidades'); // 'unidades' | 'movimientos'
  
  // Para modo 'movimientos'
  const [unidades, setUnidades] = useState([]);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Cargar unidades para el selector de movimientos
  useEffect(() => {
    if (importMode === 'movimientos' && consorcioId) {
      const fetchUnidades = async () => {
        setLoadingUnidades(true);
        try {
          const u = await getTodasUnidades(consorcioId);
          // Ordenar alfabéticamente
          u.sort((a, b) => a.nombre.localeCompare(b.nombre));
          setUnidades(u);
        } catch (e) {
          setError('Error al cargar la lista de unidades para movimientos.');
        } finally {
          setLoadingUnidades(false);
        }
      };
      fetchUnidades();
    }
  }, [importMode, consorcioId]);


  const handleFileChange = (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    const file = e.target.files[0];
    if (!file) return;
    
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!consorcioId) throw new Error("No hay un consorcio seleccionado.");

        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir la hoja a JSON. 'defval: null' asegura que celdas vacías no se omitan.
        const jsonList = XLSX.utils.sheet_to_json(worksheet, { defval: null });

        if (jsonList.length === 0) throw new Error("El archivo está vacío o no tiene el formato correcto.");

        if (importMode === 'unidades') {
          // --- LÓGICA DE UNIDADES ---
          const unidadesList = jsonList.map((row) => {
            const unidad = row['Unidad'] || row['unidad'];
            const propietario = row['Propietario'] || row['propietario'];
            const porcentaje = row['Porcentaje'] || row['porcentaje'];
            
            // Validar que los datos existan
            if (!unidad || !propietario || porcentaje === null || porcentaje === undefined) {
              console.warn("Omitiendo fila inválida (faltan columnas Unidad, Propietario o Porcentaje):", row);
              return null;
            }
            return { nombre: String(unidad), propietario: String(propietario), porcentaje };
          }).filter(Boolean); // Filtramos las filas nulas/inválidas

          if (unidadesList.length === 0) {
            throw new Error("No se encontraron filas válidas. Verifique los encabezados (Unidad, Propietario, Porcentaje).");
          }
          
          const count = await crearUnidadesBatch(consorcioId, unidadesList);
          setMessage(`¡Éxito! Se importaron ${count} unidades nuevas.`);
          
        } else if (importMode === 'movimientos') {
          // --- LÓGICA DE MOVIMIENTOS HISTÓRICOS ---
          if (!unidadSeleccionada) throw new Error("Debe seleccionar la unidad para cargar los movimientos.");
          
          const movimientosList = jsonList.map((row) => {
            const fecha = row['Fecha'] || row['fecha']; // YYYY-MM-DD o Fecha de Excel
            const concepto = row['Concepto'] || row['concepto'];
            const monto = row['Monto'] || row['monto']; // El monto debe ser POSITIVO aquí (Ej: 10000)
            const mesOrigen = row['Mes_Origen'] || row['mes_origen']; // FORMATO: YYYY-MM (Ej: 2025-02)

            if (!fecha || !concepto || monto === null || monto === undefined || !mesOrigen) {
              console.warn("Omitiendo fila de movimiento inválida (faltan columnas: Fecha, Concepto, Monto, Mes_Origen):", row);
              return null;
            }
            
            // Convertir fecha de Excel (si es un número) a Date
            let fechaJS = fecha;
            if (typeof fecha === 'number') {
                fechaJS = XLSX.SSF.parse_date_code(fecha);
                // Convertir de objeto {y,m,d} a Date (mes es 0-indexado)
                fechaJS = new Date(fechaJS.y, fechaJS.m - 1, fechaJS.d, 12, 0, 0); // Usar mediodía para evitar UTC
            }
            
            return { fecha: fechaJS, concepto: String(concepto), monto: Math.abs(monto), mes_origen: String(mesOrigen) };
          }).filter(Boolean);

          if (movimientosList.length === 0) {
            throw new Error("No se encontraron filas válidas. Verifique los encabezados (Fecha, Concepto, Monto, Mes_Origen).");
          }

          const count = await cargarMovimientosHistoricosBatch(consorcioId, unidadSeleccionada.id, movimientosList);
          setMessage(`¡Éxito! Se cargaron ${count} movimientos históricos a ${unidadSeleccionada.nombre}. El saldo de la unidad fue actualizado.`);

        }

      } catch (err) {
        console.error("Error al procesar el archivo:", err);
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
        setFileName('');
        if (e.target.value) e.target.value = null; 
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
      <Typography variant="h6" gutterBottom>Importar Datos Masivamente</Typography>
      
      <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
        <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Modo de Importación</InputLabel>
              <Select
                value={importMode}
                label="Modo de Importación"
                onChange={(e) => {
                  setImportMode(e.target.value);
                  setUnidadSeleccionada(null);
                  setError('');
                  setMessage('');
                }}
                disabled={loading || !consorcioId}
              >
                <MenuItem value="unidades">Crear Nuevas Unidades</MenuItem>
                <MenuItem value="movimientos">Cargar Deudas Históricas (a una Unidad)</MenuItem>
              </Select>
            </FormControl>
        </Grid>
        
        {importMode === 'movimientos' && (
            <Grid item xs={12} sm={6}>
                 <Autocomplete
                  options={unidades}
                  getOptionLabel={(option) => `${option.nombre} (${option.propietario})`}
                  value={unidadSeleccionada}
                  onChange={(event, newValue) => setUnidadSeleccionada(newValue)}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  renderInput={(params) => <TextField {...params} label="Seleccionar Unidad Destino" required />}
                  disabled={loading || loadingUnidades || !consorcioId}
                  size="small"
                  loading={loadingUnidades}
                />
            </Grid>
        )}
      </Grid>
      
      <Typography variant="body2" color="textSecondary" sx={{mt: 1, mb: 2}}>
        {importMode === 'unidades' 
            ? <strong>Columnas requeridas: Unidad, Propietario, Porcentaje (Ej: 0.1188)</strong>
            : <strong>Columnas requeridas: Fecha (Formato de Excel o YYYY-MM-DD), Concepto, Monto (Positivo), Mes_Origen (YYYY-MM)</strong>
        }
      </Typography>

      <Box sx={{ my: 2 }}>
        <Button
          variant="outlined"
          component="label"
          fullWidth
          startIcon={loading ? <CircularProgress size={20} /> : <UploadFileIcon />}
          disabled={loading || !consorcioId || (importMode === 'movimientos' && !unidadSeleccionada)}
        >
          {fileName || `Seleccionar Archivo (.xlsx) para ${importMode === 'unidades' ? 'Unidades' : 'Movimientos'}`}
          <input
            type="file"
            hidden
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
          />
        </Button>
      </Box>
      
      {!consorcioId && (<Alert severity="warning" sx={{mt: 2}}>Selecciona un consorcio antes de importar.</Alert>)}
      {error && (<Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>)}
      {message && (<Alert severity="success" sx={{ mt: 2 }} onClose={() => setMessage('')}>{message}</Alert>)}
    </Paper>
  );
}

export default ImportPropietarios;