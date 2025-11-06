import React, { useState } from 'react';
import { logout } from '../../services/authService'; //
import { useNavigate, Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

// --- IMPORTACIONES DE MUI (Añadimos Collapse, ExpandLess, ExpandMore) ---
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Button,
  CircularProgress, Alert, Collapse
} from '@mui/material';

// --- Iconos (Añadimos nuevos para los menús) ---
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import HistoryIcon from '@mui/icons-material/History';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'; // Para Estado de Cuenta
import CalculateIcon from '@mui/icons-material/Calculate'; // Para Liquidación (Padre)
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';


// Importar los servicios de reseteo (Sin cambios)
import { resetearTodosLosGastos } from '../../services/gastosService'; //
import { resetearSaldosUnidades, resetearFondoReserva } from '../../services/propietariosService'; //
import { resetearTodasLasLiquidaciones } from '../../services/liquidacionService'; //

const drawerWidth = 240;

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Estados para los menús desplegables ---
  const [openLiquidacion, setOpenLiquidacion] = useState(true); // Abierto por defecto
  const [openEstadoCuenta, setOpenEstadoCuenta] = useState(true); // Abierto por defecto

  // Estados del reseteo (Sin cambios)
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState(false);

  const handleLogout = async () => { /* ... (Sin cambios) */ };
  const handleResetTotal = async () => { /* ... (Sin cambios) */ };

  // --- Render del Menú Desplegable ---
  const renderMenuItem = (text, icon, path, isChild = false) => (
    <ListItem key={text} disablePadding sx={{ display: 'block' }}>
      <ListItemButton
        component={RouterLink}
        to={path}
        selected={location.pathname === path}
        // Aplicamos sangría si es un sub-menú
        sx={{ pl: isChild ? 4 : 2 }} 
      >
        <ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center' }}>
          {icon}
        </ListItemIcon>
        <ListItemText primary={text} />
      </ListItemButton>
    </ListItem>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Panel de Administración
          </Typography>
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
            Sistema Consorcio
          </Typography>
        </Toolbar>
        <Divider />
        
        {/* --- LISTA DE MENÚ MODIFICADA --- */}
        <List>
          {/* 1. Propietarios (Nivel Superior) */}
          {renderMenuItem('Propietarios', <PeopleIcon />, '/admin/propietarios')}
          
          <Divider sx={{ my: 1 }} />

          {/* 2. Liquidación (Menú Padre) */}
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

          {/* 3. Estado de Cuenta (Menú Padre) */}
          <ListItemButton onClick={() => setOpenEstadoCuenta(!openEstadoCuenta)} sx={{ pl: 2 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center' }}>
              <AccountBalanceIcon />
            </ListItemIcon>
            <ListItemText primary="Estado de Cuenta" />
            {openEstadoCuenta ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={openEstadoCuenta} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {renderMenuItem('Cobranzas', <PointOfSaleIcon />, '/admin/estado-cuenta/cobranzas', true)}
              {renderMenuItem('Deudores', <WarningIcon />, '/admin/estado-cuenta/deudores', true)}
            </List>
          </Collapse>

          <Divider sx={{ my: 1 }} />
          {renderMenuItem('Fondo de Reserva', <AttachMoneyIcon />, '/admin/fondo-reserva' )}

        </List>
        {/* --- FIN LISTA DE MENÚ --- */}
        
        <Divider />
        <Box sx={{ marginTop: 'auto', p: 1 }}>
          {/* ... (Tu código del botón de Reseteo y Cerrar Sesión va aquí, sin cambios) ... */}
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