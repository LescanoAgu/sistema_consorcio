import React, { useState } from 'react'; // <-- CORREGIDO: Importar useState
import { logout } from '../../services/authService';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import WarningIcon from '@mui/icons-material/Warning';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import HistoryIcon from '@mui/icons-material/History';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

// Importar los servicios de reseteo
import { resetearTodosLosGastos } from '../../services/gastosService';
import { resetearSaldosUnidades } from '../../services/propietariosService';

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
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

// --- Iconos para el menú ---
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import LogoutIcon from '@mui/icons-material/Logout';
// --- FIN IMPORTACIONES MUI ---

const drawerWidth = 240;

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
    const location = useLocation();
    const [resetLoading, setResetLoading] = useState(false); // <--- Ahora useState está definido
    const [resetMessage, setResetMessage] = useState(''); // <--- Ahora useState está definido
    const [resetError, setResetError] = useState(false); // <--- Ahora useState está definido

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Error al cerrar sesión', err);
        }
    };

    const handleResetTotal = async () => {
        setResetMessage('');
        setResetError(false);
        if (!window.confirm("ADVERTENCIA EXTREMA:\n¿Está SEGURO de que desea borrar TODOS los gastos registrados?")) return;
        if (!window.confirm("SEGUNDA ADVERTENCIA:\nEsta acción también intentará borrar los PDFs asociados en Storage. ¿Continuar?")) return;
        if (!window.confirm("TERCERA ADVERTENCIA:\nAhora se resetearán los saldos de TODAS las unidades a CERO y se borrará TODO el historial de sus cuentas corrientes. ¿Continuar?")) return;
        if (!window.confirm("¡¡¡ÚLTIMA CONFIRMACIÓN!!!\n¿Proceder con el reseteo TOTAL e IRREVERSIBLE de gastos y saldos?")) return;

        setResetLoading(true);
        try {
            const gastosBorrados = await resetearTodosLosGastos();
            const { unidadesActualizadas, movimientosBorrados } = await resetearSaldosUnidades();
            setResetMessage(`¡RESETEO COMPLETADO! Gastos borrados: ${gastosBorrados}. Saldos reseteados: ${unidadesActualizadas}. Movimientos Cta. Cte. borrados: ${movimientosBorrados}. Refresca la página si es necesario.`);
            setResetError(false);
        } catch (err) {
            console.error("ERROR DURANTE EL RESETEO TOTAL:", err);
            setResetMessage(`ERROR DURANTE EL RESETEO: ${err.message}`);
            setResetError(true);
        } finally {
            setResetLoading(false);
        }
    };

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
                <List>
                    {menuItems.map((item) => (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={Link}
                                to={item.path}
                                selected={location.pathname === item.path}
                            >
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
                <Divider />
                <Box sx={{ marginTop: 'auto', p: 1 }}>
                    {resetMessage && (
                        <Alert severity={resetError ? "error" : "success"} sx={{ mb: 1 }}>
                            {resetMessage}
                        </Alert>
                    )}
                    <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        startIcon={resetLoading ? <CircularProgress size={20} color="inherit" /> : <DeleteForeverIcon />}
                        onClick={handleResetTotal}
                        disabled={resetLoading}
                        sx={{ mb: 1 }}
                    >
                        {resetLoading ? 'Reseteando...' : '¡RESETEAR TODO! (DEV)'}
                    </Button>
                    <List dense disablePadding>
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleLogout}>
                                <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                                    <LogoutIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Cerrar Sesión" primaryTypographyProps={{ fontSize: '0.9rem' }} />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
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