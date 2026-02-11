import React, { useState } from 'react';
import { Unit } from '../types';
import { Plus, Edit2, Trash2, Search, Mail, Home, User, X, Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { addUnit, updateUnit, deleteUnit } from '../services/firestoreService';
import * as XLSX from 'xlsx';

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
}

const UnitsView: React.FC<UnitsViewProps> = ({ units, setUnits, consortiumId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado del formulario (ahora emailsInput es un string para manejar comas)
  const [formData, setFormData] = useState({
    unitNumber: '',
    ownerName: '',
    authorizedEmailsInput: '', 
    proratePercentage: '', 
    initialBalance: ''     
  });

  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
      setEditingId(null);
      setFormData({ unitNumber: '', ownerName: '', authorizedEmailsInput: '', proratePercentage: '', initialBalance: '' });
      setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
      setEditingId(unit.id);
      setFormData({
          unitNumber: unit.unitNumber,
          ownerName: unit.ownerName,
          // Convertimos el array de emails a string separado por comas para editar
          authorizedEmailsInput: unit.authorizedEmails ? unit.authorizedEmails.join(', ') : '',
          proratePercentage: unit.proratePercentage.toString(),
          initialBalance: unit.initialBalance.toString()
      });
      setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!consortiumId) return alert("Error: No se identificó el consorcio. Refresque la página.");
      if (!formData.unitNumber || !formData.ownerName) return alert("Número y Propietario obligatorios");

      setIsSubmitting(true);
      const finalPercentage = parseFloat(formData.proratePercentage) || 0;
      const finalBalance = parseFloat(formData.initialBalance) || 0;

      // PROCESAR EMAILS: De string "a@a.com, b@b.com" a array ["a@a.com", "b@b.com"]
      const emailsArray = formData.authorizedEmailsInput
          .split(',')
          .map(email => email.trim())
          .filter(email => email.length > 0 && email.includes('@'));

      try {
          if (editingId) {
              const unitToUpdate: Unit = { 
                  id: editingId, 
                  unitNumber: formData.unitNumber,
                  ownerName: formData.ownerName,
                  authorizedEmails: emailsArray,
                  proratePercentage: finalPercentage,
                  initialBalance: finalBalance
              };
              await updateUnit(consortiumId, unitToUpdate);
              setUnits(units.map(u => u.id === editingId ? unitToUpdate : u));
          } else {
              const newUnitData = {
                  unitNumber: formData.unitNumber,
                  ownerName: formData.ownerName,
                  authorizedEmails: emailsArray,
                  proratePercentage: finalPercentage,
                  initialBalance: finalBalance
              };
              const createdUnit = await addUnit(consortiumId, newUnitData);
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

  const handleDelete = async (id: string) => {
      if (!confirm("¿Estás seguro de eliminar esta unidad?")) return;
      try {
          await deleteUnit(consortiumId, id);
          setUnits(units.filter(u => u.id !== id));
      } catch (error) {
          alert("Error al eliminar la unidad.");
      }
  };

  // --- IMPORTACIÓN MASIVA EXCEL (Actualizado para multiples mails) ---
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!consortiumId) {
          alert("Error crítico: El ID del consorcio no está cargado. Por favor, recarga la página.");
          return;
      }

      if (!confirm("⚠️ Se importarán unidades. Asegúrese de que el Excel tenga las columnas: 'Unidad', 'Propietario', 'Emails', 'Porcentaje', 'SaldoInicial'.")) return;

      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data = XLSX.utils.sheet_to_json(ws);

              let count = 0;
              for (const row of (data as any[])) {
                  const unitNumber = row['Unidad'] || row['unidad'] || row['UF'];
                  const ownerName = row['Propietario'] || row['propietario'] || row['Nombre'];
                  
                  if (unitNumber && ownerName) {
                      // Procesa emails del excel (puede venir uno solo o varios separados por coma)
                      const rawEmails = row['Emails'] || row['emails'] || row['Email'] || '';
                      const emailsArray = String(rawEmails).split(',').map(e => e.trim()).filter(e => e.includes('@'));

                      const newUnit = {
                          unitNumber: String(unitNumber),
                          ownerName: String(ownerName),
                          authorizedEmails: emailsArray,
                          proratePercentage: parseFloat(row['Porcentaje'] || row['porcentaje'] || 0),
                          initialBalance: parseFloat(row['SaldoInicial'] || row['saldo'] || 0)
                      };
                      
                      const saved = await addUnit(consortiumId, newUnit);
                      setUnits(prev => [...prev, saved]);
                      count++;
                  }
              }
              alert(`¡Importación exitosa! Se cargaron ${count} unidades.`);
          } catch (error) {
              console.error(error);
              alert("Error al procesar el archivo Excel. Verifique el formato.");
          } finally {
              setIsImporting(false);
              e.target.value = ''; 
          }
      };
      reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
      const ws = XLSX.utils.json_to_sheet([
          { Unidad: "1A", Propietario: "Juan Perez", Emails: "juan@mail.com, inquilino@mail.com", Porcentaje: 5.5, SaldoInicial: 0 },
          { Unidad: "1B", Propietario: "Maria Gomez", Emails: "maria@mail.com", Porcentaje: 4.2, SaldoInicial: 1000 }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Plantilla Unidades");
      XLSX.writeFile(wb, "Plantilla_Carga_Unidades.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Unidades Funcionales</h2>
           <p className="text-slate-500 text-sm">Gestión de propietarios e inquilinos (Multi-usuario)</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 md:w-48">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <button onClick={downloadTemplate} className="text-slate-500 hover:text-indigo-600 p-2 border rounded-lg" title="Descargar Plantilla Excel">
                <FileSpreadsheet className="w-5 h-5"/>
            </button>
            
            <label className={`cursor-pointer bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg flex items-center shadow-sm font-medium ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Upload className="w-4 h-4 mr-2" />}
                <span className="text-sm">Importar Excel</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
            </label>

            <button 
                onClick={handleOpenCreate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm font-medium"
            >
                <Plus className="w-4 h-4 mr-2" /> Nueva
            </button>
        </div>
      </div>

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
                              <button onClick={() => handleOpenEdit(unit)} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg">
                                  <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(unit.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                      
                      <div className="space-y-2">
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                              <User className="w-4 h-4 text-indigo-500"/> {unit.ownerName}
                          </h3>
                          
                          {/* Visualización de Múltiples Emails */}
                          {unit.authorizedEmails && unit.authorizedEmails.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                  {unit.authorizedEmails.map((email, idx) => (
                                      <p key={idx} className="text-xs text-slate-500 flex items-center gap-2 bg-slate-50 p-1 rounded">
                                          <Mail className="w-3 h-3 text-slate-400"/> {email}
                                      </p>
                                  ))}
                              </div>
                          ) : (
                              <p className="text-xs text-slate-400 italic pl-1">Sin emails vinculados</p>
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

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2">
                          {editingId ? <Edit2 className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
                          {editingId ? 'Editar Unidad' : 'Nueva Unidad'}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)} className="hover:bg-indigo-700 p-1 rounded transition-colors"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <form onSubmit={handleSave} className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">N° Unidad / UF</label>
                              <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: 101" value={formData.unitNumber} onChange={e => setFormData({...formData, unitNumber: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">% Prorrateo</label>
                              <input required type="text" inputMode="decimal" className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500" placeholder="0.00" value={formData.proratePercentage} onChange={e => /^[\d.]*$/.test(e.target.value) && setFormData({...formData, proratePercentage: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Propietario</label>
                          <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: Juan Pérez" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} />
                      </div>
                      
                      {/* CAMPO DE EMAILS MÚLTIPLES */}
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Emails Autorizados (separar por coma)</label>
                          <input 
                            type="text" 
                            className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500" 
                            placeholder="dueño@mail.com, inquilino@mail.com" 
                            value={formData.authorizedEmailsInput} 
                            onChange={e => setFormData({...formData, authorizedEmailsInput: e.target.value})} 
                          />
                          <p className="text-xs text-slate-400 mt-1">Estos usuarios podrán ver esta unidad.</p>
                      </div>

                      {!editingId && (
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial / Deuda</label>
                              <input type="text" inputMode="decimal" className="w-full p-2 border rounded-lg bg-slate-50 outline-none" placeholder="0.00" value={formData.initialBalance} onChange={e => /^[\d.]*$/.test(e.target.value) && setFormData({...formData, initialBalance: e.target.value})} />
                          </div>
                      )}
                      <div className="pt-4 flex gap-3">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                          <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default UnitsView;