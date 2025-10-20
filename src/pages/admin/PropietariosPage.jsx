import React from 'react';
import CargaPropietarioForm from '../../components/CargaPropietarioForm';
import PropietariosList from '../../components/PropietariosList';

function PropietariosPage() {
  return (
    <div>
      <h2>Módulo de Propietarios y Unidades</h2>
      <CargaPropietarioForm />
      <PropietariosList />
    </div>
  );
}

export default PropietariosPage;