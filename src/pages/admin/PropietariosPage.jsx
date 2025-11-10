import React from 'react';
import CargaPropietarioForm from '../../components/CargaPropietarioForm';
import PropietariosList from '../../components/PropietariosList';
import ImportPropietarios from '../../components/ImportPropietarios'; // <-- 1. IMPORTAR

function PropietariosPage() {
  return (
    <div>
      <h2>Módulo de Propietarios y Unidades</h2>
      
      {/* Formulario para cargar una unidad */}
      <CargaPropietarioForm />
      
      {/* Componente nuevo para importar masivamente */}
      <ImportPropietarios /> 
      
      {/* Lista de unidades existentes */}
      <PropietariosList />
    </div>
  );
}

export default PropietariosPage;