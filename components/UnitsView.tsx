import React, { useState } from 'react';
import { Unit } from '../types';
import { Plus, Trash2, Save, X, Mail, Upload, FileText, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
// Importamos el servicio
import { addUnit } from '../services/firestoreService';

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string; // ✅
}

const UnitsView: React.FC<UnitsViewProps> = ({ units, setUnits, consortiumId }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });

  const totalPercentage = units.reduce((acc, u) => acc + u.proratePercentage, 0);

  const handleAdd = async () => {
    if (!newUnit.unitNumber || !newUnit.ownerName) return;
    try {
        // ✅ Guardamos en Firebase
        const saved = await addUnit(consortiumId, {
            id: 'temp',
            unitNumber: newUnit.unitNumber,
            ownerName: newUnit.ownerName,
            proratePercentage: Number(newUnit.proratePercentage),
            initialBalance: Number(newUnit.initialBalance || 0),
            linkedEmail: newUnit.linkedEmail || '',
        });
        setUnits([...units, saved]);
        setNewUnit({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });
        setIsAdding(false);
    } catch (e) { alert("Error al guardar unidad"); }
  };

  const handleProcessImport = async () => {
    if(!importText.trim()) return;
    setIsProcessing(true);
    try {
        const lines = importText.split(/\r?\n/);
        const newUnits: Unit[] = [];
        lines.forEach(line => {
            if(!line.trim()) return;
            const parts = line.split(/[,;\t]/); 
            if(parts.length >= 2) {
                newUnits.push({
                    id: '',
                    unitNumber: parts[0]?.trim(),
                    ownerName: parts[1]?.trim(),
                    proratePercentage: parseFloat(parts[2]?.trim() || '0'),
                    initialBalance: parseFloat(parts[3]?.trim() || '0'),
                    linkedEmail: parts[4]?.trim() || ''
                });
            }
        });

        if (newUnits.length > 0) {
            // ✅ Guardamos uno por uno en Firebase
            const savedList = [];
            for (const u of newUnits) {
                const saved = await addUnit(consortiumId, u);
                savedList.push(saved);
            }
            setUnits([...units, ...savedList]);
            setShowImport(false);
            setImportText('');
            alert(`Se importaron ${savedList.length} unidades correctamente.`);
        }
    } catch (e) {
        alert('Error al procesar.');
    } finally {
        setIsProcessing(false);
    }
  };

  // ... (El resto del render es igual al que tenías, solo asegúrate de conectar los botones)
  // RESUMEN DEL RENDER PARA QUE COPIES Y PEGUES SI ES NECESARIO:
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Unidades Funcionales</h2>
        <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="bg-white border px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-slate-50">
            <Upload className="w-4 h-4 mr-2" /> Importar
            </button>
            <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Agregar
            </button>
        </div>
      </div>
      
      {/* TABLA ... */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* ... (Header y Rows de la tabla, usando 'units') ... */}
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3">Unidad</th>
                <th className="px-6 py-3">Propietario</th>
                <th className="px-6 py-3 text-right">Saldo</th>
                <th className="px-6 py-3 text-right">Prorrateo</th>
              </tr>
            </thead>
            <tbody>
              {isAdding && (
                 <tr>
                    <td className="px-6 py-4"><input className="border rounded p-1" placeholder="Unidad" value={newUnit.unitNumber} onChange={e => setNewUnit({...newUnit, unitNumber: e.target.value})}/></td>
                    <td className="px-6 py-4"><input className="border rounded p-1" placeholder="Nombre" value={newUnit.ownerName} onChange={e => setNewUnit({...newUnit, ownerName: e.target.value})}/></td>
                    <td className="px-6 py-4 text-right"><input type="number" className="border rounded p-1 text-right" placeholder="0.00" value={newUnit.initialBalance} onChange={e => setNewUnit({...newUnit, initialBalance: parseFloat(e.target.value)})}/></td>
                    <td className="px-6 py-4 text-right"><input type="number" className="border rounded p-1 text-right" placeholder="%" value={newUnit.proratePercentage} onChange={e => setNewUnit({...newUnit, proratePercentage: parseFloat(e.target.value)})}/></td>
                    <td className="px-6 py-4 text-right"><button onClick={handleAdd} className="text-green-600 font-bold">Guardar</button></td>
                 </tr>
              )}
              {units.map(u => (
                <tr key={u.id} className="border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold">{u.unitNumber}</td>
                    <td className="px-6 py-4">{u.ownerName}</td>
                    <td className="px-6 py-4 text-right">${u.initialBalance.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">{u.proratePercentage.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {/* MODAL IMPORT */}
      {showImport && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className="bg-white p-6 rounded-xl w-full max-w-2xl">
                 <h3 className="text-lg font-bold mb-4">Importar CSV</h3>
                 <textarea className="w-full h-48 border p-2 mb-4 font-mono text-xs" placeholder="1A, Juan, 10.5, 0" value={importText} onChange={e => setImportText(e.target.value)} disabled={isProcessing}></textarea>
                 <div className="flex justify-end gap-2">
                     <button onClick={() => setShowImport(false)} disabled={isProcessing} className="px-4 py-2 border rounded">Cancelar</button>
                     <button onClick={handleProcessImport} disabled={isProcessing || !importText} className="px-4 py-2 bg-indigo-600 text-white rounded">
                        {isProcessing ? 'Procesando...' : 'Procesar'}
                     </button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};
export default UnitsView;