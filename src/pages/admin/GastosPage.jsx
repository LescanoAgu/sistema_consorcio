import React, { useState } from 'react';
import CargaGastosForm from '../../components/CargaGastosForm';
import GastosList from '../../components/GastosList';
import EditGastoModal from '../../components/EditGastoModal';
import { useConsorcio } from '../../hooks/useConsorcio'; // <-- ESTA LÍNEA FALTABA
import { Box } from '@mui/material';

function GastosPage() {
  const { consorcioId } = useConsorcio(); // <-- Esta es la línea 2 que daba el error
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null);

  const handleOpenEditModal = (gasto) => {
    setGastoSeleccionado(gasto);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setGastoSeleccionado(null);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <CargaGastosForm />
      <GastosList onEdit={handleOpenEditModal} />

      {/* Le pasamos el consorcioId al Modal */}
      <EditGastoModal
        open={isModalOpen && !!gastoSeleccionado}
        onClose={handleCloseModal}
        gastoToEdit={gastoSeleccionado}
        consorcioId={consorcioId} 
      />
    </Box>
  );
}

export default GastosPage;