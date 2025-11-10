import React, { useState } from 'react';
import { logout } from '../../services/authService';
import { useNavigate, Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useConsorcio } from '../../hooks/useConsorcio'; // <-- NUEVO HOOK

// --- IMPORTACIONES DE MUI ---
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Button,
  CircularProgress, Alert, Collapse,
  Select, MenuItem, FormControl // <-- Para el selector
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
import ApartmentIcon from '@mui/icons-material/Apartment'; // <-- Icono para Consorcio

// Importar los servicios de reseteo
import { resetearTodosLosGastos } from '../../services/gastosService';
import { resetearSaldosUnidades, resetearFondoReserva } from '../../services/propietariosService';
import { resetearTodasLasLiquidaciones } from '../../services/liquidacionService';
import { resetearHistorialFondo } from '../../services/fondoService';

const drawerWidth = 240;

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { consorcioId, consorcios, setConsorcioId, consorcioActivo } = useConsorcio(); // <-- USAMOS EL HOOK
  
  const [openLiquidacion, setOpenLiquidacion] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState(false);

  // ... (handleLogout, handleResetTotal, renderMenuItem sin cambios)

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
      // Opcional: Redirigir a una página de inicio limpia después de cambiar
      navigate('/admin/propietarios'); 
  };


  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        // La AppBar se extiende para incluir el selector
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }} 
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}> {/* <-- Añadimos justificado */}
          <Typography variant="h6" noWrap component="div">
            Panel de Administración
          </Typography>
          
          {/* --- SELECTOR DE CONSORCIO (NUEVO) --- */}
          {consorcioActivo && consorcios.length > 1 && (
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
              <Select
                value={consorcioId}
                onChange={handleChangeConsorcio}
                displayEmpty
                inputProps={{ 'aria-label': 'Without label' }}
                sx={{ color: 'white', '& .MuiSelect-icon': { color: 'white' } }}
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
            {consorcioActivo ? consorcioActivo.nombre : 'Sistema Consorcio'} {/* <-- Mostramos el nombre */}
          </Typography>
        </Toolbar>
        <Divider />
        
        {/* --- LISTA DE MENÚ --- */}
        <List>
          {renderMenuItem('Propietarios', <PeopleIcon />, '/admin/propietarios')}
          <Divider sx={{ my: 1 }} />
          {/* ... (Menú Liquidación sin cambios) ... */}
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
        
        <Box sx={{ marginTop: 'auto', p: 1 }}>
          {/* ... (Botones de Reseteo y Logout sin cambios) ... */}
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, maxWidth: '1400px' }}
      >
        <Toolbar />
        {/* El Outlet renderizará las rutas anidadas */}
        <Outlet /> 
      </Box>
    </Box>
  );
}

export default AdminLayout;