import React from 'react';
import { logout } from '../../services/authService';
import { useNavigate, Link, Outlet } from 'react-router-dom'; // <-- IMPORTANTE

function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    }
  };

  // --- Estilos para el layout ---
  const layoutStyle = {
    display: 'flex',
    minHeight: '100vh',
  };

  const sidebarStyle = {
    width: '220px',
    background: '#f4f4f4',
    padding: '20px',
    borderRight: '1px solid #ddd',
  };

  const navLinkStyle = {
    display: 'block',
    padding: '10px 15px',
    textDecoration: 'none',
    color: '#333',
    borderRadius: '5px',
    marginBottom: '10px',
  };
  
  const contentStyle = {
    flex: 1,
    padding: '20px',
    maxWidth: '1000px',
    margin: '0 auto',
  };
  // --- Fin de Estilos ---


  return (
    <div style={layoutStyle}>
      {/* 1. Barra Lateral (Sidebar) */}
      <nav style={sidebarStyle}>
        <h3>Sistema Consorcio</h3>
        <Link to="/admin/gastos" style={navLinkStyle}>
          Gastos
        </Link>
        <Link to="/admin/propietarios" style={navLinkStyle}>
          Propietarios
        </Link>
        <button 
          onClick={handleLogout} 
          style={{ ...navLinkStyle, background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
        >
          Cerrar Sesión
        </button>
      </nav>

      {/* 2. Contenido Principal (donde se cargan las páginas) */}
      <main style={contentStyle}>
        {/* Outlet le dice a React Router dónde renderizar las "sub-páginas" */}
        <Outlet /> 
      </main>
    </div>
  );
}

export default AdminLayout;