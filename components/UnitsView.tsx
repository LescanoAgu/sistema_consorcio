import React, { useState } from 'react';
import { Unit } from '../types';
import { Plus, Edit2, Trash2, Search, Mail, Home, User, Save, X, AlertCircle } from 'lucide-react';
// Importamos las funciones correctas del servicio
import { addUnit, updateUnit, deleteUnit } from '../services/firestoreService';

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
}

const UnitsView: React.FC<UnitsViewProps> = ({ units, setUnits, consortiumId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para saber si estamos editando (si tiene ID, editamos; si es null, creamos)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState<Partial<Unit>>({
    unitNumber: '',
    ownerName: '',
    linkedEmail: '',
    proratePercentage: 0,
    initialBalance: 0
  });

  // Filtrar unidades
  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Abrir modal para CREAR
  const handleOpenCreate = () => {
      setEditingId(null);
      setFormData({
        unitNumber: '',
        ownerName: '',
        linkedEmail: '',
        proratePercentage: 0,
        initialBalance: 0
      });
      setIsModalOpen(true);
  };

  // Abrir modal para EDITAR
  const handleOpenEdit = (unit: Unit) => {
      setEditingId(unit.id);
      setFormData({
          unitNumber: unit.unitNumber,
          ownerName: unit.ownerName,
          linkedEmail: unit.linkedEmail,
          proratePercentage: unit.proratePercentage,
          initialBalance: unit.initialBalance
      });
      setIsModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.unitNumber || !formData.ownerName) return alert("Número y Propietario obligatorios");

      setIsSubmitting(true);
      try {
          if (editingId) {
              // --- MODO EDICIÓN ---
              const unitToUpdate: Unit = { 
                  id: editingId, 
                  ...formData as Unit 
              };
              await updateUnit(consortiumId, unitToUpdate);
              
              // Actualizamos el estado local
              setUnits(units.map(u => u.id === editingId ? unitToUpdate : u));
          } else {
              // --- MODO CREACIÓN ---
              const newUnitData = {
                  unitNumber: formData.unitNumber!,
                  ownerName: formData.ownerName!,
                  linkedEmail: formData.linkedEmail || '',
                  proratePercentage: Number(formData.proratePercentage) || 0,
                  initialBalance: Number(formData.initialBalance) || 0
              };
              const createdUnit = await addUnit(consortiumId, newUnitData);
              
              // Actualizamos el estado local
              setUnits([...units, createdUnit]);
          }
          setIsModalOpen(false);
      } catch (error) {
          console.error(error);
          alert("Error al guardar la unidad.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // Eliminar Unidad
  const handleDelete = async (id: string) => {
      if (!confirm("¿Estás seguro de eliminar esta unidad? Se perderá su historial si no tienes cuidado.")) return;
      
      try {
          await deleteUnit(consortiumId, id);
          setUnits(units.filter(u => u.id !== id));
      } catch (error) {
          console.error(error);
          alert("Error al eliminar la unidad.");
      }
  };

  return (
    <div className="space-y-6">
      {/* Header y Buscador */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Unidades Funcionales</h2>
           <p className="text-slate-500 text-sm">Gestión de propietarios e inquilinos</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar UF o Propietario..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={handleOpenCreate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm font-medium"
            >
                <Plus className="w-4 h-4 mr-2" />
                Nueva
            </button>
        </div>
      </div>

      {/* GRID DE TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <Home className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                  <p>No se encontraron unidades.</p>
              </div>
          ) : (
              filteredUnits.map(unit => (
                  <div key={unit.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                          <div className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded text-sm">
                              UF {unit.unitNumber}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleOpenEdit(unit)}
                                className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg" title="Editar"
                              >
                                  <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(unit.id)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg" title="Eliminar"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                      
                      <div className="space-y-2">
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                              <User className="w-4 h-4 text-indigo-500"/> {unit.ownerName}
                          </h3>
                          {unit.linkedEmail && (
                              <p className="text-sm text-slate-500 flex items-center gap-2">
                                  <Mail className="w-3 h-3"/> {unit.linkedEmail}
                              </p>
                          )}
                          <div className="pt-3 mt-3 border-t border-slate-50 flex justify-between items-center text-sm">
                              <span className="text-slate-500">Prorrateo:</span>
                              <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-2 rounded">
                                  {unit.proratePercentage}%
                              </span>
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* MODAL DE EDICIÓN / CREACIÓN */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2">
                          {editingId ? <Edit2 className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
                          {editingId ? 'Editar Unidad' : 'Nueva Unidad'}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)} className="hover:bg-indigo-700 p-1 rounded transition-colors">
                          <X className="w-5 h-5"/>
                      </button>
                  </div>
                  
                  <form onSubmit={handleSave} className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">N° Unidad / UF</label>
                              <input 
                                  required
                                  type="text" 
                                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  placeholder="Ej: 101"
                                  value={formData.unitNumber}
                                  onChange={e => setFormData({...formData, unitNumber: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">% Prorrateo</label>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  placeholder="0.00"
                                  value={formData.proratePercentage}
                                  onChange={e => setFormData({...formData, prorratePercentage: parseFloat(e.target.value)})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Propietario</label>
                          <input 
                              required
                              type="text" 
                              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Ej: Juan Pérez"
                              value={formData.ownerName}
                              onChange={e => setFormData({...formData, ownerName: e.target.value})}
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Email Vinculado (Para acceso)</label>
                          <input 
                              type="email" 
                              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="juan@email.com"
                              value={formData.linkedEmail}
                              onChange={e => setFormData({...formData, linkedEmail: e.target.value})}
                          />
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3"/> Si este email se registra, verá esta unidad.
                          </p>
                      </div>

                      {/* Solo mostrar saldo inicial al crear, para no confundir al editar */}
                      {!editingId && (
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial / Deuda Previa</label>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                                  placeholder="0.00"
                                  value={formData.initialBalance}
                                  onChange={e => setFormData({...formData, initialBalance: parseFloat(e.target.value)})}
                              />
                          </div>
                      )}

                      <div className="pt-4 flex gap-3">
                          <button 
                              type="button"
                              onClick={() => setIsModalOpen(false)}
                              className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              type="submit" 
                              disabled={isSubmitting}
                              className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow flex justify-center items-center gap-2"
                          >
                              <Save className="w-4 h-4" />
                              {isSubmitting ? 'Guardando...' : 'Guardar'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default UnitsView;