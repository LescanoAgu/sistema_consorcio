import React, { useState, useMemo, useEffect } from 'react';
import { Expense, ExpenseDistributionType, ExpenseTemplate, Unit } from '../types';
import { Plus, Trash2, Tag, Paperclip, CheckCircle, Loader2, FileText, Download, Bookmark, X, Save, Upload, FileSpreadsheet, Edit2, Users } from 'lucide-react';
import { addExpense, deleteExpense, updateExpense, uploadExpenseReceipt, getExpenseTemplates, addExpenseTemplate, deleteExpenseTemplate } from '../services/firestoreService';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  reserveBalance: number;
  consortiumId: string;
  units: Unit[]; // ESTO ES CLAVE PARA PODER SELECCIONARLAS
}

const EXPENSE_CATEGORIES = [
  'Mantenimiento', 'Reparaciones', 'Servicios', 'Administrativo', 
  'Seguros', 'Sueldos y Cargas', 'Limpieza', 'Bancarios', 'Otros'
];

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses, reserveBalance, consortiumId, units }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // ESTADO PARA SABER SI APLICA A TODAS O SOLO A ALGUNAS
  const [appliesToAll, setAppliesToAll] = useState(true);

  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '', amount: 0, date: new Date().toISOString().split('T')[0],
    category: 'Ordinary', itemCategory: 'Mantenimiento', distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: '',
    affectedUnitIds: [] // AQUÍ SE GUARDAN LAS UNIDADES SELECCIONADAS
  });

  useEffect(() => {
      if (consortiumId) getExpenseTemplates(consortiumId).then(setTemplates);
  }, [consortiumId]);

  const spentFromReserve = useMemo(() => {
    return expenses.filter(e => e.distributionType === ExpenseDistributionType.FROM_RESERVE).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [expenses]);

  const initialBalanceSafe = (typeof reserveBalance === 'number' && !isNaN(reserveBalance)) ? reserveBalance : 0;
  const currentAvailableBalance = initialBalanceSafe - spentFromReserve;

  const gastosAgrupados = useMemo(() => {
    return expenses.reduce((acumulador, gasto) => {
      const categoria = gasto.itemCategory || 'Varios';
      if (!acumulador[categoria]) acumulador[categoria] = [];
      acumulador[categoria].push(gasto);
      return acumulador;
    }, {} as Record<string, Expense[]>);
  }, [expenses]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          try {
              const url = await uploadExpenseReceipt(file);
              setNewExpense(curr => ({ ...curr, attachmentUrl: url }));
          } catch (error) { alert("Error al subir comprobante."); } finally { setIsUploading(false); }
      }
  }

  const handleOpenEdit = (e: Expense) => {
      setEditingId(e.id);
      setNewExpense(e);
      setAppliesToAll(!e.affectedUnitIds || e.affectedUnitIds.length === 0);
      setIsFormOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUnitToggle = (unitId: string) => {
      const current = newExpense.affectedUnitIds || [];
      if (current.includes(unitId)) {
          setNewExpense({ ...newExpense, affectedUnitIds: current.filter(id => id !== unitId) });
      } else {
          setNewExpense({ ...newExpense, affectedUnitIds: [...current, unitId] });
      }
  };

  const handleSave = async () => {
    if (!newExpense.description) return alert("Falta descripción");
    const amount = Number(newExpense.amount) || 0;
    if (amount <= 0) return alert("Monto inválido");
    
    try {
        const expenseData = {
            description: newExpense.description || '', amount: amount, date: newExpense.date || new Date().toISOString().split('T')[0],
            category: newExpense.category as any, itemCategory: newExpense.itemCategory || 'Otros',
            distributionType: newExpense.distributionType as any, attachmentUrl: newExpense.attachmentUrl,
            affectedUnitIds: appliesToAll ? [] : (newExpense.affectedUnitIds || [])
        };

        if (!appliesToAll && expenseData.affectedUnitIds.length === 0) {
            return alert("Debes seleccionar al menos una unidad si no aplica a todas.");
        }

        if (editingId) {
            await updateExpense(consortiumId, editingId, expenseData);
            setExpenses(prev => prev.map(e => e.id === editingId ? { ...expenseData, id: editingId } : e));
            alert("Gasto actualizado correctamente.");
        } else {
            if (newExpense.distributionType === ExpenseDistributionType.FROM_RESERVE && amount > currentAvailableBalance) {
                if(!confirm(`⚠️ SALDO INSUFICIENTE\n¿Guardar igual y dejar saldo negativo en la reserva?`)) return;
            }
            const saved = await addExpense(consortiumId, expenseData);
            setExpenses(prev => [...prev, saved]);
        }
        resetForm();
    } catch (e) { alert("Error al guardar."); }
  };

  const resetForm = () => {
    setEditingId(null);
    setIsFormOpen(false);
    setAppliesToAll(true);
    setNewExpense({
        description: '', amount: 0, date: new Date().toISOString().split('T')[0],
        category: 'Ordinary', itemCategory: 'Mantenimiento', distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: '', affectedUnitIds: []
    });
  }

  const handleDelete = async (id: string) => {
    if(confirm('¿Eliminar gasto?')) {
        await deleteExpense(consortiumId, id);
        setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("⚠️ Se importarán gastos. Asegúrese de las columnas: 'Fecha', 'Descripcion', 'Monto', 'Rubro'.")) return;

      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
              let count = 0;
              for (const row of (data as any[])) {
                  const desc = row['Descripcion'] || row['Descripción'] || row['Concepto'];
                  const amount = parseFloat(row['Monto'] || row['Importe'] || 0);
                  if (desc && amount > 0) {
                      const newExp = {
                          description: String(desc), amount: amount,
                          date: row['Fecha'] ? new Date(row['Fecha']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                          category: 'Ordinary' as const, itemCategory: row['Rubro'] || 'Otros',
                          distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: '',
                          affectedUnitIds: [] 
                      };
                      const saved = await addExpense(consortiumId, newExp);
                      setExpenses(prev => [...prev, saved]);
                      count++;
                  }
              }
              alert(`¡Carga exitosa! ${count} gastos importados.`);
          } catch (error) { alert("Error al procesar Excel."); } 
          finally { setIsImporting(false); e.target.value = ''; }
      };
      reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
      const ws = XLSX.utils.json_to_sheet([
          { Fecha: "2024-03-01", Descripcion: "Abono Ascensor", Monto: 50000, Rubro: "Mantenimiento" },
          { Fecha: "2024-03-05", Descripcion: "Compra Lavandina", Monto: 4500, Rubro: "Limpieza" }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Plantilla Gastos");
      XLSX.writeFile(wb, "Plantilla_Carga_Gastos.xlsx");
  };

  const handleExportExcel = () => {
      const data = expenses.map(e => ({
          Fecha: new Date(e.date).toLocaleDateString(), Rubro: e.itemCategory, Descripción: e.description,
          Monto: e.amount, Comprobante: e.attachmentUrl ? 'Sí' : 'No', 
          Destino: (!e.affectedUnitIds || e.affectedUnitIds.length === 0) ? 'Todas las Unidades' : `${e.affectedUnitIds.length} Unidades Específicas`
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Gastos");
      XLSX.writeFile(wb, "Gastos_Consorcio.xlsx");
  };

  const handleSaveTemplate = async () => {
      if (!newExpense.description) return alert("Escribe descripción.");
      const alias = prompt("Nombre plantilla:", newExpense.description);
      if(!alias) return;
      const tpl = await addExpenseTemplate(consortiumId, { alias, description: newExpense.description, amount: newExpense.amount||0, category: newExpense.category as any, itemCategory: newExpense.itemCategory||'', distributionType: newExpense.distributionType as any, affectedUnitIds: appliesToAll ? [] : newExpense.affectedUnitIds });
      setTemplates([...templates, tpl]);
  };
  
  const handleLoadTemplate = (t: ExpenseTemplate) => {
      setNewExpense({ ...newExpense, description: t.description, amount: t.amount, category: t.category, itemCategory: t.itemCategory, distributionType: t.distributionType, affectedUnitIds: t.affectedUnitIds || [] });
      setAppliesToAll(!t.affectedUnitIds || t.affectedUnitIds.length === 0);
      setShowTemplates(false);
  };
  
  const handleDeleteTemplate = async (e: any, id: string) => {
      e.stopPropagation(); if(!confirm("Borrar?")) return;
      await deleteExpenseTemplate(consortiumId, id);
      setTemplates(templates.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Registro de Gastos</h2>
        <div className="flex gap-2 flex-wrap">
            {expenses.length > 0 && (
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-50">
                    <Download className="w-4 h-4"/> Exportar
                </button>
            )}
            
            <button onClick={downloadTemplate} className="text-slate-500 hover:text-indigo-600 p-2 border rounded-lg" title="Plantilla Excel">
                <FileSpreadsheet className="w-5 h-5"/>
            </button>

            <label className={`cursor-pointer bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-lg flex items-center font-bold text-sm ${isImporting ? 'opacity-50' : ''}`}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Upload className="w-4 h-4 mr-2" />}
                Importar
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
            </label>

            {!isFormOpen && (
                <button onClick={() => { setIsFormOpen(true); setEditingId(null); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold text-sm">
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Gasto
                </button>
            )}
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 animate-fade-in relative">
          <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-lg text-slate-700">{editingId ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
              <div className="flex gap-2">
                  {!editingId && (
                      <div className="relative">
                          <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-100"><Bookmark className="w-4 h-4"/> Plantillas</button>
                          {showTemplates && (
                              <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border z-50 overflow-hidden max-h-60 overflow-y-auto">
                                  {templates.map(t => (
                                      <div key={t.id} onClick={() => handleLoadTemplate(t)} className="p-3 border-b hover:bg-indigo-50 cursor-pointer flex justify-between">
                                          <div><p className="font-bold text-xs">{t.alias}</p><p className="text-[10px] text-slate-500">{formatCurrency(t.amount)}</p></div>
                                          <button onClick={(e) => handleDeleteTemplate(e, t.id)}><Trash2 className="w-3 h-3 text-slate-300 hover:text-red-500"/></button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}
                  <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
              </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                    <input className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-indigo-500" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
                    <input type="number" step="0.01" className="w-full p-2 border rounded outline-none font-bold text-indigo-700" value={newExpense.amount||''} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value)||0 })} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label><input type="date" className="w-full p-2 border rounded outline-none" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rubro</label><select className="w-full p-2 border rounded outline-none" value={newExpense.itemCategory} onChange={e => setNewExpense({ ...newExpense, itemCategory: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Gasto</label><select className="w-full p-2 border rounded outline-none" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}><option value="Ordinary">Ordinario</option><option value="Extraordinary">Extraordinario</option></select></div>
            </div>

            {/* SECCIÓN DE ASIGNACIÓN Y DISTRIBUCIÓN (LA MAGIA) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Users className="w-4 h-4"/> ¿A quién afecta este gasto?</label>
                    <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={appliesToAll} onChange={() => setAppliesToAll(true)} className="text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium">A todas las UF</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={!appliesToAll} onChange={() => setAppliesToAll(false)} className="text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium">Seleccionar Específicas</span>
                        </label>
                    </div>
                    {!appliesToAll && (
                        <div className="h-32 overflow-y-auto bg-white border border-slate-200 rounded p-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {units.map(u => (
                                <label key={u.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 cursor-pointer">
                                    <input type="checkbox" checked={(newExpense.affectedUnitIds || []).includes(u.id)} onChange={() => handleUnitToggle(u.id)} className="rounded text-indigo-600"/>
                                    {u.unitNumber}
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col justify-between">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">¿Cómo se divide el gasto?</label>
                        <select className="w-full p-2 border border-slate-200 rounded outline-none bg-white font-medium text-slate-700" value={newExpense.distributionType} onChange={e => setNewExpense({ ...newExpense, distributionType: e.target.value as any })}>
                            <option value={ExpenseDistributionType.PRORATED}>Porcentaje de Prorrateo (Tradicional)</option>
                            <option value={ExpenseDistributionType.EQUAL_PARTS}>Partes Iguales (Equitativo)</option>
                            <option value={ExpenseDistributionType.FROM_RESERVE}>Pagar con Fondo de Reserva (No se cobra)</option>
                        </select>
                    </div>
                    <div className="mt-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comprobante de Pago</label>
                        <label className={`flex items-center w-full p-2 border rounded cursor-pointer ${newExpense.attachmentUrl ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white hover:bg-slate-50 text-slate-500'}`}>
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (newExpense.attachmentUrl ? <CheckCircle className="w-4 h-4 mr-2"/> : <Paperclip className="w-4 h-4 mr-2"/>)}
                            <span className="text-sm truncate font-medium">{newExpense.attachmentUrl ? 'Adjunto Cargado (Click para cambiar)' : 'Subir foto o PDF...'}</span>
                            <input type="file" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-4">
                {!editingId && <button onClick={handleSaveTemplate} className="text-indigo-600 text-xs font-bold hover:underline flex items-center"><Save className="w-3 h-3 mr-1"/> Guardar como Plantilla</button>}
                <div className="flex gap-2 ml-auto">
                    <button onClick={resetForm} className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                    <button onClick={handleSave} className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md">{editingId ? 'Actualizar Gasto' : 'Guardar Gasto'}</button>
                </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 mt-8">
          {Object.keys(gastosAgrupados).sort().map(cat => (
             <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 font-bold text-slate-700 text-sm uppercase flex justify-between items-center">
                     <span className="flex items-center"><Tag className="w-4 h-4 inline mr-2 text-indigo-500"/> {cat}</span>
                     <span className="text-xs bg-white px-2 py-0.5 rounded border font-medium text-slate-500">{gastosAgrupados[cat].length} ítems</span>
                 </div>
                 <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-slate-100">
                            {gastosAgrupados[cat].map(e => (
                                <tr key={e.id} className="hover:bg-slate-50 group transition-colors">
                                    <td className="px-6 py-4 text-slate-500 w-32">{new Date(e.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        <div className="flex flex-col">
                                            <span>{e.description}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                {(!e.affectedUnitIds || e.affectedUnitIds.length === 0) ? (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">Todas las Unidades</span>
                                                ) : (
                                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">{e.affectedUnitIds.length} Unidades Afectadas</span>
                                                )}
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">{e.distributionType === 'EQUAL_PARTS' ? 'Partes Iguales' : e.distributionType === 'PRORATED' ? 'Prorrateo' : 'Fondo Reserva'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {e.attachmentUrl && <a href={e.attachmentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Ver Comprobante"><FileText className="w-5 h-5 inline"/></a>}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-slate-700">{formatCurrency(e.amount)}</td>
                                    <td className="px-6 py-4 text-right w-24">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenEdit(e)} className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded transition-colors"><Edit2 className="w-4 h-4"/></button>
                                            <button onClick={() => handleDelete(e.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                 </div>
             </div>
          ))}
      </div>
    </div>
  );
};

export default ExpensesView;