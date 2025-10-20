import React, { useState, useEffect } from 'react';
import { getGastos } from '../services/gastosService';

function GastosList() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Nos suscribimos al servicio de gastos
    const unsubscribe = getGastos((gastosNuevos) => {
      setGastos(gastosNuevos);
      setLoading(false);
    });

    // 2. Cuando el componente se "desmonte", nos desuscribimos
    //    para evitar gastar recursos.
    return () => unsubscribe();
  }, []); // El array vacío [] significa que esto se ejecuta solo una vez

  // Función para formatear el monto a moneda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  if (loading) {
    return <p>Cargando lista de gastos...</p>;
  }

  return (
    <div style={{ marginTop: '40px' }}>
      <h3>Gastos Cargados</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid black' }}>
            <th style={{ textAlign: 'left', padding: '8px' }}>Fecha</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Concepto</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Proveedor</th>
            <th style={{ textAlign: 'right', padding: '8px' }}>Monto</th>
            <th style={{ textAlign: 'center', padding: '8px' }}>Factura</th>
          </tr>
        </thead>
        <tbody>
          {gastos.map((gasto) => (
            <tr key={gasto.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '8px' }}>{gasto.fecha}</td>
              <td style={{ padding: '8px' }}>{gasto.concepto}</td>
              <td style={{ padding: '8px' }}>{gasto.proveedor}</td>
              <td style={{ textAlign: 'right', padding: '8px' }}>
                {formatCurrency(gasto.monto)}
              </td>
              <td style={{ textAlign: 'center', padding: '8px' }}>
                {/* gasto.facturaURL es el link al PDF que guardamos.
                  target="_blank" rel="noopener noreferrer" es por seguridad
                  y para que abra en una pestaña nueva.
                */}
                <a href={gasto.facturaURL} target="_blank" rel="noopener noreferrer">
                  Ver PDF
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GastosList;