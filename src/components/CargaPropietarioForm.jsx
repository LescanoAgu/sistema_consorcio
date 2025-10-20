import React, { useState } from 'react';
import { crearUnidad } from '../services/propietariosService';

function CargaPropietarioForm() {
  const [nombre, setNombre] = useState('');
  const [propietario, setPropietario] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // El porcentaje de tu planilla (0.1188...) es un decimal.
      // Lo convertimos a número antes de enviarlo.
      const porcentajeNum = parseFloat(porcentaje.replace(',', '.'));
      if (isNaN(porcentajeNum)) {
        throw new Error('El porcentaje debe ser un número válido.');
      }

      await crearUnidad({ nombre, propietario, porcentaje: porcentajeNum });
      
      setMessage('¡Unidad cargada exitosamente!');
      setNombre('');
      setPropietario('');
      setPorcentaje('');

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Cargar Nueva Unidad / Propietario</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label>Nombre Unidad</label>
            <input
              type="text"
              placeholder="Ej: Departamento 1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </div>
          <div style={{ flex: 2 }}>
            <label>Nombre Propietario</label>
            <input
              type="text"
              placeholder="Ej: Rubén Gonzalez"
              value={propietario}
              onChange={(e) => setPropietario(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Porcentaje (%)</label>
            <input
              type="number"
              // Usamos alta precisión para los decimales
              step="0.000000000000001" 
              placeholder="Ej: 0.11883"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </div>
        </div>
        
        <button type="submit" disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Cargando...' : 'Guardar Unidad'}
        </button>
        {message && <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}
      </form>
    </div>
  );
}

export default CargaPropietarioForm;