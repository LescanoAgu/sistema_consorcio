import React, { useState } from 'react';
import { Unit } from '../types';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import { addUnit, updateUnit, deleteUnit } from '../services/firestoreService';

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
}

const UnitsView: React.FC<UnitsViewProps> = ({ units, setUnits, consortiumId }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Unit>>({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });

  const resetForm = () => {
      setFormData({ unitNumber: '', ownerName: '', proratePercentage: 0, initialBalance: 0, linkedEmail: '' });
      setIsAdding(false);
      setEditingId(null);
  };

  const handleStartEdit = (unit: Unit) => {
      setFormData(unit);
      setEditingId(unit.id);
      setIsAdding(true);
  };

  const handleSave = async () => {
    if (!formData.unitNumber || !formData.ownerName) return;
    try {
        if (editingId) {
            const unitToUpdate = { ...formData, id: editingId } as Unit;
            await updateUnit(consortiumId, unitToUpdate);
            setUnits(units.map(u => u.id === editingId ? unitToUpdate : u));
        } else {
            const newUnit = { ...formData, id: 'temp', proratePercentage: Number(formData.proratePercentage), initialBalance: Number(formData.initialBalance || 0) } as Unit;
            const saved = await addUnit(consortiumId, newUnit);
            setUnits([...units, saved]);
        }
        resetForm();
    } catch (e) { alert("Error al guardar"); }
  };

  const handleDelete = async (id: string) => {
      if(confirm('¿Eliminar unidad?')) {
          await deleteUnit(consortiumId, id);
          setUnits(units.filter(u => u.id !== id));
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Unidades</h2>
        <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Agregar
        </button>
      </div>
      
      {isAdding && (
          <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-md mb-4">
              <div className="flex justify-between mb-2">
                  <h3 className="font-bold text-slate-700">{editingId ? 'Editar Unidad' : 'Nueva Unidad'}</h3>
                  <button onClick={resetForm}><X className="w-4 h-4 text-slate-400"/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <input className="border rounded p-2 text-sm" placeholder="UF" value={formData.unitNumber} onChange={e => setFormData({...formData, unitNumber: e.target.value})}/>
                  <input className="border rounded p-2 text-sm md:col-span-2" placeholder="Propietario" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})}/>
                  <input className="border rounded p-2 text-sm" placeholder="Email" value={formData.linkedEmail} onChange={e => setFormData({...formData, linkedEmail: e.target.value})}/>
                  <div className="flex gap-2">
                      <input type="number" className="border rounded p-2 text-sm w-1/2" placeholder="%" value={formData.proratePercentage} onChange={e => setFormData({...formData, proratePercentage: parseFloat(e.target.value)})}/>
                      <button onClick={handleSave} className="bg-green-600 text-white rounded p-2 w-1/2">Guardar</button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr><th>Unidad</th><th>Propietario</th><th>Email</th><th className="text-right">Saldo Ini.</th><th className="text-right">Porcentaje</th><th className="text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold">{u.unitNumber}</td>
                    <td className="px-6 py-4">{u.ownerName}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{u.linkedEmail}</td>
                    <td className="px-6 py-4 text-right">${u.initialBalance.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">{u.proratePercentage.toFixed(2)}%</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => handleStartEdit(u)} className="p-1 text-indigo-500"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => handleDelete(u.id)} className="p-1 text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};
export default UnitsView;