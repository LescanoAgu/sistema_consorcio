import React from 'react';
import CargaGastosForm from '../../components/CargaGastosForm';
import GastosList from '../../components/GastosList';

function GastosPage() {
  return (
    <div>
      <h2>Módulo de Gastos</h2>
      <CargaGastosForm />
      <GastosList />
    </div>
  );
}

export default GastosPage;