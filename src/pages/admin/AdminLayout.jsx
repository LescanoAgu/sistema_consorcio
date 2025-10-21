import React from 'react';
import { logout } from '../../services/authService';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import WarningIcon from '@mui/icons-material/Warning';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'; 
import HistoryIcon from '@mui/icons-material/History';
// --- IMPORTACIONES DE MUI ---
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';

// --- Iconos para el menú ---
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import LogoutIcon from '@mui/icons-material/Logout';
// --- FIN IMPORTACIONES MUI ---

const drawerWidth = 240; // Ancho del menú lateral

// Definimos los items del menú
const menuItems = [
  { text: 'Gastos', path: '/admin/gastos', icon: <ReceiptLongIcon /> },
  { text: 'Propietarios', path: '/admin/propietarios', icon: <PeopleIcon /> },
  { text: 'Liquidación', path: '/admin/liquidacion', icon: <RequestQuoteIcon /> },
  { text: 'Deudores', path: '/admin/deudores', icon: <WarningIcon /> },
  { text: 'Cobranzas', path: '/admin/cobranzas', icon: <PointOfSaleIcon /> },
  { text: 'Historial Liquidaciones', path: '/admin/historial-liquidaciones', icon: <HistoryIcon /> },
];

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation(); // Para saber qué item del menú resaltar

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* 1. Barra Superior (AppBar) */}
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

      {/* 2. Menú Lateral (Drawer) */}
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
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              {/* Usamos 'component={Link}' para que funcione con React Router */}
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname === item.path} // Resalta el item actual
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        {/* Botón de Logout (abajo de todo) */}
        <Box sx={{ marginTop: 'auto' }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Cerrar Sesión" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* 3. Contenido Principal (donde va el <Outlet>) */}
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, maxWidth: '1400px' }}
      >
        <Toolbar /> {/* Un espacio para que el contenido no quede debajo del AppBar */}
        
        {/* Aquí se cargan las páginas: GastosPage, PropietariosPage, etc. */}
        <Outlet /> 
      </Box>
    </Box>
  );
}

export default AdminLayout;