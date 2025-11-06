import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth'; //

// Importamos las páginas
import LoginPage from './pages/LoginPage'; //
import AdminLayout from './pages/admin/AdminLayout'; //
import GastosPage from './pages/admin/GastosPage'; //
import PropietariosPage from './pages/admin/PropietariosPage'; //
import LiquidacionPage from './pages/admin/LiquidacionPage'; //
import DeudoresPage from './pages/admin/DeudoresPage'; //
import CobranzasPage from './pages/admin/CobranzasPage'; //
import CuentaCorrientePage from './pages/admin/CuentaCorrientePage'; //
import HistorialLiquidacionesPage from './pages/admin/HistorialLiquidacionesPage'; //
import FondoReservaPage from './pages/admin/FondoReservaPage'; //

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
        
        {/* --- RUTA DE ADMIN MODIFICADA --- */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          {/* Redirige /admin a /admin/propietarios por defecto */}
          <Route index element={<Navigate to="propietarios" replace />} /> 
          
          {/* Nivel Superior */}
          <Route path="propietarios" element={<PropietariosPage />} />
          
          {/* Módulo Liquidación */}
          {/* <Route path="liquidacion" element={<Outlet />}> */} {/* Opcional si quieres una página padre */}
            <Route path="liquidacion/gastos" element={<GastosPage />} />
            <Route path="liquidacion/generar" element={<LiquidacionPage />} />
            <Route path="liquidacion/historial" element={<HistorialLiquidacionesPage />} />
          {/* </Route> */}

          {/* Módulo Estado de Cuenta */}
          {/* <Route path="estado-cuenta" element={<Outlet />}> */}
            <Route path="estado-cuenta/cobranzas" element={<CobranzasPage />} />
            <Route path="estado-cuenta/deudores" element={<DeudoresPage />} />
          {/* </Route> */}
          
          {/* Ruta de Cta. Cte. (la dejamos en admin/ para acceso fácil desde historial) */}
          <Route path="cuenta-corriente/:unidadId" element={<CuentaCorrientePage />} />
        
          {/* Módulo Fondo de Reserva */}
          <Route path="fondo-reserva" element={<FondoReservaPage />} />

        </Route>
        
        {/* Ruta por defecto */}
        <Route 
          path="*" 
          element={<Navigate to={user ? "/admin" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;