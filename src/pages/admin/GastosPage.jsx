import React, { useState } from 'react'; // Importa useState
import CargaGastosForm from '../../components/CargaGastosForm';
import GastosList from '../../components/GastosList';
import EditGastoModal from '../../components/EditGastoModal'; // <-- Importa el Modal
import { Box } from '@mui/material';

function GastosPage() {
  // Estado para manejar el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null);

  // Función para abrir el modal con los datos del gasto
  const handleOpenEditModal = (gasto) => {
    setGastoSeleccionado(gasto);
    setIsModalOpen(true);
  };

  // Función para cerrar el modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setGastoSeleccionado(null); // Limpiar el gasto seleccionado al cerrar
  };

  // No necesitamos handleUpdateGasto aquí, el modal se encarga de llamar al servicio

  return (
    <Box sx={{ width: '100%' }}>
      <CargaGastosForm />
      {/* Pasamos la función para abrir el modal a GastosList */}
      <GastosList onEdit={handleOpenEditModal} />

      {/* Renderizamos el Modal */}
      {/* Solo se mostrará si isModalOpen es true y hay un gasto seleccionado */}
      <EditGastoModal
        open={isModalOpen && !!gastoSeleccionado}
        onClose={handleCloseModal}
        gastoToEdit={gastoSeleccionado}
      />
    </Box>
  );
}

export default GastosPage;