import React, { useState, useMemo, useEffect } from 'react';
import { Expense, ExpenseDistributionType, ExpenseTemplate } from '../types';
import { Plus, Trash2, DollarSign, Tag, Paperclip, CheckCircle, Loader2, AlertCircle, FileText, Download, Bookmark, X, Save, Upload, FileSpreadsheet, Edit2 } from 'lucide-react';
import { addExpense, deleteExpense, updateExpense, uploadExpenseReceipt, getExpenseTemplates, addExpenseTemplate, deleteExpenseTemplate } from '../services/firestoreService';
import * as XLSX from 'xlsx';

interface ExpensesViewProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  reserveBalance: number;
  consortiumId: string;
}

const EXPENSE_CATEGORIES = [
  'Mantenimiento', 'Reparaciones', 'Servicios', 'Administrativo', 
  'Seguros', 'Sueldos y Cargas', 'Limpieza', 'Bancarios', 'Otros'
];

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, setExpenses, reserveBalance, consortiumId }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '', amount: 0, date: new Date().toISOString().split('T')[0],
    category: 'Ordinary', itemCategory: 'Mantenimiento', distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: ''
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
      setIsFormOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!newExpense.description) return alert("Falta descripción");
    const amount = Number(newExpense.amount) || 0;
    if (amount <= 0) return alert("Monto inválido");
    
    try {
        const expenseData = {
            description: newExpense.description || '',
            amount: amount,
            date: newExpense.date || new Date().toISOString().split('T')[0],
            category: newExpense.category as any,
            itemCategory: newExpense.itemCategory || 'Otros',
            distributionType: newExpense.distributionType as any,
            attachmentUrl: newExpense.attachmentUrl
        };

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
    setNewExpense({
        description: '', amount: 0, date: new Date().toISOString().split('T')[0],
        category: 'Ordinary', itemCategory: 'Mantenimiento',
        distributionType: ExpenseDistributionType.PRORATED, attachmentUrl: ''
    });
  }

  const handleDelete = async (id: string) => {
    if(confirm('¿Eliminar gasto?')) {
        await deleteExpense(consortiumId, id);
        setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  // --- IMPORTACIÓN EXCEL CORREGIDA ---
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
              // CORRECCIÓN AQUÍ: (data as any[])
              for (const row of (data as any[])) {
                  const desc = row['Descripcion'] || row['Descripción'] || row['Concepto'];
                  const amount = parseFloat(row['Monto'] || row['Importe'] || 0);
                  
                  if (desc && amount > 0) {
                      const newExp = {
                          description: String(desc),
                          amount: amount,
                          date: row['Fecha'] ? new Date(row['Fecha']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                          category: 'Ordinary' as const,
                          itemCategory: row['Rubro'] || 'Otros',
                          distributionType: ExpenseDistributionType.PRORATED,
                          attachmentUrl: ''
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
          Monto: e.amount, Comprobante: e.attachmentUrl ? 'Sí' : 'No'
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
      const tpl = await addExpenseTemplate(consortiumId, { alias, description: newExpense.description, amount: newExpense.amount||0, category: newExpense.category as any, itemCategory: newExpense.itemCategory||'', distributionType: newExpense.distributionType as any });
      setTemplates([...templates, tpl]);
  };
  
  const handleLoadTemplate = (t: ExpenseTemplate) => {
      setNewExpense({ ...newExpense, description: t.description, amount: t.amount, category: t.category, itemCategory: t.itemCategory, distributionType: t.distributionType });
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
                    <Plus className="w-4 h-4 mr-2" /> Nuevo
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
                                          <div><p className="font-bold text-xs">{t.alias}</p><p className="text-[10px] text-slate-500">${t.amount}</p></div>
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
                    <input type="number" step="0.01" className="w-full p-2 border rounded outline-none font-bold" value={newExpense.amount||''} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value)||0 })} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label><input type="date" className="w-full p-2 border rounded" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rubro</label><select className="w-full p-2 border rounded" value={newExpense.itemCategory} onChange={e => setNewExpense({ ...newExpense, itemCategory: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label><select className="w-full p-2 border rounded" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}><option value="Ordinary">Ordinario</option><option value="Extraordinary">Extraordinario</option></select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distribución</label><select className="w-full p-2 border rounded" value={newExpense.distributionType} onChange={e => setNewExpense({ ...newExpense, distributionType: e.target.value as any })}><option value={ExpenseDistributionType.PRORATED}>Prorrateo</option><option value={ExpenseDistributionType.FROM_RESERVE}>Fondo Reserva</option></select></div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comprobante</label>
                    <label className={`flex items-center w-full p-2 border rounded cursor-pointer ${newExpense.attachmentUrl ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-slate-50'}`}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (newExpense.attachmentUrl ? <CheckCircle className="w-4 h-4 text-emerald-600 mr-2"/> : <Paperclip className="w-4 h-4 text-slate-400 mr-2"/>)}
                        <span className="text-sm truncate">{newExpense.attachmentUrl ? 'Adjunto Cargado' : 'Subir archivo...'}</span>
                        <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                </div>
            </div>

            <div className="flex justify-between pt-4 border-t mt-4">
                {!editingId && <button onClick={handleSaveTemplate} className="text-indigo-600 text-xs font-bold hover:underline flex items-center"><Save className="w-3 h-3 mr-1"/> Guardar Plantilla</button>}
                <div className="flex gap-2">
                    <button onClick={resetForm} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">{editingId ? 'Actualizar' : 'Guardar'}</button>
                </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 mt-8">
          {Object.keys(gastosAgrupados).sort().map(cat => (
             <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="bg-slate-50 px-6 py-2 border-b font-bold text-slate-700 text-sm uppercase flex justify-between items-center">
                     <span><Tag className="w-3 h-3 inline mr-2"/> {cat}</span>
                     <span className="text-xs bg-white px-2 rounded border">{gastosAgrupados[cat].length}</span>
                 </div>
                 <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                        {gastosAgrupados[cat].map(e => (
                            <tr key={e.id} className="hover:bg-slate-50 group">
                                <td className="px-6 py-3 text-slate-500 w-32">{new Date(e.date).toLocaleDateString()}</td>
                                <td className="px-6 py-3 font-medium text-slate-800">
                                    {e.description}
                                    {e.attachmentUrl && <a href={e.attachmentUrl} target="_blank" rel="noreferrer" className="ml-2 text-indigo-600 hover:underline text-xs bg-indigo-50 px-1 rounded"><FileText className="w-3 h-3 inline"/> Ver</a>}
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-slate-700">${(e.amount || 0).toLocaleString()}</td>
                                <td className="px-6 py-3 text-right w-24">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenEdit(e)} className="p-1 hover:bg-indigo-100 text-indigo-600 rounded"><Edit2 className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(e.id)} className="p-1 hover:bg-red-100 text-red-600 rounded"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
          ))}
      </div>
    </div>
  );
};

export default ExpensesView;