import React, { useState } from 'react';
import { logout } from '../../services/authService';
import { useNavigate, Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useConsorcio } from '../../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK

// --- IMPORTACIONES DE MUI ---
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Button,
  CircularProgress, Alert, Collapse,
  Select, MenuItem, FormControl
} from '@mui/material';

// --- Iconos ---
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import LogoutIcon from '@mui/icons-material/Logout';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import HistoryIcon from '@mui/icons-material/History';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CalculateIcon from '@mui/icons-material/Calculate';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SettingsIcon from '@mui/icons-material/Settings'; 
import ApartmentIcon from '@mui/icons-material/Apartment';

// Importar los servicios de reseteo
import { resetearTodosLosGastos } from '../../services/gastosService';
import { resetearSaldosUnidades, resetearFondoReserva } from '../../services/propietariosService';
import { resetearTodasLasLiquidaciones } from '../../services/liquidacionService';
import { resetearHistorialFondo } from '../../services/fondoService';

const drawerWidth = 240;

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  // 2. OBTENER CONSORCIO ACTIVO (ID Y OBJETO COMPLETO)
  const { consorcioId, consorcios, setConsorcioId, consorcioActivo } = useConsorcio(); 
  
  const [openLiquidacion, setOpenLiquidacion] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState(false);

  // 3. IMPLEMENTAR LOGOUT
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('Error al cerrar sesión');
    }
  };

  // 4. IMPLEMENTAR RESET TOTAL (CON TODAS LAS VALIDACIONES)
  const handleResetTotal = async () => {
    setResetLoading(true);
    setResetMessage('');
    setResetError(false);

    if (!consorcioId || !consorcioActivo) {
      setResetMessage('Error: No hay un consorcio seleccionado.');
      setResetError(true);
      setResetLoading(false);
      return;
    }

    const consorcioNombre = consorcioActivo.nombre;
    const confirm1 = window.prompt(`Está a punto de BORRAR TODOS LOS DATOS (Gastos, Liquidaciones, Cuentas Corrientes, Fondo) del consorcio "${consorcioNombre}". Esta acción no se puede deshacer. Escriba el nombre del consorcio para confirmar:`);

    if (confirm1 !== consorcioNombre) {
      setResetMessage('Cancelado. El nombre no coincide.');
      setResetError(true);
      setResetLoading(false);
      return;
    }
    
    const confirm2 = window.confirm("¡ADVERTENCIA FINAL! ¿Está ABSOLUTAMENTE seguro de que desea borrar todos los datos?");
    if (!confirm2) {
      setResetMessage('Cancelado.');
      setResetLoading(false);
      return;
    }

    try {
      setResetMessage('Iniciando reseteo...');
      
      // El orden es importante para evitar errores de referencias
      
      // 1. Borrar Liquidaciones
      setResetMessage('Borrando liquidaciones...');
      const liqCount = await resetearTodasLasLiquidaciones(consorcioId);
      
      // 2. Borrar Gastos (y PDFs)
      setResetMessage('Borrando gastos...');
      const gastosCount = await resetearTodosLosGastos(consorcioId);
      
      // 3. Resetear Saldos de Unidades (borra cta. cte.)
      setResetMessage('Reseteando saldos de unidades...');
      const { unidadesActualizadas, movimientosBorrados } = await resetearSaldosUnidades(consorcioId);
      
      // 4. Borrar Historial del Fondo
      setResetMessage('Borrando historial del fondo...');
      const fondoHistCount = await resetearHistorialFondo(consorcioId);
      
      // 5. Resetear Saldo del Fondo a 0
      setResetMessage('Reseteando saldo del fondo...');
      await resetearFondoReserva(consorcioId);

      setResetMessage(`¡Reseteo completado para ${consorcioNombre}! ${liqCount} liquidaciones, ${gastosCount} gastos, ${movimientosBorrados} movimientos y ${fondoHistCount} movimientos de fondo eliminados. ${unidadesActualizadas} unidades reseteadas a saldo $0.`);

    } catch (error) {
      console.error("Error en el reseteo total:", error);
      setResetMessage(`Error: ${error.message}`);
      setResetError(true);
    } finally {
      setResetLoading(false);
    }
  };


  // --- Render del Menú Desplegable ---
  const renderMenuItem = (text, icon, path, isChild = false) => (
    <ListItem key={text} disablePadding sx={{ display: 'block' }}>
      <ListItemButton
        component={RouterLink}
        to={path}
        selected={location.pathname === path}
        sx={{ pl: isChild ? 4 : 2 }} 
      >
        <ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center' }}>
          {icon}
        </ListItemIcon>
        <ListItemText primary={text} />
      </ListItemButton>
    </ListItem>
  );
  
  // Manejador del cambio de selector
  const handleChangeConsorcio = (event) => {
      setConsorcioId(event.target.value);
      navigate('/admin/propietarios'); 
  };


  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }} 
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap component="div">
            Panel de Administración
          </Typography>
          
          {/* --- SELECTOR DE CONSORCIO --- */}
          {consorcioActivo && ( // Mostramos el selector incluso si solo hay 1
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
              <Select
                value={consorcioId}
                onChange={handleChangeConsorcio}
                displayEmpty
                inputProps={{ 'aria-label': 'Without label' }}
                sx={{ 
                  color: 'white', 
                  '& .MuiSelect-icon': { color: 'white' },
                  '&:before': { borderColor: 'white' },
                  '&:after': { borderColor: 'white' },
                  '.MuiSelect-standard': {
                    color: 'white'
                  }
                }}
              >
                {consorcios.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <ApartmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
                    {c.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {/* --- FIN SELECTOR --- */}

        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            {consorcioActivo ? consorcioActivo.nombre : 'Cargando...'}
          </Typography>
        </Toolbar>
        <Divider />
        
        {/* --- LISTA DE MENÚ --- */}
        <List>
          {renderMenuItem('Propietarios', <PeopleIcon />, '/admin/propietarios')}
          <Divider sx={{ my: 1 }} />
          {/* ... (Menú Liquidación) ... */}
          <ListItemButton onClick={() => setOpenLiquidacion(!openLiquidacion)} sx={{ pl: 2 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center' }}>
              <CalculateIcon />
            </ListItemIcon>
            <ListItemText primary="Liquidación" />
            {openLiquidacion ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={openLiquidacion} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {renderMenuItem('Gastos', <ReceiptLongIcon />, '/admin/liquidacion/gastos', true)}
              {renderMenuItem('Generar Liquidación', <RequestQuoteIcon />, '/admin/liquidacion/generar', true)}
              {renderMenuItem('Historial', <HistoryIcon />, '/admin/liquidacion/historial', true)}
            </List>
          </Collapse>
          <Divider sx={{ my: 1 }} />
          {renderMenuItem('Cobranzas', <PointOfSaleIcon />, '/admin/estado-cuenta/cobranzas')}
          <Divider sx={{ my: 1 }} />
          {renderMenuItem('Fondo de Reserva', <AttachMoneyIcon />, '/admin/fondo-reserva' )}
          
          <Divider sx={{ my: 1 }} />
          {renderMenuItem('Configurar Tasas', <SettingsIcon />, '/admin/configuracion/tasas')}
        </List>
        {/* --- FIN LISTA DE MENÚ --- */}
        
        <Divider />
        
        {/* --- 5. ZONA DE BOTONES (AHORA FUNCIONAL) --- */}
        <Box sx={{ marginTop: 'auto', p: 2 }}>
          {/* Mensajes de Reseteo */}
          {resetLoading && <CircularProgress size={20} />}
          {resetMessage && (
            <Alert severity={resetError ? 'error' : 'success'} sx={{ mb: 1 }}>
              {resetMessage}
            </Alert>
          )}
        
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            fullWidth
            onClick={handleResetTotal}
            disabled={resetLoading || !consorcioId} // Deshabilitado si no hay consorcio
            sx={{ mb: 1 }}
          >
            {resetLoading ? 'Reseteando...' : 'Reiniciar Consorcio'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            fullWidth
            onClick={handleLogout} // Conectar logout
          >
            Cerrar Sesión
          </Button>
        </Box>
        {/* --- FIN ZONA DE BOTONES --- */}
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, maxWidth: '1400px' }}
      >
        <Toolbar />
        <Outlet /> 
      </Box>
    </Box>
  );
}

export default AdminLayout;