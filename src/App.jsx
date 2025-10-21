import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Importamos las páginas
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import GastosPage from './pages/admin/GastosPage';
import PropietariosPage from './pages/admin/PropietariosPage';
import LiquidacionPage from './pages/admin/LiquidacionPage';
import DeudoresPage from './pages/admin/DeudoresPage';
import CobranzasPage from './pages/admin/CobranzasPage';
import CuentaCorrientePage from './pages/admin/CuentaCorrientePage';
import HistorialLiquidacionesPage from './pages/admin/HistorialLiquidacionesPage'; 

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
          {/* Estas son las "rutas anidadas" que se renderizan en el <Outlet> */}
          
          {/* Redirige /admin a /admin/gastos por defecto */}
          <Route index element={<Navigate to="gastos" replace />} /> 
          
          <Route path="gastos" element={<GastosPage />} />
          <Route path="propietarios" element={<PropietariosPage />} />
          <Route path="liquidacion" element={<LiquidacionPage />} />
          <Route path="deudores" element={<DeudoresPage />} />
          <Route path="cobranzas" element={<CobranzasPage />} />
          <Route path="cuenta-corriente/:unidadId" element={<CuentaCorrientePage />} />
          <Route path="historial-liquidaciones" element={<HistorialLiquidacionesPage />} />
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