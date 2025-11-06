import React, { useState } from 'react';
import { logout } from '../../services/authService'; //
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import WarningIcon from '@mui/icons-material/Warning';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import HistoryIcon from '@mui/icons-material/History';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

// --- IMPORTACIONES DE RESETEO ACTUALIZADAS ---
import { resetearTodosLosGastos } from '../../services/gastosService'; //
import { resetearSaldosUnidades, resetearFondoReserva } from '../../services/propietariosService'; // <-- Añadido resetearFondoReserva
import { resetearTodasLasLiquidaciones } from '../../services/liquidacionService'; // <-- ¡NUEVA IMPORTACIÓN!

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
        // Advertencias actualizadas
        if (!window.confirm("ADVERTENCIA EXTREMA:\n¿Está SEGURO de que desea borrar TODOS los gastos, liquidaciones, y saldos de unidades?")) return;
        if (!window.confirm("SEGUNDA ADVERTENCIA:\nEsta acción borrará las facturas PDF asociadas a los gastos, pero NO los cupones PDF de las liquidaciones (eso debe hacerlo manual). ¿Continuar?")) return;
        if (!window.confirm("¡¡¡ÚLTIMA CONFIRMACIÓN!!!\n¿Proceder con el reseteo TOTAL e IRREVERSIBLE de gastos, saldos, ctas. ctes., fondo de reserva y documentos de liquidación?")) return;

        setResetLoading(true);
        try {
            // 1. Borra gastos Y sus PDFs de facturas
            const gastosBorrados = await resetearTodosLosGastos();
            
            // 2. Borra saldos de unidades Y sus ctas. ctes.
            const { unidadesActualizadas, movimientosBorrados } = await resetearSaldosUnidades();
            
            // 3. ¡NUEVO! Borra los documentos de liquidaciones
            const liquidacionesBorradas = await resetearTodasLasLiquidaciones();

            // 4. ¡NUEVO! Resetea el Fondo de Reserva a 0
            const fondoReseteado = await resetearFondoReserva();

            // Mensaje de éxito actualizado
            setResetMessage(`¡RESETEO COMPLETADO! 
                Gastos borrados: ${gastosBorrados}. 
                Saldos reseteados: ${unidadesActualizadas}. 
                Mov. Cta. Cte. borrados: ${movimientosBorrados}. 
                Liquidaciones borradas: ${liquidacionesBorradas}. 
                Fondo reseteado: ${fondoReseteado}.`);
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