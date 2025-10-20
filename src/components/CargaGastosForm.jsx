import React, { useState } from 'react';
import { crearGasto } from '../services/gastosService'; // Importamos el servicio

function CargaGastosForm() {
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [facturaFile, setFacturaFile] = useState(null); // Para el archivo PDF
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); // Para mostrar éxito o error

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setMessage('');

    try {
      await crearGasto({ fecha, concepto, proveedor, monto, facturaFile });
      
      // Éxito: Limpiamos el formulario
      setMessage('¡Gasto cargado exitosamente!');
      setFecha('');
      setConcepto('');
      setProveedor('');
      setMonto('');
      setFacturaFile(null);
      e.target.reset(); // Resetea el input de archivo

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    // Nos aseguramos que sea un solo archivo
    if (e.target.files[0]) {
      setFacturaFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Cargar Nuevo Gasto</h3>
      <form onSubmit={handleSubmit}>
        {/* Fila 1: Fecha y Concepto */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </div>
          <div style={{ flex: 2 }}>
            <label>Concepto</label>
            <input
              type="text"
              placeholder="Ej: Limpieza SUM"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </div>
        </div>

        {/* Fila 2: Proveedor y Monto */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
          <div style={{ flex: 2 }}>
            <label>Proveedor</label>
            <input
              type="text"
              placeholder="Ej: Limpiamax S.R.L."
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Monto</label>
            <input
              type="number"
              step="0.01"
              placeholder="Ej: 15000.50"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
              required
            />
          </div>
        </div>
        
        {/* Fila 3: Archivo PDF */}
        <div style={{ marginBottom: '20px' }}>
          <label>Factura (PDF)</label>
          <input 
            type="file"
            accept="application/pdf" // Solo acepta PDFs
            onChange={handleFileChange}
            style={{ width: '100%' }}
            
          />
        </div>

        {/* Botón y Mensajes */}
        <button type="submit" disabled={loading} style={{ padding: '10px 20px', fontSize: '16px' }}>
          {loading ? 'Cargando...' : 'Guardar Gasto'}
        </button>
        {message && <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}
      </form>
    </div>
  );
}

export default CargaGastosForm;