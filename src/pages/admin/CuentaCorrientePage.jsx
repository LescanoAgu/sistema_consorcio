import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { getCuentaCorriente, eliminarMovimientoDebito } from '../../services/propietariosService';
import { generarPDFEstadoDeuda } from '../../utils/pdfGenerator';
import { saveAs } from 'file-saver';
import GestionMoraModal from '../../components/GestionMoraModal'; // <-- IMPORTAMOS EL NUEVO MODAL

// --- IMPORTACIONES DE MUI ---
import {
  Box, Typography, Paper, Table, TableBody, TableCell, Link,
  TableContainer, TableHead, TableRow, CircularProgress, Alert, Button,
  IconButton, Tooltip // <-- Para los botones de acción
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'; // Icono para "Aplicar Interés"
import DeleteIcon from '@mui/icons-material/Delete'; // Icono para "Eliminar"
// --- FIN IMPORTACIONES MUI ---

function CuentaCorrientePage() {
  const { unidadId } = useParams();

  const [unidad, setUnidad] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // --- Estados para el Modal ---
  const [modalOpen, setModalOpen] = useState(false);
  const [mesOrigenSeleccionado, setMesOrigenSeleccionado] = useState(null); // <-- Ahora guardamos el MES

  useEffect(() => {
    if (!unidadId) {
      setError("No se especificó un ID de unidad.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const unsubscribe = getCuentaCorriente(unidadId, (data, err) => {
      if (err) {
        setError(err.message || 'Error al cargar la cuenta corriente.');
        setUnidad(null);
        setMovimientos([]);
        console.error(err);
      } else if (data) {
        setUnidad(data.unidad);
        setMovimientos(data.movimientos);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [unidadId]); 

  // --- Agrupamos movimientos para la tabla (Tu Punto 3) ---
  const movimientosAgrupados = useMemo(() => {
    const grupos = {}; // { "2025-02": [movBase, movInteres1, movInteres2] }
    const pagosYAntiguos = [];

    movimientos.forEach(mov => {
      // Si es un débito CON mes_origen (Base o Interés)
      if (mov.monto < 0 && mov.mes_origen) {
        if (!grupos[mov.mes_origen]) grupos[mov.mes_origen] = [];
        
        // --- INICIO DE LA CORRECCIÓN ---
        grupos[mov.mes_origen].push(mov); // <-- ANTES: grupos[mov.mes_origen][mov.mes_origen].push(mov);
        // --- FIN DE LA CORRECCIÓN ---

      } 
      // Si es un Pago o Deuda Antigua (sin mes_origen)
      else {
        pagosYAntiguos.push(mov);
      }
    });

    // Ordenamos los items dentro de cada grupo por fecha
    Object.values(grupos).forEach(grupo => {
      grupo.sort((a, b) => a.fecha - b.fecha);
    });

    // Creamos la lista final: primero los items agrupados, luego el resto
    // Y ordenamos todo por la fecha del primer movimiento del grupo o la fecha del item
    const itemsFinales = [
      ...Object.values(grupos), // Array de arrays
      ...pagosYAntiguos // Array de items
    ];

    return itemsFinales.sort((a, b) => {
      const fechaA = Array.isArray(a) ? (a[0] ? a[0].fecha : 0) : a.fecha; // Añadimos chequeo por si el grupo está vacío
      const fechaB = Array.isArray(b) ? (b[0] ? b[0].fecha : 0) : b.fecha;
      return fechaA - fechaB;
    });

  }, [movimientos]);

  
  // --- Handlers para Acciones ---

  const handleOpenModal = (mesOrigen) => {
    // Si la deuda es antigua y no tiene mes_origen, usamos 'Historico'
    setMesOrigenSeleccionado(mesOrigen || 'Historico');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setMesOrigenSeleccionado(null);
    setModalOpen(false);
    // No necesitamos recargar datos, el listener de 'getCuentaCorriente' lo hará automáticamente
  };

  const handleDeleteMovimiento = async (movimiento) => {
    if (!window.confirm(`¿Está seguro de eliminar el movimiento "${movimiento.concepto}" por ${formatCurrency(movimiento.monto)}?\n\nEsta acción NO se puede deshacer y afectará el saldo.`)) {
      return;
    }
    setLoading(true); // Usamos el loading principal
    setError('');
    try {
      await eliminarMovimientoDebito(unidadId, movimiento.id);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarPDFDeuda = async () => {
    if (!unidad || !movimientos) {
      setError("No se pueden generar el PDF sin datos.");
      return;
    }
    setPdfLoading(true);
    setError(''); 

    try {
      const pdfBlob = await generarPDFEstadoDeuda(
        unidad,
        movimientos // Le pasamos los movimientos reales
      );
      const safeNombre = unidad.nombre.replace(/ /g, '_');
      saveAs(pdfBlob, `EstadoDeuda_${safeNombre}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Error generando PDF de deuda:", err);
      setError(`Error al generar el PDF: ${err.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // --- Funciones de Formato ---
  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  // --- Fin Funciones de Formato ---

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }
  if (error) {
    return <Alert severity="error" onClose={() => setError('')}>{error}</Alert>;
  }
  if (!unidad) {
    return <Alert severity="warning">No se encontró la unidad especificada.</Alert>;
  }

  // --- Render de Fila (Helper) ---
  const renderRow = (mov, isGroupChild = false) => {
    const esBase = mov.tipo && mov.tipo.includes('_BASE');
    const esInteres = mov.tipo === 'INTERES_10' || mov.tipo === 'INTERES_BNA';
    const esPago = mov.tipo === 'PAGO_RECIBIDO';
    const esAntiguo = !mov.tipo && mov.monto < 0; // Deuda antigua

    // Estilo para indentar intereses (hijos del grupo)
    const cellStyle = isGroupChild ? { pl: 4, fontStyle: 'italic', color: '#555' } : {};
    const rowStyle = esPago ? '#f0fff0' : (esBase || esAntiguo ? '#fff0f0' : (esInteres ? '#fff9e6' : 'inherit'));

    const puedeBorrar = (esInteres || (esAntiguo && !mov.pagado)) && (mov.montoAplicado || 0) === 0;

    return (
      <TableRow
        key={mov.id}
        sx={{ '&:last-child td, &:last-child th': { border: 0 }, backgroundColor: rowStyle }}
      >
        <TableCell sx={cellStyle}>{formatDate(mov.fecha)}</TableCell>
        <TableCell sx={cellStyle}>{mov.concepto}</TableCell>
        <TableCell align="right" sx={{ ...cellStyle, color: 'red' }}>
          {mov.monto < 0 ? formatCurrency(Math.abs(mov.monto)) : '-'}
        </TableCell>
        <TableCell align="right" sx={{ ...cellStyle, color: 'green' }}>
          {mov.monto > 0 ? formatCurrency(mov.monto) : '-'}
        </TableCell>
        <TableCell align="right" sx={{ ...cellStyle, fontWeight: 'bold' }}>
          {formatCurrency(mov.saldoResultante)}
        </TableCell>
        <TableCell align="center">
          {/* 1. Botón Aplicar Interés (solo a deudas base o antiguas) */}
          {(esBase || esAntiguo) && !isGroupChild && !mov.pagado && (
            <Tooltip title={`Gestionar Mora de ${mov.mes_origen || 'Historico'}`}>
              <IconButton onClick={() => handleOpenModal(mov.mes_origen || 'Historico')} size="small" color="primary" disabled={loading}>
                <AddCircleOutlineIcon />
              </IconButton>
            </Tooltip>
          )}
          {/* 2. Botón Eliminar (solo a intereses no pagados o deudas antiguas) */}
          {puedeBorrar && (
            <Tooltip title="Eliminar Movimiento Manual">
              <IconButton onClick={() => handleDeleteMovimiento(mov)} size="small" color="error" disabled={loading}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
          {/* 3. Cupón PDF */}
          {mov.cuponURL && (
            <Tooltip title="Ver Cupón PDF">
              <IconButton href={mov.cuponURL} target="_blank" rel="noopener noreferrer" size="small" disabled={loading}>
                <DescriptionIcon />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* --- TÍTULO CON BOTÓN PDF --- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Cuenta Corriente
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={pdfLoading ? <CircularProgress size={20} color="inherit" /> : <PictureAsPdfIcon />}
          onClick={handleGenerarPDFDeuda}
          disabled={pdfLoading || !unidad || loading}
        >
          {pdfLoading ? 'Generando...' : 'Informe de Deuda'}
        </Button>
      </Box>

      {/* Datos de la Unidad */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f0f0f0' }}>
        <Typography variant="h6">{unidad.nombre}</Typography>
        <Typography variant="body1">Propietario: {unidad.propietario}</Typography>
        <Typography variant="h5" sx={{ mt: 1, color: unidad.saldo < 0 ? 'red' : 'green', fontWeight: 'bold' }}>
          Saldo Actual: {formatCurrency(unidad.saldo)}
        </Typography>
      </Paper>

      {/* Tabla de Movimientos */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Historial de Movimientos</Typography>
        <TableContainer>
          <Table stickyHeader sx={{ minWidth: 750 }} aria-label="tabla de cuenta corriente" size="small">
            <TableHead sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Concepto</TableCell>
                <TableCell align="right">Débito</TableCell>
                <TableCell align="right">Crédito</TableCell>
                <TableCell align="right">Saldo Resultante</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movimientosAgrupados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No hay movimientos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                movimientosAgrupados.map((item) => {
                  // Si es un grupo de movimientos (Base + Intereses)
                  if (Array.isArray(item)) {
                    return item.map((mov, index) => {
                      // El primer item (index 0) es el padre (Base)
                      // Los siguientes (index > 0) son los hijos (Intereses)
                      return renderRow(mov, index > 0);
                    });
                  }
                  // Si es un item suelto (Pago o Deuda Antigua)
                  else {
                    return renderRow(item, false);
                  }
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* El Modal para aplicar interés */}
      <GestionMoraModal
        open={modalOpen}
        onClose={handleCloseModal}
        unidadId={unidadId}
        mesOrigen={mesOrigenSeleccionado}
        todosMovimientos={movimientos} // Pasamos todos los movimientos al modal
      />
    </Box>
  );
}

export default CuentaCorrientePage;