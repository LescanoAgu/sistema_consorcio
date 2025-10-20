import React, { useState, useEffect } from 'react';
import { getUnidades } from '../services/propietariosService';

function PropietariosList() {
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = getUnidades((unidadesNuevas) => {
      setUnidades(unidadesNuevas);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };
  
  const formatPercent = (value) => {
    // Multiplica por 100 y muestra 4 decimales
    return (value * 100).toFixed(4) + ' %';
  };

  if (loading) {
    return <p>Cargando lista de unidades...</p>;
  }

  return (
    <div style={{ marginTop: '40px' }}>
      <h3>Unidades Cargadas</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid black' }}>
            <th style={{ textAlign: 'left', padding: '8px' }}>Unidad</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Propietario</th>
            <th style={{ textAlign: 'right', padding: '8px' }}>Porcentaje</th>
            <th style={{ textAlign: 'right', padding: '8px' }}>Saldo Actual</th>
          </tr>
        </thead>
        <tbody>
          {unidades.map((unidad) => (
            <tr key={unidad.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '8px' }}>{unidad.nombre}</td>
              <td style={{ padding: '8px' }}>{unidad.propietario}</td>
              <td style={{ textAlign: 'right', padding: '8px' }}>
                {/* Lo guardamos como 0.1188 pero lo mostramos como 11.88% */}
                {formatPercent(unidad.porcentaje)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px' }}>
                {formatCurrency(unidad.saldo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PropietariosList;