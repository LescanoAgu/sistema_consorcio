import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth'; 

// Importamos las páginas
import LoginPage from './pages/LoginPage'; 
import AdminLayout from './pages/admin/AdminLayout'; 
import GastosPage from './pages/admin/GastosPage'; 
import PropietariosPage from './pages/admin/PropietariosPage'; 
import LiquidacionPage from './pages/admin/LiquidacionPage'; 
import CobranzasPage from './pages/admin/CobranzasPage'; 
import CuentaCorrientePage from './pages/admin/CuentaCorrientePage'; 
import HistorialLiquidacionesPage from './pages/admin/HistorialLiquidacionesPage'; 
import FondoReservaPage from './pages/admin/FondoReservaPage'; 
import TasasInteresPage from './pages/admin/TasasInteresPage'; // <-- IMPORT CORRECTO

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/admin" replace /> : <LoginPage />} 
        />
        
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<Navigate to="propietarios" replace />} /> 
          
          <Route path="propietarios" element={<PropietariosPage />} />
          
          <Route path="liquidacion/gastos" element={<GastosPage />} />
          <Route path="liquidacion/generar" element={<LiquidacionPage />} />
          <Route path="liquidacion/historial" element={<HistorialLiquidacionesPage />} />

          <Route path="estado-cuenta/cobranzas" element={<CobranzasPage />} />
          
          <Route path="cuenta-corriente/:unidadId" element={<CuentaCorrientePage />} />
        
          <Route path="fondo-reserva" element={<FondoReservaPage />} />

          {/* Módulo de Configuración de Tasas */}
          <Route path="configuracion/tasas" element={<TasasInteresPage />} /> {/* <-- RUTA CORRECTA */}

        </Route>
        
        <Route 
          path="*" 
          element={<Navigate to={user ? "/admin" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;