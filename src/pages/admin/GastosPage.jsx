// src/pages/admin/GastosPage.jsx
import React from 'react';
import CargaGastosForm from '../../components/CargaGastosForm';
import GastosList from '../../components/GastosList';
import { Box } from '@mui/material'; // Usamos Box para el layout

function GastosPage() {
  return (
    // Los títulos (h2) ahora están dentro de los componentes de Form y List
    <Box sx={{ width: '100%' }}>
      <CargaGastosForm />
      <GastosList />
    </Box>
  );
}

export default GastosPage;