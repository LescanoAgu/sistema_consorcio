import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ConsorcioProvider } from './context/ConsorcioContext'; // <-- NUEVA IMPORTACIÓN

// --- IMPORTACIONES NUEVAS DE MUI ---
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
// --- FIN IMPORTACIONES NUEVAS ---

// Creamos un tema básico (puedes personalizar colores aquí más tarde)
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Un azul estándar
    },
    secondary: {
      main: '#dc004e', // Un rosa
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos todo con el Tema de MUI */}
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Agrega el reseteo de CSS */}
      <AuthProvider>
        <ConsorcioProvider> {/* <-- NUEVO PROVEEDOR (Debe estar DENTRO de AuthProvider) */}
          <App />
        </ConsorcioProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);