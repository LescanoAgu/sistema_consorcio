import React, { useState } from 'react';
import { Unit, Payment, SettlementRecord, Consortium } from '../types';
import { Plus, Edit2, Trash2, Search, Mail, Home, User, X, Upload, FileSpreadsheet, Loader2, FileText, Download } from 'lucide-react';
import { addUnit, updateUnit, deleteUnit } from '../services/firestoreService';
import { generateUnitLedgerPDF } from '../services/pdfService';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface UnitsViewProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  consortiumId: string;
  payments?: Payment[]; 
  history?: SettlementRecord[];
  consortium?: Consortium;
  onUpdateUnit: (id: string, updates: Partial<Unit>) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

const UnitsView: React.FC<UnitsViewProps> = ({ 
    units, setUnits, consortiumId, payments = [], history = [], consortium, onUpdateUnit, onDeletePayment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [ledgerUnit, setLedgerUnit] = useState<Unit | null>(null);

  const [formData, setFormData] = useState({
    unitNumber: '', ownerName: '', authorizedEmailsInput: '', proratePercentage: '', initialBalance: ''     
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
          unitNumber: unit.unitNumber, ownerName: unit.ownerName,
          authorizedEmailsInput: unit.authorizedEmails ? unit.authorizedEmails.join(', ') : '',
          proratePercentage: unit.proratePercentage.toString(),
          initialBalance: unit.initialBalance.toString()
      });
      setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!consortiumId) return alert("Error: No se identificó el consorcio. Refresque la página.");
      if (!formData.unitNumber || !formData.ownerName) return alert("Identificador y Propietario obligatorios");

      setIsSubmitting(true);
      const finalPercentage = parseFloat(formData.proratePercentage) || 0;
      const finalBalance = parseFloat(formData.initialBalance) || 0;

      const emailsArray = formData.authorizedEmailsInput.split(',').map(email => email.trim()).filter(email => email.length > 0 && email.includes('@'));

      try {
          if (editingId) {
              const unitToUpdate: Unit = { 
                  id: editingId, unitNumber: formData.unitNumber, ownerName: formData.ownerName,
                  authorizedEmails: emailsArray, proratePercentage: finalPercentage, initialBalance: finalBalance
              };
              await updateUnit(consortiumId, editingId, unitToUpdate, unitToUpdate);
              setUnits(units.map(u => u.id === editingId ? { ...u, ...unitToUpdate } : u));
          } else {
              const newUnitData = {
                  unitNumber: formData.unitNumber, ownerName: formData.ownerName,
                  authorizedEmails: emailsArray, proratePercentage: finalPercentage, initialBalance: finalBalance
              };
              const createdUnit = await addUnit(consortiumId, newUnitData);
              setUnits([...units, createdUnit]);
          }
          setIsModalOpen(false);
      } catch (error) {
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

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !consortiumId) return;
      if (!confirm("⚠️ Se importarán unidades. Columnas necesarias: 'Unidad', 'Propietario', 'Emails', 'Porcentaje', 'SaldoInicial'.")) return;

      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json(ws);

              let count = 0;
              for (const row of (data as any[])) {
                  const unitNumber = row['Unidad'] || row['unidad'] || row['UF'] || row['Identificador'];
                  const ownerName = row['Propietario'] || row['propietario'] || row['Nombre'];
                  
                  if (unitNumber && ownerName) {
                      const rawEmails = row['Emails'] || row['emails'] || row['Email'] || '';
                      const emailsArray = String(rawEmails).split(',').map(e => e.trim()).filter(e => e.includes('@'));

                      const newUnit = {
                          unitNumber: String(unitNumber), ownerName: String(ownerName),
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
              alert("Error al procesar el archivo Excel. Verifique el formato.");
          } finally {
              setIsImporting(false);
              e.target.value = ''; 
          }
      };
      reader.readAsBinaryString(file);
  };

  // --- LÓGICA SEGURA Y ELIMINABLE DEL ESTADO DE CUENTA ---
  const getLedgerItems = (u: Unit) => {
      const items: any[] = [];
      if (u.initialBalance) {
          items.push({ id: 'initial', type: 'INITIAL', date: '-', concept: 'Saldo Inicial / Deuda Previa', charge: u.initialBalance, payment: 0 });
      }
      if (u.debts) {
          u.debts.forEach(d => {
              items.push({ id: d.id, type: 'DEBT', date: d.period, concept: `Deuda Histórica / Recargo (${d.interestRate}%)`, charge: d.total, payment: 0 });
          });
      }
      (payments || []).filter(p => p.unitId === u.id && p.status === 'APPROVED').forEach(p => {
          items.push({ id: p.id, type: 'PAYMENT', date: new Date(p.date).toLocaleDateString(), concept: `Pago Realizado (${p.method})`, charge: 0, payment: p.amount });
      });
      return items;
  };

  const handleDeleteLedgerItem = async (item: any) => {
      if (!ledgerUnit) return;
      if (!confirm("⚠️ ¿Estás seguro de eliminar este registro?\nEsta acción es irreversible y afectará el balance de inmediato.")) return;

      try {
          if (item.type === 'INITIAL') {
              await onUpdateUnit(ledgerUnit.id, { initialBalance: 0 });
              setLedgerUnit({ ...ledgerUnit, initialBalance: 0 });
          } else if (item.type === 'DEBT') {
              const newDebts = (ledgerUnit.debts || []).filter(d => d.id !== item.id);
              await onUpdateUnit(ledgerUnit.id, { debts: newDebts });
              setLedgerUnit({ ...ledgerUnit, debts: newDebts });
          } else if (item.type === 'PAYMENT') {
              await onDeletePayment(item.id);
          }
      } catch (error) {
          alert("Error al eliminar el registro.");
      }
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
                    type="text" placeholder="Buscar..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <label className={`cursor-pointer bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg flex items-center shadow-sm font-medium ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Upload className="w-4 h-4 mr-2" />}
                <span className="text-sm">Importar Excel</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
            </label>

            <button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm font-medium">
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
                              {unit.unitNumber}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenEdit(unit)} className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg">
                                  <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(unit.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                      
                      <div className="space-y-2">
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                              <User className="w-4 h-4 text-indigo-500"/> {unit.ownerName}
                          </h3>
                          
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

                          <div className="pt-2">
                              <button 
                                  onClick={() => setLedgerUnit(unit)}
                                  className="w-full flex justify-center items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-1.5 rounded-lg text-sm font-medium transition-colors"
                              >
                                  <FileText className="w-4 h-4" /> Estado de Cuenta
                              </button>
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* MODAL CREAR / EDITAR UNIDAD */}
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
                              <label className="block text-sm font-medium text-slate-700 mb-1">Identificador</label>
                              <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: B1-L01, 1A..." value={formData.unitNumber} onChange={e => setFormData({...formData, unitNumber: e.target.value})} />
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
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Emails Autorizados (separar por coma)</label>
                          <input 
                            type="text" 
                            className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500" 
                            placeholder="dueño@mail.com" 
                            value={formData.authorizedEmailsInput} 
                            onChange={e => setFormData({...formData, authorizedEmailsInput: e.target.value})} 
                          />
                          <p className="text-xs text-slate-400 mt-1">Estos usuarios podrán ver esta unidad.</p>
                      </div>

                      {!editingId && (
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial / Deuda Previa</label>
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

      {/* MODAL ESTADO DE CUENTA CON BOTÓN DE ELIMINAR */}
      {ledgerUnit && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                      <div>
                          <h3 className="font-bold text-xl text-slate-800">Estado de Cuenta</h3>
                          <p className="text-sm text-slate-500">{ledgerUnit.unitNumber} - {ledgerUnit.ownerName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                          <button 
                              onClick={() => { if(consortium) generateUnitLedgerPDF(ledgerUnit, payments, consortium); }}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors"
                          >
                              <Download className="w-4 h-4" /> Exportar PDF
                          </button>
                          <button onClick={() => setLedgerUnit(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6"/></button>
                      </div>
                  </div>
                  
                  <div className="p-5 overflow-y-auto flex-1">
                      <table className="w-full text-sm text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                              <tr>
                                  <th className="px-4 py-3 rounded-tl-lg">Fecha</th>
                                  <th className="px-4 py-3">Concepto</th>
                                  <th className="px-4 py-3 text-right">Cargo (+)</th>
                                  <th className="px-4 py-3 text-right">Pago (-)</th>
                                  <th className="px-4 py-3 text-center rounded-tr-lg">Acción</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {getLedgerItems(ledgerUnit).length === 0 ? (
                                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">Sin movimientos registrados.</td></tr>
                              ) : (
                                  getLedgerItems(ledgerUnit).map((item, i) => (
                                      <tr key={i} className="hover:bg-slate-50 group transition-colors">
                                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.date}</td>
                                          <td className="px-4 py-3 font-medium text-slate-700">{item.concept}</td>
                                          <td className="px-4 py-3 text-right font-bold text-red-600">{item.charge > 0 ? formatCurrency(item.charge) : '-'}</td>
                                          <td className="px-4 py-3 text-right font-bold text-emerald-600">{item.payment > 0 ? formatCurrency(item.payment) : '-'}</td>
                                          <td className="px-4 py-3 text-center">
                                              <button 
                                                onClick={() => handleDeleteLedgerItem(item)} 
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                title="Eliminar registro"
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>

                  <div className="p-5 border-t border-slate-100 bg-slate-50 text-right">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Saldo Total Pendiente</p>
                      <p className="text-2xl font-black text-slate-800">
                          {formatCurrency(getLedgerItems(ledgerUnit).reduce((acc, curr) => acc + curr.charge - curr.payment, 0))}
                      </p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UnitsView;