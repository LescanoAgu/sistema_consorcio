import React, { useState } from 'react';
import { crearUnidad } from '../services/propietariosService';
import { useConsorcio } from '../hooks/useConsorcio'; // <-- 1. IMPORTAR HOOK

function CargaPropietarioForm() {
  const { consorcioId } = useConsorcio(); // <-- 2. OBTENER CONSORCIO ACTIVO
  
  const [nombre, setNombre] = useState('');
  const [propietario, setPropietario] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 3. VALIDAR QUE HAYA UN CONSORCIO
    if (!consorcioId) {
      setMessage('Error: No hay un consorcio activo seleccionado.');
      setLoading(false);
      return;
    }

    try {
      const porcentajeNum = parseFloat(porcentaje.replace(',', '.'));
      if (isNaN(porcentajeNum)) {
        throw new Error('El porcentaje debe ser un número válido.');
      }

      // 4. PASAR EL consorcioId AL SERVICIO
      await crearUnidad(consorcioId, { nombre, propietario, porcentaje: porcentajeNum });
      
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

  // 5. Deshabilitar formulario si no hay consorcio
  const formDisabled = loading || !consorcioId;

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
              disabled={formDisabled}
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
              disabled={formDisabled}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Porcentaje (%)</label>
            <input
              type="number"
              step="0.000000000000001" 
              placeholder="Ej: 0.11883"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
              disabled={formDisabled}
            />
          </div>
        </div>
        
        <button type="submit" disabled={formDisabled} style={{ padding: '10px 20px' }}>
          {loading ? 'Cargando...' : 'Guardar Unidad'}
        </button>
        {!consorcioId && <p style={{ color: 'red' }}>Por favor, seleccione un consorcio para continuar.</p>}
        {message && <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}
      </form>
    </div>
  );
}

export default CargaPropietarioForm;