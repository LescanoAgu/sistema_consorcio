import React, { useState } from 'react';
import { Unit } from '../types';
import { Plus, Trash2, Save, X, Mail, Upload, FileText, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
// ✅ Importamos el servicio
import { addUnit } from '../services/firestoreService';

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string; // ✅ Necesitamos esto para saber dónde guardar
}

const UnitsView: React.FC<UnitsViewProps> = ({ units, setUnits, consortiumId }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // Para mostrar carga
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });

  const totalPercentage = units.reduce((acc, u) => acc + u.proratePercentage, 0);

  // --- Agregar Manualmente ---
  const handleAdd = async () => {
    if (!newUnit.unitNumber || !newUnit.ownerName) return alert("Complete los datos obligatorios");
    
    try {
      const unitToAdd = {
        id: 'temp', // El ID real lo pone firebase
        unitNumber: newUnit.unitNumber,
        ownerName: newUnit.ownerName,
        proratePercentage: Number(newUnit.proratePercentage),
        initialBalance: Number(newUnit.initialBalance || 0),
        linkedEmail: newUnit.linkedEmail || '',
      };

      // ✅ Guardar en Firebase
      const savedUnit = await addUnit(consortiumId, unitToAdd);
      
      setUnits([...units, savedUnit]);
      setNewUnit({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });
      setIsAdding(false);
    } catch (e) {
      alert("Error al guardar en base de datos");
    }
  };

  // --- Carga Masiva (CSV/TXT) ---
  const handleProcessImport = async () => {
    if(!importText.trim()) return;
    setIsProcessing(true);

    try {
        const lines = importText.split(/\r?\n/);
        const unitsToSave: Unit[] = [];
        
        // 1. Parsear texto
        lines.forEach(line => {
            if(!line.trim()) return;
            const parts = line.split(/[,;\t]/); 
            if(parts.length >= 2) {
                const u = {
                    id: '', 
                    unitNumber: parts[0]?.trim(),
                    ownerName: parts[1]?.trim(),
                    proratePercentage: parseFloat(parts[2]?.trim() || '0'),
                    initialBalance: parseFloat(parts[3]?.trim() || '0'),
                    linkedEmail: parts[4]?.trim() || ''
                };
                if(u.unitNumber && u.ownerName) unitsToSave.push(u);
            }
        });

        if (unitsToSave.length > 0) {
            // 2. Guardar uno por uno en Firebase
            const savedUnits = [];
            for (const u of unitsToSave) {
                const saved = await addUnit(consortiumId, u);
                savedUnits.push(saved);
            }

            // 3. Actualizar vista
            if(confirm(`Se han guardado ${savedUnits.length} unidades correctamente.`)) {
                setUnits([...units, ...savedUnits]);
                setShowImport(false);
                setImportText('');
            }
        } else {
            alert('No se encontraron datos válidos. Revise el formato.');
        }

    } catch (e) {
        console.error(e);
        alert('Ocurrió un error al procesar la importación.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = (id: string) => {
    // Aquí deberías agregar deleteUnit en firestoreService si quieres borrar de BD
    if (confirm('Esto solo borra de la vista actual. Para borrar de BD implemente la función de borrado.')) {
      setUnits(units.filter(u => u.id !== id));
    }
  };

  const downloadExample = () => {
      const text = "1A, Juan Perez, 5.25, 0, juan@email.com\n1B, Maria Gonzalez, 5.25, 1000, maria@email.com";
      const element = document.createElement("a");
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "ejemplo_carga.txt";
      document.body.appendChild(element);
      element.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Unidades Funcionales</h2>
        <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="bg-white border px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-slate-50">
              <Upload className="w-4 h-4 mr-2" /> Importar CSV/TXT
            </button>
            <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Agregar Unidad
            </button>
        </div>
      </div>

      {/* ... (Resto de la tabla igual, solo cambia el estado isProcessing en el modal) ... */}
      
      {/* Modal de Importación */}
      {showImport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
                  <h3 className="text-xl font-bold mb-4">Carga Masiva</h3>
                  <textarea 
                      className="w-full h-48 p-4 border rounded-xl font-mono text-sm"
                      placeholder={`1A, Juan Perez, 12.5, 0, juan@email.com...`}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      disabled={isProcessing}
                  ></textarea>
                  <div className="mt-4 flex justify-end gap-3">
                       <button onClick={() => setShowImport(false)} disabled={isProcessing} className="px-4 py-2 text-slate-600">Cancelar</button>
                       <button onClick={handleProcessImport} disabled={isProcessing} className="px-6 py-2 bg-indigo-600 text-white rounded-lg flex items-center">
                          {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2" />}
                          {isProcessing ? 'Guardando en BD...' : 'Procesar y Guardar'}
                       </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Tabla de unidades (reutiliza tu código de tabla existente aquí) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         {/* ... (Tu tabla original aquí) ... */}
         {/* Solo asegúrate de usar la variable 'units' y 'totalPercentage' que ya definimos */}
          <table className="w-full text-left">
            <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase">
                    <th className="px-6 py-3">Unidad</th>
                    <th className="px-6 py-3">Propietario</th>
                    <th className="px-6 py-3 text-right">Prorrateo</th>
                </tr>
            </thead>
            <tbody>
                {units.map(u => (
                    <tr key={u.id} className="border-b">
                        <td className="px-6 py-3">{u.unitNumber}</td>
                        <td className="px-6 py-3">{u.ownerName}</td>
                        <td className="px-6 py-3 text-right">{u.proratePercentage}%</td>
                    </tr>
                ))}
            </tbody>
          </table>
      </div>
    </div>
  );
};

export default UnitsView;